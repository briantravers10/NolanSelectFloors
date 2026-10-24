#!/usr/bin/env node
// Reads Playwright's JSON report, writes a qa_test_runs row + a
// qa_findings row per failure, and files genuinely new failures into the
// existing bug_reports table (the same table/dashboard Report a Problem
// and the AI Support admin page already use — see
// app/support/actions.ts and app/ai-support/page.tsx).
//
// IDENTITY: this script signs in as the dedicated "QA results writer"
// Supabase Auth user (QA_RESULTS_WRITER_EMAIL / _PASSWORD — GitHub Actions
// secrets). The session token Supabase mints for it carries the admin-set
// claim app_metadata.qa_role = 'results_writer', which is the ONLY thing
// the RLS policies in supabase/migrations/0039 and 0040 accept. No
// service-role key is used, and the public anon key alone is granted
// nothing (it's only used here as the API key supabase-js needs to call
// the auth endpoint — that's what it's for; it unlocks no table).
//
// What this identity can do, enforced by Postgres (see the migrations):
// insert/update/select qa_test_runs + qa_findings, and insert — only — a
// bug_reports row tagged reported_by_user_id='qa-agent'. It cannot read,
// update or delete any bug report, and has no policy on any other table.
// There is deliberately no code path here that tries anything else; if a
// future change did, the database would refuse it.
//
// If credentials are missing, this still exits 0 after printing a summary
// — a QA run that can't file its findings must never itself fail the
// workflow or block a deploy.
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

// A finding that's already been filed within this window is treated as
// "still being tracked" and skipped, rather than duplicated. This
// identity can't read bug_reports.status to know if it was resolved and
// reopened — so after this window, a still-failing (or freshly-failing-
// again) test gets a fresh report. A deliberate trade-off for an identity
// this narrow, not an oversight.
const DEDUPE_WINDOW_DAYS = 3;

function severityFor(testFile) {
  if (testFile.includes("/regression/")) return "High"; // a bug that already shipped once
  if (testFile.includes("/workflow/") || testFile.includes("/unit/") || testFile.includes("/security/")) return "High";
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

export async function signInAsResultsWriter(env = process.env) {
  const url = env.SUPABASE_URL;
  const anonKey = env.SUPABASE_ANON_KEY;
  const email = env.QA_RESULTS_WRITER_EMAIL;
  const password = env.QA_RESULTS_WRITER_PASSWORD;
  if (!url || !anonKey || !email || !password) return null;
  const supabase = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.session) {
    console.error("QA results writer sign-in failed:", error?.message ?? "no session");
    return null;
  }
  const claim = data.user?.app_metadata?.qa_role;
  if (claim !== "results_writer") {
    // The policies would refuse every write anyway; say so plainly here
    // instead of producing a wall of RLS errors below.
    console.error(`QA results writer account is missing app_metadata.qa_role='results_writer' (got ${JSON.stringify(claim)}) — set it in Supabase Auth → user → App Metadata.`);
    return null;
  }
  return supabase;
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

  const supabase = await signInAsResultsWriter();
  if (!supabase) {
    console.log("QA results writer credentials not configured or sign-in failed — skipping dashboard/bug-report filing (results above are the full record of this run; see the job log).");
    return;
  }

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
    console.error("Failed to write qa_test_runs row (migration 0039 applied? claim set?):", runErr.message);
    return;
  }
  console.log(`Recorded run ${runId} on the QA dashboard.`);

  const since = new Date(Date.now() - DEDUPE_WINDOW_DAYS * 86_400_000).toISOString();

  for (const f of failures) {
    const severity = severityFor(f.file);

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

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  main().catch((err) => {
    // A reporting failure must never fail the workflow or look like a
    // deploy-blocking error — it's logged and the run ends quietly.
    console.error("QA result reporting failed (non-fatal):", err);
  });
}
