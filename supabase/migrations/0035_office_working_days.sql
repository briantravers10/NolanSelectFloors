-- Daily Office Staff Working Status — the same "Drivers Working Today"
-- mechanism (migrations 0032/0033), applied to office staff so their day
-- rate lands in payroll even though they're never assigned to a job's crew
-- list. Unlike drivers (opt-out, everyone assumed working), office staff
-- default from each person's own typical workdays, so the checkbox is
-- already right most days and payroll stays accurate with less clicking.

alter table employees add column if not exists is_office boolean not null default false;
-- Mon/Tue/Wed/Thu/Fri/Sat/Sun subset this person normally works, e.g.
-- {Mon,Tue,Wed,Thu,Fri}. Null/empty means "not set yet" — no auto-check,
-- office still marks them manually until this is filled in.
alter table employees add column if not exists office_workdays text[];

create table if not exists office_working_defaults_seeded (
  company_id uuid not null references companies(id) on delete cascade,
  work_date date not null,
  seeded_at timestamptz not null default now(),
  primary key (company_id, work_date)
);

alter table office_working_defaults_seeded enable row level security;
