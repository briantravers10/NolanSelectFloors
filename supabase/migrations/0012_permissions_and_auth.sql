-- Nolan Select Floors — Per-Staff Permissions & Real-Auth Readiness (build 11)
--
-- The client, in his own words: "I need to be able to give everyone their
-- own access. My friend will have the owner access and then he can select
-- what staff members can or cant see. Some of the project managers only
-- need to be able to see and or edit certain things so i need options for
-- what they can do and if they can edit also."
--
-- Two decisions already made with the client (see README "Permissions &
-- Staff Access"): (1) login method = email + password, not magic link —
-- see lib/auth.ts; (2) permission granularity = per-nav-section
-- View / No-Access / Full-Edit, set per staff member by the Owner/Admin.
--
-- DATA-MODEL DECISION: extends `office_users` (added in
-- 0002_bid_workflow.sql) rather than creating a new `staff_accounts`
-- table. office_users already *is* this app's staff-accounts table — it
-- has full_name/email/role/active, and 0006_labor_cost_tracking.sql
-- already extended it once before with access_role. Its `role` column
-- name (estimator/manager) is a legacy holdover from the bid-claim
-- workflow, not a scope limitation: every acting-user persona in the app
-- (see lib/current-user.ts listActingUserOptions()) is already backed by
-- a row here. A second table would just fork the staff directory in two
-- and require a join everywhere office_users is already read. See README
-- for the full write-up.

-- =========================================================================
-- office_users: real-auth readiness + Owner flag
-- =========================================================================
alter table office_users
  add column auth_user_id text,
  add column is_owner boolean not null default false;

-- Email is already a plain nullable text column (0002_bid_workflow.sql).
-- Make it unique once set — required for real Supabase Auth sign-in later
-- (email+password) and for "Add Staff Account" to reject duplicates now.
create unique index idx_office_users_email on office_users(email) where email is not null;

comment on column office_users.auth_user_id is
  'Supabase Auth user id, once a real account exists for this person. Null in demo mode — see lib/auth.ts "Activating Real Login".';
comment on column office_users.is_owner is
  'Unrestricted access to every section, always — not subject to section_permissions. Only another is_owner user may grant this (see app/company-setup/staff-access).';

-- =========================================================================
-- SECTION_PERMISSIONS — one row per (staff member, nav section) with the
-- access level the Owner/Admin has granted. No row = 'none' (secure by
-- default) — see lib/permissions.ts getSectionAccess().
-- =========================================================================
create type section_access_level as enum ('none', 'view', 'edit');

create table section_permissions (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  office_user_id uuid not null references office_users(id) on delete cascade,
  -- Free text, not a Postgres enum: matches lib/types.ts SECTION_KEYS,
  -- which is expected to grow as the app grows (new nav sections) without
  -- a migration to widen a DB enum every time.
  section_key text not null,
  access_level section_access_level not null default 'none',
  updated_by text,
  updated_at timestamptz not null default now(),
  unique (office_user_id, section_key)
);
create index idx_section_permissions_user on section_permissions(office_user_id);
create index idx_section_permissions_company on section_permissions(company_id);

-- =========================================================================
-- SEED — demonstrates the client's exact scenario (README "Permissions &
-- Staff Access" has the full table). Reuses the 3 existing office_users
-- seeded in 0006_labor_cost_tracking.sql.
-- =========================================================================

-- Sarah Bennett — the Owner/Admin ("my friend"). Full, unrestricted
-- access to everything, always — no section_permissions rows needed.
update office_users set is_owner = true where full_name = 'Sarah Bennett';

-- Emma Castillo — office estimator with edit access to most day-to-day
-- operational sections, but only VIEW on Company Setup / QuickBooks
-- (connection management stays Owner/Admin-only per the existing
-- access_role gate in lib/current-user.ts canManageQuickBooksConnection).
insert into section_permissions (company_id, office_user_id, section_key, access_level)
select company_id, id, section_key, 'edit'::section_access_level
from office_users, unnest(array[
  'dashboard','clients','buildings','job_requests','projects','schedule',
  'staff','materials','pricing','invoices','tasks','new_business','reports'
]) as section_key
where full_name = 'Emma Castillo';

insert into section_permissions (company_id, office_user_id, section_key, access_level)
select company_id, id, s, 'view'::section_access_level
from office_users, unnest(array['company_setup','quickbooks']) as s
where full_name = 'Emma Castillo';

-- David Okoye — the "project manager only needs to see certain things"
-- persona the client described: view-only, and only on a subset of
-- sections (Dashboard, Schedule, Projects, Tasks). No Pricing, no Staff
-- (pay rates), no Invoices, no QuickBooks, no Company Setup — those stay
-- at the secure-by-default 'none' (no row).
insert into section_permissions (company_id, office_user_id, section_key, access_level)
select company_id, id, section_key, 'view'::section_access_level
from office_users, unnest(array['dashboard','schedule','projects','tasks']) as section_key
where full_name = 'David Okoye';
