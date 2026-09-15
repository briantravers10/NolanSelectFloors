-- Nolan Select Floors — bid workflow / pipeline extension
-- Adds bid ownership + atomic claiming, a 6-stage primary project pipeline,
-- and simulated office estimator users, on top of the existing schema in
-- 0001_init.sql. Deliberately additive: no existing table is dropped or
-- renamed, and no existing column changes meaning, so old rows and old
-- pages keep working unchanged.
--
-- Reconciliation with the existing `project_status` enum (13 granular
-- states, "Approved" through "Paid"): that enum is kept as-is and still
-- represents fine-grained sub-status. A NEW `pipeline_stage` column carries
-- the 6 primary lifecycle stages requested for the Bid → Project pipeline:
--   Project Bid -> Bid Accepted -> Scheduled -> Sent to Crew
--   -> Project In Process -> Project Completed
-- `pipeline_stage` is authoritative for the kanban Pipeline view and the
-- Bid Dashboard; `status` remains authoritative for the existing detailed
-- Projects list/detail "Move to Status" control. Both live on the SAME
-- `projects` row — a project is still entered once and never duplicated.

-- =========================================================================
-- ENUM TYPES
-- =========================================================================

create type pipeline_stage as enum (
  'Project Bid', 'Bid Accepted', 'Scheduled', 'Sent to Crew',
  'Project In Process', 'Project Completed'
);

create type bid_status as enum (
  'Unclaimed', 'Claimed', 'In Progress', 'Ready for Review',
  'Completed/Sent', 'Accepted', 'Rejected'
);

create type office_user_role as enum ('estimator', 'manager');

-- =========================================================================
-- OFFICE USERS (simulated — placeholder for real per-user auth)
-- =========================================================================
-- Stands in for logged-in office staff until real auth exists. The app's
-- "acting as" dev selector picks one of these (or the existing
-- company_owner in `users`) and every claim/reassign/release records that
-- choice. See README "Dev user selector / future auth" section.

create table office_users (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  full_name text not null,
  email text,
  role office_user_role not null default 'estimator',
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create index idx_office_users_company on office_users(company_id);

-- =========================================================================
-- PROJECTS: bid ownership + pipeline stage + lifecycle timestamps
-- =========================================================================

alter table projects
  add column pipeline_stage pipeline_stage not null default 'Project Bid',
  add column bid_status bid_status not null default 'Unclaimed',
  add column assigned_estimator_id uuid references office_users(id) on delete set null,
  add column claimed_at timestamptz,
  -- Set-once lifecycle timestamps. Application code (lib/db.ts) is
  -- responsible for only ever setting each of these the first time a
  -- project reaches that point — never overwriting on a later revisit —
  -- so they stay reliable inputs for future turnaround/duration reports.
  add column bid_claimed_at timestamptz,
  add column bid_completed_at timestamptz,
  add column bid_sent_at timestamptz,
  add column bid_accepted_at timestamptz,
  add column scheduled_at timestamptz,
  add column sent_to_crew_at timestamptz,
  add column project_started_at timestamptz,
  add column project_completed_at timestamptz;

create index idx_projects_pipeline_stage on projects(pipeline_stage);
create index idx_projects_bid_status on projects(bid_status);
create index idx_projects_assigned_estimator on projects(assigned_estimator_id);

-- =========================================================================
-- ACTIVITY LOG: no schema change needed — `activity_log` already has a
-- free-text `action` + `detail`, which is what every new audit event in
-- this migration's application code (bid claimed/reassigned/released,
-- duplicate-bid override, pipeline stage changes, etc.) writes into.
-- =========================================================================
