-- Lets the QA results writer (see 0039_qa_tracking.sql's header for the
-- identity model) file a bug report for a genuinely new QA-detected
-- failure, and nothing else.
--
-- bug_reports has had RLS enabled with NO policies since 0038 — only the
-- service-role key (the main app's own data layer) can touch it. This
-- adds exactly one narrow INSERT policy: a token carrying the admin-set
-- `app_metadata.qa_role = 'results_writer'` claim may insert a row, and
-- only one tagged as the QA agent's own (reported_by_user_id =
-- 'qa-agent'). There is still no SELECT, UPDATE or DELETE policy on this
-- table for any authenticated user — so even the results writer cannot
-- read any report (QA-filed or human-filed), cannot change
-- admin_notes/status/priority on anything, and cannot touch an existing
-- row. The public anon key and every normal staff login get nothing here.
--
-- NOT APPLIED to production as part of this branch's work — applied only
-- when explicitly approved, after 0039.
create policy qa_writer_insert_bug_reports
  on bug_reports
  for insert
  to authenticated
  with check (public.is_qa_results_writer() and reported_by_user_id = 'qa-agent');
