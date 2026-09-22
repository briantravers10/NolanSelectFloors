-- Daily Driver Working Status.
--
-- Drivers aren't normally assigned to a job's crew list, but when one
-- works a given day their day rate still needs to land in payroll. Rather
-- than a parallel payroll table, a driver's working day is represented as
-- an ordinary actual_labor_entries row with project_id left null — the
-- SAME table, SAME rate-snapshot columns (rate_type/rate_amount), and SAME
-- cost pipeline (lib/labor-cost.ts, lib/payroll.ts) every other logged day
-- already uses. No new payroll logic, no new history/versioning system.

alter table actual_labor_entries alter column project_id drop not null;

-- The one new query pattern this feature adds: "does this employee already
-- have a driver-day (no-job) entry for this date". Partial index matches
-- exactly that lookup — every existing job-hours row (project_id not null)
-- is untouched by it.
create index if not exists idx_actual_labor_driver_day on actual_labor_entries(employee_id, work_date) where project_id is null;
