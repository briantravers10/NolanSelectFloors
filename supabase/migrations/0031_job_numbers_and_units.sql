-- Permanent job numbers + minimal Building -> Unit structure.
--
-- Safety properties (see task spec): deterministic and idempotent —
-- running this file twice makes no further changes the second time.
-- Never renumbers an already-numbered project, never touches created_at,
-- never recreates/deletes/merges any existing row.

-- =====================================================================
-- 1. Permanent job numbers
-- =====================================================================

create sequence if not exists project_job_number_seq;

alter table projects add column if not exists job_number integer;

-- Deterministic backfill for legacy rows only (job_number is null).
-- Order: created_at ascending, id as a tiebreaker for identical
-- created_at values — oldest project becomes the lowest job number.
-- On a second run this WHERE clause matches zero rows, so it's a no-op.
update projects p
set job_number = sub.rn + 10000
from (
  select id, row_number() over (order by created_at asc, id asc) as rn
  from projects
  where job_number is null
) sub
where p.id = sub.id;

-- Advance the sequence past the highest assigned number so the very next
-- INSERT (which will rely on the column default below) can never collide
-- with a backfilled number. Idempotent: re-running with the same max is a
-- no-op; a higher existing max (e.g. after a second backfill batch) only
-- ever advances it further, never back.
select setval('project_job_number_seq', greatest((select coalesce(max(job_number), 10000) from projects), 10000), true);

-- All FUTURE inserts get their number from the sequence at insert time
-- (atomic under concurrent writes) — application code never computes or
-- sets job_number itself (no client-side MAX()+1 pattern).
alter table projects alter column job_number set default nextval('project_job_number_seq');
alter sequence project_job_number_seq owned by projects.job_number;

-- Only safe to enforce once every row has a value — true at this point
-- for this dataset (verified: 0 rows had null/duplicate created_at before
-- this migration, and the backfill above covers every remaining null).
alter table projects alter column job_number set not null;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'projects_job_number_key') then
    alter table projects add constraint projects_job_number_key unique (job_number);
  end if;
end $$;

comment on column projects.job_number is
  'Permanent, human-readable job number (starts at 10001). Assigned once, '
  'automatically, via project_job_number_seq — never editable by the '
  'application and never reused, even if the project is later deleted.';

-- =====================================================================
-- 2. Units (minimal Building -> Unit -> Job structure)
-- =====================================================================
-- Reuses the existing buildings table; adds only the one new entity the
-- task needs (a persistent unit), rather than a larger property model.

create table if not exists units (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  building_id uuid not null references buildings(id) on delete cascade,
  unit_number text not null,
  created_at timestamptz not null default now(),
  unique (building_id, unit_number)
);

alter table units enable row level security;

create index if not exists idx_units_building_id on units(building_id);

alter table projects add column if not exists unit_id uuid references units(id) on delete set null;

create index if not exists idx_projects_unit_id on projects(unit_id);
create index if not exists idx_projects_building_id on projects(building_id);

-- Backfill: link a project to a unit ONLY when its existing unit_number
-- text is a single, unambiguous value (no comma/ampersand/slash/semicolon
-- and no "and" — those denote more than one unit and are left unlinked
-- rather than guessed at). projects.unit_number itself is never modified,
-- so nothing already displayed anywhere changes. Whitespace-only trimming
-- is applied when matching/creating a unit row — not case-folding, since
-- no case collision exists in the current data (verified beforehand).
insert into units (company_id, building_id, unit_number)
select distinct p.company_id, p.building_id, btrim(p.unit_number)
from projects p
where p.unit_number is not null
  and btrim(p.unit_number) <> ''
  and p.unit_number !~ '[,&/;]'
  and p.unit_number !~* '\yand\y'
on conflict (building_id, unit_number) do nothing;

update projects p
set unit_id = u.id
from units u
where p.unit_id is null
  and p.unit_number is not null
  and btrim(p.unit_number) <> ''
  and p.unit_number !~ '[,&/;]'
  and p.unit_number !~* '\yand\y'
  and u.building_id = p.building_id
  and u.unit_number = btrim(p.unit_number);
