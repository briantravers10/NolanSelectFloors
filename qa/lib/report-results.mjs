#!/usr/bin/env node
// Reads Playwright's JSON report, writes a qa_test_runs row + a
// qa_findings row per failure, and files genuinely new failures into the
// existing bug_reports table (the same table/dashboard Report a Problem
// and the AI Support admin page already use — see
// app/support/actions.ts and app/ai-support/page.tsx).
//
// CREDENTIAL MODEL: this script uses the public Supabase anon key
// (SUPABASE_ANON_KEY — the same NEXT_PUBLIC_SUPABASE_ANON_KEY value the
// app's own client bundle already ships; not a secret), restricted
// entirely by RLS policies — see supabase/migrations/0039_qa_tracking.sql
// and 0040_qa_agent_bug_report_policy.sql. This is a real, database-
// enforced restriction: this credential can insert/update/select
// qa_test_runs and qa_findings, and can ONLY insert a bug_reports row
// tagged reported_by_user_id='qa-agent' — nothing else, on any table,
// under any circumstance, independent of anything this script does.
// There is deliberately no code path here that reads, updates, or
// deletes an existing bug_reports row (the credential couldn't anyway).
//
// If SUPABASE_URL/SUPABASE_ANON_KEY are missing, this still exits 0
// after printing a summary — a QA run that can't file its findings
// should never itself fail the workflow or block a deploy.
import { randomUUID } from "crypto";
import { readFileSync, existsSync } from "fs";
import { createClient } from "@supabase/supabase-js";

const RESULTS_PATH = "qa/results/results.json";
const TRIGGER = process.env.QA_TRIGGER || "manual"; // scheduled | deployment | manual
const RUN_NOTES = process.env.QA_RUN_NOTES || null; // e.g. "production read-only monitor" vs "full suite (isolated)"
const COMMIT_SHA = process.env.GITHUB_SHA || null;
const RUN_URL =
  process.env.GITHUB_SERVER_URL && process.env.GITHUB_REPOSITORY && process.env.GITHUB_RUN_ID
    ? `${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`
    : null;

// A finding that's already been filed and re-filed within this window is
// treated as "still being tracked" and skipped, rather than duplicated.
// This credential can't read bug_reports.status to know if it was
// resolved and reopened — so after this window, a still-failing (or
// freshly-failing-again) test gets a fresh report. That's a deliberate
// trade-off for a credential this narrow, not an oversight.
const DEDUPE_WINDOW_DAYS = 3;

function severityFor(testFile) {
  if (testFile.includes("/regression/")) return "High"; // a bug that already shipped once
  if (testFile.includes("/workflow/") || testFile.includes("/unit/")) return "High"; // a real user workflow or calculation is broken
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
      for (const t of spec.tests ?? []) {
        total++;
        const outcome = t.status; // expected | unexpected | flaky | skipped
        if (outcome === "skipped") skipped++;
        else if (outcome === "expected") passed++;
        else {
          failed++;
          const lastResult = t.results?.at(-1);
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

  console.log(`QA run (${TRIGGER}${RUN_NOTES ? `, ${RUN_NOTES}` : ""}): ${passed}/${total} passed, ${failed} failed, ${skipped} skipped.`);
  for (const f of failures) console.log(`  FAIL ${f.test_name} (${f.page_path})`);

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY;
  if (!url || !key) {
    console.log("SUPABASE_URL/SUPABASE_ANON_KEY not set — skipping dashboard/bug-report filing (results above are the full record of this run; see the job log).");
    return;
  }
  const supabase = createClient(url, key);

  const runId = randomUUID();
  const { error: runErr } = await supabase.from("qa_test_runs").insert({
    id: runId,
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
    notes: RUN_NOTES,
  });
  if (runErr) {
    console.error("Failed to write qa_test_runs row (has the migration been applied?):", runErr.message);
    return;
  }
  console.log(`Recorded run ${runId} on the QA dashboard.`);

  const since = new Date(Date.now() - DEDUPE_WINDOW_DAYS * 86_400_000).toISOString();

  for (const f of failures) {
    const severity = severityFor(f.file);

    // Duplicate check: scoped to qa_findings only (this credential can't
    // read bug_reports — see the credential-model note above). A finding
    // for the same test, already filed, within the dedupe window counts
    // as still being tracked.
    const { data: existing } = await supabase
      .from("qa_findings")
      .select("id, bug_report_id")
      .eq("test_name", f.test_name)
      .not("bug_report_id", "is", null)
      .gte("created_at", since)
      .limit(1);

    const findingId = randomUUID();
    await supabase.from("qa_findings").insert({
      id: findingId,
      run_id: runId,
      test_name: f.test_name,
      page_path: f.page_path,
      severity,
      error_message: f.error_message,
    });

    if (existing && existing.length > 0) {
      console.log(`  (duplicate within ${DEDUPE_WINDOW_DAYS}d, already tracked as bug report ${existing[0].bug_report_id}) ${f.test_name}`);
      continue;
    }

    const bugReportId = randomUUID();
    const { error: bugErr } = await supabase.from("bug_reports").insert({
      id: bugReportId,
      reported_by_user_id: "qa-agent",
      reported_by_name: "QA Agent (automated)",
      page_path: f.page_path,
      description: `[Automated QA] ${f.test_name}`,
      additional_details: `${f.error_message}\n\nFrom QA run: ${RUN_URL ?? "(no run URL)"}${COMMIT_SHA ? `\nCommit: ${COMMIT_SHA}` : ""}`,
      status: "Open",
      priority: severity === "Critical" || severity === "High" ? "High" : "Medium",
    });
    if (bugErr) {
      console.error(`  Failed to file bug report for ${f.test_name}:`, bugErr.message);
      continue;
    }
    await supabase.from("qa_findings").update({ bug_report_id: bugReportId }).eq("id", findingId);
    console.log(`  Filed new bug report ${bugReportId} for ${f.test_name}`);
  }
}

main().catch((err) => {
  // A reporting failure must never fail the workflow or look like a
  // deploy-blocking error — it's logged and the run ends quietly.
  console.error("QA result reporting failed (non-fatal):", err);
});
