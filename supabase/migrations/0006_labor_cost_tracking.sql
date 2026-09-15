-- Nolan Select Floors — Labor Cost Tracking (build 6)
-- Deliberately ADDITIVE, per README "Reconciling planned vs. actual labor
-- cost": nothing here touches `schedule_assignments` (base_day_rate /
-- rate_multiplier / assignment_cost), which remains the PLANNED-cost system
-- backing Project Costing / Dashboard / Reports. This migration adds a
-- parallel ACTUAL-cost system sourced from `actual_labor_entries`
-- (build 5), computed in lib/labor-cost.ts.

-- =========================================================================
-- EMPLOYEE PAY RATE
-- =========================================================================
create type pay_type as enum ('daily', 'hourly');

alter table employees
  add column pay_type pay_type not null default 'daily',
  add column daily_rate numeric(10,2),
  add column hourly_rate numeric(10,2);

-- Backfill: every existing employee already has a `day_rate` (the
-- PLANNED-cost field) — carry it over as their starting daily_rate/pay_type
-- so nothing shows as $0 the moment this migration runs. Rates can then be
-- edited independently of `day_rate` going forward.
update employees set daily_rate = day_rate, pay_type = 'daily';

-- =========================================================================
-- ACTUAL LABOR ENTRIES — rate snapshot columns (Historical Pay Rate
-- Accuracy). Populated going forward by lib/db.ts#createActualLaborEntry
-- from the employee's CURRENT pay_type/rate at the moment the entry is
-- saved — never recalculated from the employee's rate later.
-- =========================================================================
alter table actual_labor_entries
  add column rate_type pay_type,
  add column rate_amount numeric(10,2);

-- Backfill any already-seeded rows from the employee's rate as of this
-- migration (best available snapshot for pre-existing data — going forward
-- every new row gets its own snapshot at entry-creation time).
update actual_labor_entries ale
set rate_type = e.pay_type,
    rate_amount = case when e.pay_type = 'hourly' then e.hourly_rate else e.daily_rate end
from employees e
where e.id = ale.employee_id and ale.rate_type is null;

-- =========================================================================
-- OFFICE USERS — access role (pay-rate / labor-cost visibility gate)
-- =========================================================================
-- Separate from the existing `office_user_role` enum (estimator/manager),
-- which only governs the bid-claim workflow (see lib/current-user.ts). This
-- is the UI-level permission boundary for sensitive pay/cost data — no real
-- auth exists yet (per prior phases), so this is enforced by hiding
-- fields/sections when the acting user's access_role doesn't qualify. See
-- README "Labor Cost Tracking — Access Control".
create type access_role as enum ('owner_admin', 'office_staff', 'field_employee');

alter table office_users
  add column access_role access_role not null default 'office_staff';

-- Seed mapping across the 3 existing office users: at least one Owner/Admin
-- (Sarah Bennett, the senior estimator), one Office Staff, one Field/
-- Employee tier (to demonstrate the "hidden by default" case).
update office_users set access_role = 'owner_admin' where full_name = 'Sarah Bennett';
update office_users set access_role = 'office_staff' where full_name = 'Emma Castillo';
update office_users set access_role = 'field_employee' where full_name = 'David Okoye';

-- The company_owner sentinel "owner" acting-user (lib/current-user.ts
-- ownerActingUser()) is hardcoded to access_role 'owner_admin' in
-- application code — there's no office_users row for it to update here.
