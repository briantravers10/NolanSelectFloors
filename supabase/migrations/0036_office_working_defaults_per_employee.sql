-- Office Staff Working Today defaults must be evaluated PER EMPLOYEE, not
-- once for the whole date (0035's original design) — with per-employee
-- typical workdays, a whole-date lock meant configuring someone's typical
-- days AFTER their first page load for a date could never auto-check them
-- for that date; the per-date "seeded" marker had already fired before
-- their workdays existed. Table only ever held bookkeeping rows (no real
-- checkbox state — that lives in actual_labor_entries), safe to recreate.
drop table if exists office_working_defaults_seeded;

create table office_working_defaults_seeded (
  company_id uuid not null references companies(id) on delete cascade,
  work_date date not null,
  employee_id uuid not null references employees(id) on delete cascade,
  seeded_at timestamptz not null default now(),
  primary key (company_id, work_date, employee_id)
);

alter table office_working_defaults_seeded enable row level security;
