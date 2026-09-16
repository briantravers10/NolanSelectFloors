-- Nolan Select Floors — Vacation & Sick Day Tracker (build 7)
--
-- DATA MODEL DECISION: new `time_off_entries` table, NOT an extension of
-- the existing `employee_availability` table (see 0001_init.sql).
-- `employee_availability` is a generic one-row-per-employee-per-day status
-- flag (working/available/day_off/vacation/unavailable) that already
-- powers the Dashboard's "Staff Off" stat (see lib/dashboard.ts). It was
-- never built out with any create/edit UI, audit trail, or a "date range"
-- concept, and overloading it would mean either duplicating one row per
-- calendar day for a multi-day vacation (awkward to create/edit/audit) or
-- bolting a start/end range onto a table whose whole shape is "one date,
-- one status". The client explicitly asked for a purpose-built Vacation/
-- Sick tracker with type + notes + a simple range, and a dedicated table
-- models that far more directly:
--   - a single row naturally represents "Miguel is on vacation May 3-10"
--     instead of 8 separate day rows
--   - `type` (Vacation/Sick/Personal/Unpaid) is closer to what an owner
--     actually wants to log than a generic 5-value availability status
--   - `created_by`/`updated_by` + activity_log audit logging (who logged
--     whose time off, and when) follows this app's existing audit pattern
--     (see lib/db.ts logActivity() usage elsewhere) — `employee_availability`
--     has no such trail today
-- `employee_availability` is left completely untouched (still populated,
-- still read by the Dashboard) — nothing here drops or migrates it. The
-- Dashboard's "Staff Off" stat is extended (lib/dashboard.ts) to ALSO
-- treat a matching `time_off_entries` row as "off today", so the two data
-- sources are additive rather than conflicting. See README "Vacation &
-- Sick Day Tracker" for the full write-up.
--
-- DELIBERATELY SIMPLE: this is a day-off LOG, not an accrual/balance
-- system. There is no "vacation days remaining" concept, no yearly
-- allotment, and no PTO bank — the client didn't ask for one. A balance/
-- allotment table could be layered on top of this later (e.g. an
-- `employee_pto_balances` table + a computed "days used" rollup from this
-- same `time_off_entries` table) without any change to what's built here.

create type time_off_type as enum ('Vacation', 'Sick', 'Personal', 'Unpaid');

create table time_off_entries (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  employee_id uuid not null references employees(id) on delete cascade,
  start_date date not null,
  end_date date not null,
  type time_off_type not null default 'Vacation',
  notes text,
  created_by text,
  created_at timestamptz not null default now(),
  updated_by text,
  updated_at timestamptz not null default now(),
  constraint time_off_entries_date_range_valid check (end_date >= start_date)
);

-- A single day off is simply start_date == end_date — no separate
-- "single day" shape, per the spec.

create index idx_time_off_entries_employee on time_off_entries(employee_id);
create index idx_time_off_entries_company on time_off_entries(company_id);
-- Powers both "who is off on date X" (getTimeOffForDate) and
-- "is employee E off on date X" (isEmployeeOffOn) range-overlap lookups,
-- used to power the Scheduling-conflict warning — see lib/time-off.ts.
create index idx_time_off_entries_date_range on time_off_entries(start_date, end_date);

-- =========================================================================
-- ANNUAL VACATION / SICK DAY ALLOWANCE (per employee, not a flat company
-- number — different hires get different allowances). Nullable: an unset
-- allowance means "not tracked yet" rather than "zero days allowed", so a
-- newly hired employee doesn't immediately show as over-allowance.
-- Usage-vs-allowance is a pure computed rollup (lib/time-off.ts
-- computeTimeOffUsage) from this column + `time_off_entries` above — no
-- separate balance/ledger table. See README "Vacation & Sick Day Tracker —
-- Annual Allowance" for the full write-up, including why this stays a
-- simple year-to-date comparison and not an accrual system (days don't
-- accrue monthly, roll over, or get pro-rated by hire date in this pass).
-- =========================================================================
alter table employees
  add column vacation_days_allowed integer,
  add column sick_days_allowed integer;
