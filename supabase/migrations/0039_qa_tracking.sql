-- Autonomous QA Testing Agent — run history + findings. See
-- qa/README.md for the full design and app/qa/page.tsx for the
-- admin-only dashboard that reads these tables.
--
-- NOT APPLIED to the production database as part of this branch's work —
-- same convention as 0038_bug_reports.sql: prepared and reviewed here,
-- applied only when explicitly approved. The dual-mode data layer in
-- lib/db.ts means the app (including the QA dashboard, which just shows
-- an empty state) works fine without it applied — nothing breaks by
-- merging this branch before the migration runs.
--
-- CREDENTIAL MODEL (changed after review — see the chat where this was
-- raised): the GitHub Actions QA workflow does NOT use a Supabase
-- service-role key. It uses the same public anon key the app's own
-- client bundle already ships (NEXT_PUBLIC_SUPABASE_ANON_KEY — not a
-- secret), restricted entirely by the RLS policies below. That is a
-- genuinely enforced restriction at the database level, not a "the code
-- just happens to only call these tables" promise: even a compromised or
-- misused copy of this key cannot read or write anything outside what
-- these policies allow, full stop, regardless of what any script,
-- instruction, or bug tells it to do.
create table if not exists qa_test_runs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  trigger text not null,                        -- scheduled | deployment | manual
  status text not null default 'running',       -- running | passed | failed | error
  total_tests integer not null default 0,
  passed_tests integer not null default 0,
  failed_tests integer not null default 0,
  skipped_tests integer not null default 0,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  github_run_url text,
  commit_sha text,
  notes text
);
create index if not exists idx_qa_test_runs_started_at on qa_test_runs(started_at desc);

create table if not exists qa_findings (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  run_id uuid not null references qa_test_runs(id) on delete cascade,
  test_name text not null,
  page_path text not null,
  severity text not null default 'Medium',      -- Low | Medium | High | Critical
  error_message text not null,
  screenshot_path text,
  -- Set once filed into bug_reports, so a still-failing test on the next
  -- run is recognized as already reported instead of duplicated — see
  -- qa/lib/report-results.mjs.
  bug_report_id uuid references bug_reports(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists idx_qa_findings_run_id on qa_findings(run_id);
create index if not exists idx_qa_findings_bug_report_id on qa_findings(bug_report_id);

alter table qa_test_runs enable row level security;
alter table qa_findings enable row level security;

-- No sensitive business data lives in either table (test names, page
-- paths, pass/fail counts, generic error text) — anon may insert, update
-- (to set finished_at/counts after a run) and select (so the INSERT can
-- return its row and qa_findings' duplicate check can read back) freely
-- on just these two tables. This is deliberately NOT the same grant as
-- bug_reports — see 0040_qa_agent_bug_report_policy.sql.
create policy qa_agent_insert_test_runs on qa_test_runs for insert to anon with check (true);
create policy qa_agent_update_test_runs on qa_test_runs for update to anon using (true) with check (true);
create policy qa_agent_select_test_runs on qa_test_runs for select to anon using (true);

create policy qa_agent_insert_findings on qa_findings for insert to anon with check (true);
create policy qa_agent_update_findings on qa_findings for update to anon using (true) with check (true);
create policy qa_agent_select_findings on qa_findings for select to anon using (true);
