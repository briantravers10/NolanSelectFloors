-- Lets the QA agent's restricted credential (the public anon key, scoped
-- entirely by RLS — see 0039_qa_tracking.sql's header comment) file a new
-- bug report for a genuinely new QA-detected failure, and nothing else.
--
-- bug_reports has had RLS enabled with NO policies since 0038 — meaning
-- only the service-role key (which the main app already uses, and which
-- bypasses RLS) can touch it. This adds exactly one narrow INSERT policy:
-- the QA agent may insert a row, but ONLY one tagged as its own
-- (reported_by_user_id = 'qa-agent'), and there is still no SELECT,
-- UPDATE, or DELETE policy for anon on this table at all — so this
-- credential cannot read any report (QA-filed or human-filed), cannot
-- edit admin_notes/status/priority on anything, and cannot touch an
-- existing row in any way. That's enforced by Postgres, not by this
-- branch's code: even if a future change to qa/lib/report-results.mjs
-- tried to read or update a bug_reports row with this key, the database
-- would refuse it.
--
-- NOT APPLIED to production as part of this branch's work — applied only
-- when explicitly approved, alongside 0039.
create policy qa_agent_insert_bug_reports
  on bug_reports
  for insert
  to anon
  with check (reported_by_user_id = 'qa-agent');
