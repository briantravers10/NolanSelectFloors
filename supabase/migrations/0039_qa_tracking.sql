-- Autonomous QA Testing Agent — run history + findings. See
-- qa/README.md for the full design and app/qa/page.tsx for the
-- admin-only dashboard that reads these tables.
--
-- NOT APPLIED to the production database as part of this branch's work —
-- same convention as 0038_bug_reports.sql: prepared and reviewed here,
-- applied only when explicitly approved. The dual-mode data layer in
-- lib/db.ts means the app (including the QA dashboard, which just shows
-- an empty state) works fine without it applied.
--
-- CREDENTIAL MODEL (revised twice — see qa/README.md "Credential model"):
-- the GitHub Actions workflow writes results as a dedicated Supabase Auth
-- user ("QA results writer"). It signs in with email + password, so it
-- holds an ordinary `authenticated` session token minted by Supabase
-- itself — nothing custom is signed or minted by us. What makes that
-- token special is one claim Supabase embeds in every access token:
-- `app_metadata`. app_metadata can ONLY be set through the Admin API /
-- dashboard (service role); a user can never change their own. The
-- policies below require `app_metadata.qa_role = 'results_writer'`.
--
-- Consequences, all enforced by Postgres, not by any script:
--   * The public anon key gets nothing here (no `to anon` policy exists).
--   * Any other authenticated user (every real staff login) gets nothing
--     here — their token has no qa_role claim.
--   * The results writer gets insert/update/select on these two tables
--     only. Every other table in this database has RLS enabled with zero
--     policies for authenticated (verified against the live project), so
--     this identity cannot read or write anything else.
--   * Rotating/revoking is deleting that one auth user or clearing its
--     app_metadata — no key material to chase.
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

-- One place to define "is this the QA results writer". STABLE so Postgres
-- evaluates it once per statement; reads only the request's JWT claims.
-- `coalesce` makes a missing claim (anon, or any normal staff login)
-- evaluate to false rather than null.
create or replace function public.is_qa_results_writer()
returns boolean
language sql
stable
as $$
  select coalesce((auth.jwt() -> 'app_metadata' ->> 'qa_role') = 'results_writer', false);
$$;

create policy qa_writer_insert_test_runs on qa_test_runs for insert to authenticated with check (public.is_qa_results_writer());
create policy qa_writer_update_test_runs on qa_test_runs for update to authenticated using (public.is_qa_results_writer()) with check (public.is_qa_results_writer());
create policy qa_writer_select_test_runs on qa_test_runs for select to authenticated using (public.is_qa_results_writer());

create policy qa_writer_insert_findings on qa_findings for insert to authenticated with check (public.is_qa_results_writer());
create policy qa_writer_update_findings on qa_findings for update to authenticated using (public.is_qa_results_writer()) with check (public.is_qa_results_writer());
create policy qa_writer_select_findings on qa_findings for select to authenticated using (public.is_qa_results_writer());
