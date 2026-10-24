#!/usr/bin/env node
// Reads Playwright's JSON report, writes a qa_test_runs row + a
// qa_findings row per failure, and files genuinely new failures into the
// existing bug_reports table (the same table/dashboard Report a Problem
// and the AI Support admin page already use — see
// app/support/actions.ts and app/ai-support/page.tsx). Never files a
// duplicate for a test that's already an open, unresolved finding.
//
// Requires SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (GitHub Actions
// secrets — see qa/README.md "Setup required"). If either is missing,
// this still exits 0 after printing a summary — a QA run that can't file
// its findings should never itself fail the workflow or block a deploy.
import { readFileSync, existsSync } from "fs";
import { createClient } from "@supabase/supabase-js";

const RESULTS_PATH = "qa/results/results.json";
const TRIGGER = process.env.QA_TRIGGER || "manual"; // scheduled | deployment | manual
const COMMIT_SHA = process.env.GITHUB_SHA || null;
const RUN_URL =
  process.env.GITHUB_SERVER_URL && process.env.GITHUB_REPOSITORY && process.env.GITHUB_RUN_ID
    ? `${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`
    : null;

function severityFor(testFile) {
  if (testFile.includes("/regression/")) return "High"; // a bug that already shipped once
  if (testFile.includes("/workflow/")) return "High"; // a real user workflow is broken
  return "Medium"; // readonly tier — page load / perf / console noise
}

function summarize(json) {
  let total = 0,
    passed = 0,
    failed = 0,
    skipped = 0;
  const failures = [];
  for (const suite of json.suites ?? []) walk(suite);
  function walk(suite) {
    for (const spec of suite.specs ?? []) {
      for (const test of spec.tests ?? []) {
        total++;
        const outcome = test.status; // expected | unexpected | flaky | skipped
        if (outcome === "skipped") skipped++;
        else if (outcome === "expected") passed++;
        else {
          failed++;
          const lastResult = test.results?.at(-1);
          failures.push({
            test_name: spec.title,
            page_path: suite.title || spec.file || "unknown",
            error_message: (lastResult?.error?.message || "Unknown failure").slice(0, 2000),
            file: spec.file || "",
          });
        }
      }
    }
    for (const child of suite.suites ?? []) walk(child);
  }
  return { total, passed, failed, skipped, failures };
}

async function main() {
  if (!existsSync(RESULTS_PATH)) {
    console.log(`No results file at ${RESULTS_PATH} — nothing to report (the run likely crashed before producing one).`);
    return;
  }
  const json = JSON.parse(readFileSync(RESULTS_PATH, "utf8"));
  const { total, passed, failed, skipped, failures } = summarize(json);

  console.log(`QA run (${TRIGGER}): ${passed}/${total} passed, ${failed} failed, ${skipped} skipped.`);
  for (const f of failures) console.log(`  FAIL ${f.test_name} (${f.page_path})`);

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.log("SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY not set — skipping dashboard/bug-report filing (results above are the full record of this run; see the job log).");
    return;
  }
  const supabase = createClient(url, key);

  const { data: run, error: runErr } = await supabase
    .from("qa_test_runs")
    .insert({
      trigger: TRIGGER,
      status: failed > 0 ? "failed" : "passed",
      total_tests: total,
      passed_tests: passed,
      failed_tests: failed,
      skipped_tests: skipped,
      started_at: new Date(Date.now() - (json.stats?.duration ?? 0)).toISOString(),
      finished_at: new Date().toISOString(),
      github_run_url: RUN_URL,
      commit_sha: COMMIT_SHA,
    })
    .select()
    .single();
  if (runErr) {
    console.error("Failed to write qa_test_runs row (has the migration been applied?):", runErr.message);
    return;
  }
  console.log(`Recorded run ${run.id} on the QA dashboard.`);

  for (const f of failures) {
    const severity = severityFor(f.file);

    // Duplicate check: an unresolved finding for the same test, already
    // linked to an open bug report, means this is already being tracked.
    const { data: existing } = await supabase
      .from("qa_findings")
      .select("id, bug_report_id, bug_reports!inner(status)")
      .eq("test_name", f.test_name)
      .not("bug_report_id", "is", null)
      .neq("bug_reports.status", "Resolved")
      .limit(1);

    const { data: finding } = await supabase
      .from("qa_findings")
      .insert({
        run_id: run.id,
        test_name: f.test_name,
        page_path: f.page_path,
        severity,
        error_message: f.error_message,
      })
      .select()
      .single();

    if (existing && existing.length > 0) {
      console.log(`  (duplicate, already tracked as bug report ${existing[0].bug_report_id}) ${f.test_name}`);
      continue;
    }

    const { data: bugReport, error: bugErr } = await supabase
      .from("bug_reports")
      .insert({
        reported_by_user_id: "qa-agent",
        reported_by_name: "QA Agent (automated)",
        page_path: f.page_path,
        description: `[Automated QA] ${f.test_name}`,
        additional_details: `${f.error_message}\n\nFrom QA run: ${RUN_URL ?? "(no run URL)"}${COMMIT_SHA ? `\nCommit: ${COMMIT_SHA}` : ""}`,
        status: "Open",
        priority: severity === "Critical" || severity === "High" ? "High" : "Medium",
      })
      .select()
      .single();
    if (bugErr) {
      console.error(`  Failed to file bug report for ${f.test_name}:`, bugErr.message);
      continue;
    }
    await supabase.from("qa_findings").update({ bug_report_id: bugReport.id }).eq("id", finding.id);
    console.log(`  Filed new bug report ${bugReport.id} for ${f.test_name}`);
  }
}

main().catch((err) => {
  // A reporting failure must never fail the workflow or look like a
  // deploy-blocking error — it's logged and the run ends quietly.
  console.error("QA result reporting failed (non-fatal):", err);
});
