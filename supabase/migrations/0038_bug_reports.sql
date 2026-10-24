-- AI Bug Monitoring & Support System — "Report a Problem" (Phase 3) +
-- the "AI Support" admin dashboard (Phase 4). One table for both: Phase 3
-- only writes/reads reported_by*/page_path/description/additional_details/
-- sentry_event_id/status; priority/admin_notes/github_pr_url exist now so
-- Phase 4 doesn't need a second migration, but stay null until that admin
-- page is built. See docs/ai-bug-support/architecture-notes.md.
--
-- NOT APPLIED to the production database as part of this branch's work —
-- per the "do not modify production data/run production migrations"
-- instruction, this file is prepared and reviewed here, applied only when
-- explicitly approved (and, per the dual-mode data layer in lib/db.ts, the
-- app works perfectly without it applied at all — falls back to the
-- in-memory seed store).
create table if not exists bug_reports (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  reported_by_user_id text not null,
  reported_by_name text not null,
  page_path text not null,
  description text not null,
  additional_details text,
  sentry_event_id text,
  status text not null default 'Open',        -- Open | Investigating | Fix Proposed | Resolved
  priority text,                                -- Low | Medium | High | Urgent — set by admin (Phase 4)
  admin_notes text,                             -- investigation notes / proposed fix (Phase 4)
  github_pr_url text,                           -- linked PR once a fix is proposed (Phase 4/5)
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  resolved_at timestamptz
);
create index if not exists idx_bug_reports_status on bug_reports(status);
create index if not exists idx_bug_reports_reported_by on bug_reports(reported_by_user_id);

alter table bug_reports enable row level security;
