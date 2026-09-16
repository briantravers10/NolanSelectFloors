-- Nolan Select Floors — "Items to Order / Collect" on the schedule (build 8)
--
-- The client's own words: "sometimes they have to add items like collect 3
-- buckets of glue etc, so i need a section when creating the schedule to
-- add items that need to be ordered or collected."
--
-- Deliberately NOT the same as the existing, heavier `project_materials`
-- system (supplier/cost/delivery-date tracking for real material orders at
-- the project level, see 0001_init.sql / README "Materials"). This is a
-- fast, per-schedule-entry checklist for quick pickups a crew needs for one
-- specific day's job — "3 buckets of glue", "roll of blue tape", "pick up
-- dumpster key from super". One free-text `description` field is enough —
-- the quantity, if any, is just typed into the text (as the client's own
-- example shows) rather than split into a separate column, per the "don't
-- over-engineer this" instruction. Two statuses (a checkbox-equivalent) are
-- enough — no need for the Materials system's richer status enum.
create type schedule_pickup_status as enum ('Needed', 'Collected');

create table schedule_pickup_items (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  project_schedule_day_id uuid not null references project_schedule_days(id) on delete cascade,
  description text not null,
  status schedule_pickup_status not null default 'Needed',
  created_by text,
  updated_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_schedule_pickup_items_day on schedule_pickup_items(project_schedule_day_id);
create index idx_schedule_pickup_items_company on schedule_pickup_items(company_id);

-- Audit logging reuses the existing `activity_log` table (related_type
-- 'project', related_id = the project_schedule_days row's project_id) —
-- see lib/db.ts createSchedulePickupItem / toggleSchedulePickupItemStatus /
-- deleteSchedulePickupItem. No schema change needed for logging.
