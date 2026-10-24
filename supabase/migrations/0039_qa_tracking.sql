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
-- Every write to these two tables comes from the GitHub Actions QA
-- workflow using a Supabase service-role key stored as a GitHub Actions
-- secret (never committed, never exposed to the live app or employees).
-- Nothing in the app itself ever writes here.
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
  -- qa/lib/report-finding.ts.
  bug_report_id uuid references bug_reports(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists idx_qa_findings_run_id on qa_findings(run_id);
create index if not exists idx_qa_findings_bug_report_id on qa_findings(bug_report_id);

alter table qa_test_runs enable row level security;
alter table qa_findings enable row level security;
