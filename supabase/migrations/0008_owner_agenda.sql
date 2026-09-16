-- Nolan Select Floors — Owner's Personal Agenda (build 8)
--
-- SEPARATE from the operational job Schedule (`schedule_assignments`,
-- 0005_schedule_redesign.sql) — that table is crew/job dispatch for a
-- specific project + date. This is the OWNER'S OWN calendar: his meetings,
-- site visits and personal reminders, which may or may not relate to a
-- job/client at all. Nothing here reads from or writes to
-- `schedule_assignments`, and vice versa.
--
-- OWNER IDENTIFIER: there is no per-user auth table beyond `office_users`
-- (see lib/current-user.ts) — the whole app runs as a single dev "acting
-- as" persona, with the sentinel id "owner" standing in for the
-- company_owner/Brian Travers role (see OWNER_ACTING_ID in
-- lib/current-user.ts). `owner_user_id` below is a plain text column that
-- stores that same identifier (or a future real office_users.id /
-- auth.users.id once real per-user login exists) rather than a foreign key
-- into a users table that doesn't exist yet.
--
-- GOOGLE CALENDAR SYNC — modeled now, not built: `source` marks whether an
-- event was entered by hand or synced in from Google, and
-- `external_event_id` is a placeholder slot for the Google event id so a
-- future sync can upsert instead of duplicating. See lib/google-calendar.ts
-- and README "Owner's Agenda & Future Google Calendar Sync" — no live
-- Google API call is made anywhere in this codebase yet.

create type agenda_event_source as enum ('Manual', 'Google Calendar');

create table agenda_events (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  owner_user_id text not null default 'owner',
  title text not null,
  event_date date not null,
  start_time time,
  end_time time,
  location text,
  notes text,
  -- Optional link to whatever this event is about (a management company
  -- check-in, a site visit tied to a project) — same RelatedRecordType
  -- shape used by tasks/communications/documents/photos elsewhere in this
  -- app (see lib/types.ts RelatedRecordType), stored as plain text here
  -- since agenda_events has no FK constraint to any one of those tables.
  related_type text,
  related_id uuid,
  source agenda_event_source not null default 'Manual',
  -- Placeholder for a future Google Calendar event id, so a real sync can
  -- recognize "this Google event already has a row here" and update it in
  -- place instead of creating a duplicate. Always null until that sync is
  -- built.
  external_event_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_agenda_events_company on agenda_events(company_id);
create index idx_agenda_events_owner_date on agenda_events(owner_user_id, event_date);
-- Prevents a future sync from inserting the same Google event twice for a
-- given owner (a partial index since it only matters once external_event_id
-- is actually populated).
create unique index idx_agenda_events_external_unique on agenda_events(owner_user_id, external_event_id) where external_event_id is not null;
