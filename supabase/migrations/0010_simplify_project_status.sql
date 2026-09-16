-- Nolan Select Floors — Project Pipeline Stage Simplification (build 9)
--
-- The client's own words: "When a project is started, all i need is bid
-- send, bid accepted, scheduled, in progress and then complete. I dont need
-- any more info on the status of the job. Use the same colour scheme from
-- earlier. The status options i have here is way too much info."
--
-- This collapses the two overlapping status concepts that previously lived
-- on `projects` (see 0001_init.sql / 0002_bid_workflow.sql) into ONE:
--   - `pipeline_stage` (6 values: Project Bid, Bid Accepted, Scheduled,
--     Sent to Crew, Project In Process, Project Completed) is narrowed to
--     5 values: Bid Sent, Bid Accepted, Scheduled, In Progress, Complete.
--       Project Bid         -> Bid Sent
--       Bid Accepted        -> Bid Accepted
--       Scheduled           -> Scheduled
--       Sent to Crew        -> In Progress   (merged — no longer a separate stage)
--       Project In Process  -> In Progress
--       Project Completed   -> Complete
--   - the separate `status` column (13-value `project_status` enum:
--     Approved..Paid, the "Move to Detailed Status" control) is DROPPED
--     entirely rather than kept-but-hidden. Every place that read it for
--     "is this project still active" filtering (Buildings, Clients,
--     Materials, Reports, Haul-Away — see lib/calculations.ts
--     isActiveProjectStage()) has been re-pointed to the simplified
--     `pipeline_stage` (active until it reaches "Complete"); nothing else
--     in the app read `status` for logic (materials-required flagging on
--     the Dashboard was already keyed off the schedule-level
--     `project_schedule_days.materials_status` / `project_materials`,
--     never off this column — see lib/dashboard.ts). With nothing left
--     depending on it, keeping it around unused (and unrendered) would
--     just be dead schema the next person has to figure out is safe to
--     ignore — see README "Project Pipeline Stage Simplification" for the
--     full reasoning.
--
-- `bid_status` (Unclaimed/Claimed/...) is UNTOUCHED — it's a separate field
-- from pipeline_stage and this migration doesn't rename or reinterpret it.

-- =========================================================================
-- STEP 1: narrow the `pipeline_stage` enum to 5 values, backfilling rows
-- =========================================================================
-- Postgres can't remove/rename enum values in place cleanly (and a value
-- like "Sent to Crew" needs to MAP onto a value that already exists on
-- other rows, "In Progress", not just be renamed) — so this swaps in a new
-- enum type via a temporary column, same technique as any other
-- "reshape an enum with real data behind it" migration.

create type pipeline_stage_new as enum ('Bid Sent', 'Bid Accepted', 'Scheduled', 'In Progress', 'Complete');

alter table projects add column pipeline_stage_new pipeline_stage_new;

update projects set pipeline_stage_new = (case pipeline_stage
  when 'Project Bid' then 'Bid Sent'
  when 'Bid Accepted' then 'Bid Accepted'
  when 'Scheduled' then 'Scheduled'
  when 'Sent to Crew' then 'In Progress'
  when 'Project In Process' then 'In Progress'
  when 'Project Completed' then 'Complete'
end)::pipeline_stage_new;

alter table projects alter column pipeline_stage_new set not null;
alter table projects alter column pipeline_stage_new set default 'Bid Sent';

-- Dropping the old column cascades to drop idx_projects_pipeline_stage
-- (created in 0002_bid_workflow.sql) automatically.
alter table projects drop column pipeline_stage;
alter table projects rename column pipeline_stage_new to pipeline_stage;

drop type pipeline_stage;
alter type pipeline_stage_new rename to pipeline_stage;

create index idx_projects_pipeline_stage on projects(pipeline_stage);

-- NOTE: `sent_to_crew_at` (added in 0002_bid_workflow.sql) is left in place
-- as a harmless, no-longer-written column — "Sent to Crew" is now folded
-- into "In Progress" and application code (lib/db.ts) no longer stamps it
-- on new transitions, but existing historical timestamps are preserved
-- rather than destructively dropped for a column that costs nothing to
-- keep.

-- =========================================================================
-- STEP 2: drop the old detailed `status` column + its enum
-- =========================================================================
-- Dropping the column cascades to drop idx_projects_status automatically.
alter table projects drop column status;
drop type project_status;

-- =========================================================================
-- PHOTOS — add optional `title`, per the client's own words ("photos with
-- titles on them (optional)"). `category` already doubles as the album a
-- photo is grouped into, so no separate `album` column is added — see
-- README "Photos & Drawings".
-- =========================================================================
alter table photos add column title text;

-- =========================================================================
-- DRAWINGS — new Procore-inspired "Drawings" tool: a project's plan files
-- with version history. Uploading a new version of an existing drawing
-- inserts a NEW row (never updates/deletes the old one) at version + 1 with
-- is_current_version = true, and flips the previous current row's
-- is_current_version to false. See lib/types.ts ProjectDrawing / README.
-- =========================================================================
create table project_drawings (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  project_id uuid not null references projects(id) on delete cascade,
  drawing_name text not null,
  drawing_number text,
  version integer not null default 1,
  file_reference text,
  is_current_version boolean not null default true,
  uploaded_by text,
  uploaded_at timestamptz not null default now(),
  notes text,
  -- Same soft-fail storage pattern as photos.storage_unavailable — set when
  -- an upload was attempted but Supabase Storage wasn't configured.
  storage_unavailable boolean,
  created_at timestamptz not null default now()
);
create index idx_project_drawings_project on project_drawings(project_id);
create index idx_project_drawings_company on project_drawings(company_id);
create index idx_project_drawings_current on project_drawings(project_id, is_current_version);

-- Audit logging reuses the existing `activity_log` table (related_type
-- 'project'), same as every other feature in this codebase — see
-- lib/db.ts createProjectDrawing(). No schema change needed for logging.
