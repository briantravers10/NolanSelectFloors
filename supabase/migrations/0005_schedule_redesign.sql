-- Nolan Select Floors — Schedule redesign (build 5)
-- Deliberately additive: no existing table is dropped or renamed. The
-- existing `schedule_assignments` table (crew-per-day) is kept exactly as
-- the PLANNED CREW record — every column stays meaningful. See README
-- "Schedule Redesign" section for the full write-up of the decisions below.
--
-- KEY DATA MODEL DECISION — "one row per job per day":
-- The Daily schedule view renders ONE row per JOB per DAY (not one row per
-- crew assignment). A single job can have several schedule_assignments
-- rows (one per employee) sharing the same project_id + schedule_date, and
-- they all need to share ONE schedule color, ONE COI status, ONE materials
-- status and ONE job status. Putting those fields directly on
-- schedule_assignments would mean copying/reconciling them across every
-- crew row for the same job/day (and would leave a job with zero crew
-- assigned with nowhere to hold a color/status at all — a real case, e.g.
-- the PINK "waiting on scheduling" priority). A lightweight join table,
-- `project_schedule_days` (one row per project_id + schedule_date), is the
-- cleaner model: it IS the "job entry" the Daily list renders, and
-- schedule_assignments continue to hold the per-employee crew rows
-- underneath it, unchanged.

-- =========================================================================
-- WORK TYPES — schedule-facing lookup table
-- =========================================================================
-- The existing `work_type` enum (supabase/migrations/0001_init.sql) is left
-- untouched — it continues to back `project_work_types` and
-- `pricing_formulas`, both unrelated to this phase's scope, and changing an
-- enum used across two live features to a table is a much bigger, riskier
-- migration than this phase calls for. Instead, the Schedule's own
-- per-job-per-day "work type" field gets its own small, editable table
-- (add/rename/deactivate from Company Setup), seeded from the same set of
-- values as `work_type` plus the two minimum entries the spec calls for
-- (Repair, Installation) so nothing is lost and the two lookups start in
-- sync.
create table work_types (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  name text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (company_id, name)
);
create index idx_work_types_company on work_types(company_id);

-- =========================================================================
-- PROJECT SCHEDULE DAYS — the "one row per job per day" schedule entity
-- =========================================================================
create type schedule_color as enum ('Yellow', 'Blue', 'Gray', 'Pink');
create type coi_status as enum ('Not Sent', 'Sent', 'In Progress', 'Approved');
-- Simple schedule-facing rollup, deliberately coarser than the existing,
-- more granular `material_status` enum used by `project_materials` (Needed,
-- Quote Requested, Ordered, Partially Delivered, Delivered, Problem,
-- Returned). Forcing that 7-value enum onto a quick-glance schedule control
-- would violate the "dead simple" requirement, so the schedule gets its own
-- 3-value rollup instead; the detailed per-material statuses keep living on
-- the Materials feature untouched.
create type schedule_materials_status as enum ('Not Ordered', 'Ordered', 'Sent/Delivered');
-- Separate from the existing granular `project_status` / `pipeline_stage`.
-- See README for the exact pipeline_stage <-> job_status mapping; setting
-- this from the Schedule always updates the real `projects.pipeline_stage`
-- too (never an isolated duplicate).
create type schedule_job_status as enum ('Scheduled', 'In Progress', 'Complete');

create table project_schedule_days (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  project_id uuid not null references projects(id) on delete cascade,
  schedule_date date not null,
  schedule_color schedule_color not null default 'Pink',
  coi_status coi_status not null default 'Not Sent',
  materials_status schedule_materials_status not null default 'Not Ordered',
  job_status schedule_job_status not null default 'Scheduled',
  work_type_id uuid references work_types(id) on delete set null,
  notes text,
  created_by text,
  updated_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, schedule_date)
);
create index idx_schedule_days_company_date on project_schedule_days(company_id, schedule_date);
create index idx_schedule_days_project on project_schedule_days(project_id);

-- =========================================================================
-- ACTUAL LABOR ENTRIES — actual hours worked, separate from the planned
-- schedule_assignments rows above. An employee can have MULTIPLE entries on
-- the same day across different jobs (e.g. 4 hrs on Job A, 4 hrs on Job B).
-- Never overwrites schedule_assignments; both are kept side by side.
-- =========================================================================
create table actual_labor_entries (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  employee_id uuid not null references employees(id) on delete cascade,
  project_id uuid not null references projects(id) on delete cascade,
  work_date date not null,
  hours numeric(5,2) not null check (hours > 0),
  start_time text,
  end_time text,
  notes text,
  created_by text,
  updated_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_actual_labor_company_date on actual_labor_entries(company_id, work_date);
create index idx_actual_labor_employee_date on actual_labor_entries(employee_id, work_date);
create index idx_actual_labor_project on actual_labor_entries(project_id);

-- =========================================================================
-- DAILY SCHEDULE CONFIRMATIONS — "Confirm Day" from the End-of-Day Review.
-- Does NOT lock the day; one row per (company, date), upsert-style —
-- re-confirming just updates confirmed_by/confirmed_at, itself logged via
-- activity_log like every other schedule change.
-- =========================================================================
create table daily_schedule_confirmations (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  work_date date not null,
  confirmed_by text not null,
  confirmed_at timestamptz not null default now(),
  notes text,
  unique (company_id, work_date)
);
create index idx_daily_confirmations_company_date on daily_schedule_confirmations(company_id, work_date);

-- =========================================================================
-- ACTIVITY LOG — no schema change needed. `activity_log` already carries a
-- free-text `action` + `detail` and a nullable `related_type`/`related_id`
-- (existing `related_record_type` enum already includes 'project' and
-- 'employee', which cover every schedule change this phase logs: crew
-- assignment changes, schedule color/COI/materials/job status changes
-- (related_type 'project'), actual-hours entries/edits (related_type
-- 'employee' or 'project'), and day confirmations (related_type left null,
-- the date goes in `detail`). See lib/db.ts for the new logging call sites.
-- =========================================================================

-- =========================================================================
-- SEED: work_types, one row per existing company (there is exactly one in
-- this app's current single-tenant demo data, but this stays generic).
-- =========================================================================
insert into work_types (company_id, name, active)
select c.id, wt.name, true
from companies c
cross join (values
  ('Hardwood Installation'), ('Floor Sanding'), ('Staining'), ('Finishing'),
  ('LVP Installation'), ('Laminate Installation'), ('Carpet Installation'),
  ('Tile'), ('Demolition'), ('Floor Preparation'), ('Subfloor Repair'),
  ('Baseboard/Trim'), ('Furniture Moving'), ('Repairs'), ('Other'),
  ('Installation'), ('Repair')
) as wt(name)
on conflict (company_id, name) do nothing;

-- =========================================================================
-- BACKFILL: one project_schedule_days row per existing distinct
-- (project_id, schedule_date) pair already present in schedule_assignments,
-- so historical/current planned schedule data isn't orphaned. Color is a
-- simple heuristic: the earliest scheduled date for a project = Blue
-- ("starting"), every later date = Gray ("continuation"). job_status is
-- derived from the project's current pipeline_stage using the same mapping
-- documented in README / lib/schedule.ts.
-- =========================================================================
insert into project_schedule_days (company_id, project_id, schedule_date, schedule_color, coi_status, materials_status, job_status, created_by)
select
  sa.company_id,
  sa.project_id,
  sa.schedule_date,
  case when sa.schedule_date = min(sa.schedule_date) over (partition by sa.project_id) then 'Blue' else 'Gray' end::schedule_color,
  'Not Sent'::coi_status,
  'Not Ordered'::schedule_materials_status,
  case
    when p.pipeline_stage = 'Project Completed' then 'Complete'
    when p.pipeline_stage in ('Sent to Crew', 'Project In Process') then 'In Progress'
    else 'Scheduled'
  end::schedule_job_status,
  'Migration backfill'
from (select distinct company_id, project_id, schedule_date from schedule_assignments) sa
join projects p on p.id = sa.project_id
on conflict (project_id, schedule_date) do nothing;
