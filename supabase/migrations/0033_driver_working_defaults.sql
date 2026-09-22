-- Drivers Working Today should be opt-OUT, not opt-in: every active driver
-- is assumed working on a date until someone unchecks them. A plain
-- "no row = not working" model can't support that, because unchecking a
-- driver also leaves "no row" — indistinguishable from "never decided" —
-- so the next page load would silently re-check them. This tiny marker
-- records that a date's drivers have already been seeded, so seeding runs
-- exactly once per date and an explicit uncheck sticks.
create table if not exists driver_working_defaults_seeded (
  company_id uuid not null references companies(id) on delete cascade,
  work_date date not null,
  seeded_at timestamptz not null default now(),
  primary key (company_id, work_date)
);

alter table driver_working_defaults_seeded enable row level security;
