-- Nolan Select Floors — regions, map coordinates, call times, photo categories
-- Deliberately additive: no existing table dropped/renamed, no existing
-- column repurposed. See lib/types.ts for the matching TypeScript shapes
-- and lib/seed-data.ts for the backfilled values used by the in-memory
-- fallback + `npm run seed`.

-- =========================================================================
-- BUILDINGS: region + approximate map coordinates
-- =========================================================================

create type building_region as enum (
  'Manhattan', 'Brooklyn', 'Queens', 'Bronx', 'Staten Island',
  'New Jersey', 'Long Island', 'Other'
);

alter table buildings
  add column region building_region not null default 'Other',
  add column latitude numeric(9,6),
  add column longitude numeric(9,6);

create index idx_buildings_region on buildings(region);

-- =========================================================================
-- SCHEDULE ASSIGNMENTS: per-worker call time (reporting time)
-- =========================================================================
-- Free-form text rather than a `time` column so it can hold values like
-- "7:00 AM" without timezone handling, matching how the rest of the app's
-- schedule dates/times are stored and displayed.

alter table schedule_assignments
  add column call_time text default '7:00 AM';

-- =========================================================================
-- PHOTOS: progress-entry category + storage-unavailable flag
-- =========================================================================

create type photo_category as enum ('Before', 'Progress', 'After', 'Floor Plan', 'Other');

alter table photos
  add column category photo_category default 'Progress',
  add column storage_unavailable boolean not null default false;

-- =========================================================================
-- CLIENT COMPANIES: fields needed by the new "New Client" form
-- =========================================================================

alter table client_companies
  add column website text,
  add column ap_contact_name text,
  add column ap_contact_phone text,
  add column ap_contact_email text,
  add column relationship_start_date date,
  add column active boolean not null default true;
