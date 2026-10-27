import { test, expect } from "@playwright/test";
import { buildPayroll } from "@/lib/payroll";
import { computeActualLaborCosts } from "@/lib/labor-cost";
import type { Employee, ActualLaborEntry, ScheduleAssignment } from "@/lib/types";

/**
 * Unit tier — no browser, tests the actual calculation functions directly
 * with synthetic data. This is the right tool for payroll correctness
 * (precise, fast, no UI flakiness) vs. the workflow tier's job of proving
 * the UI wires up to these functions correctly at all.
 */
function emp(overrides: Partial<Employee>): Employee {
  return {
    id: "e-test",
    company_id: "c-test",
    first_name: "Test",
    last_name: "Employee",
    title: "Installer",
    day_rate: 0,
    pay_type: "hourly",
    is_driver: false,
    active: true,
    created_at: "2020-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function entry(overrides: Partial<ActualLaborEntry>): ActualLaborEntry {
  return {
    id: `entry-${Math.random()}`,
    company_id: "c-test",
    employee_id: "e-test",
    project_id: "p-test",
    work_date: "2026-01-05",
    hours: 8,
    created_at: "2026-01-05T00:00:00.000Z",
    updated_at: "2026-01-05T00:00:00.000Z",
    ...overrides,
  };
}

test("hourly pay = hours × rate, independent per entry", () => {
  const costs = computeActualLaborCosts([entry({ id: "a", rate_type: "hourly", rate_amount: 30, hours: 6 }), entry({ id: "b", rate_type: "hourly", rate_amount: 45, hours: 3 })]);
  expect(costs.find((c) => c.entryId === "a")?.cost).toBe(180);
  expect(costs.find((c) => c.entryId === "b")?.cost).toBe(135);
});

test("daily rate splits proportionally across same-day jobs and sums to exactly the daily rate", () => {
  const costs = computeActualLaborCosts([
    entry({ id: "a", project_id: "p1", rate_type: "daily", rate_amount: 300, hours: 6 }),
    entry({ id: "b", project_id: "p2", rate_type: "daily", rate_amount: 300, hours: 2 }),
  ]);
  const a = costs.find((c) => c.entryId === "a")!.cost;
  const b = costs.find((c) => c.entryId === "b")!.cost;
  expect(a).toBe(225); // 6/8 × 300
  expect(b).toBe(75); // 2/8 × 300
  expect(a + b).toBe(300); // never over/under the actual daily rate
});

test("a single job on a daily-rate day gets the full daily rate, not a fraction", () => {
  const costs = computeActualLaborCosts([entry({ rate_type: "daily", rate_amount: 350, hours: 4 })]);
  expect(costs[0].cost).toBe(350);
});

test("buildPayroll: confirmed hours override the schedule fallback", () => {
  const employee = emp({ id: "e1", pay_type: "hourly", hourly_rate: 25 });
  const entries: ActualLaborEntry[] = [entry({ employee_id: "e1", work_date: "2026-01-05", hours: 8, rate_type: "hourly", rate_amount: 25 })];
  const groups = buildPayroll(["2026-01-05"], [employee], entries, []);
  const row = groups.flatMap((g) => g.rows).find((r) => r.employee.id === "e1")!;
  expect(row.pay).toBe(200);
  expect(row.days[0].fromSchedule).toBe(false);
});

test("buildPayroll: a scheduled-but-unconfirmed day falls back to the planned assignment cost, flagged", () => {
  const employee = emp({ id: "e1", pay_type: "daily", daily_rate: 300 });
  const assignment: ScheduleAssignment = {
    id: "a1",
    company_id: "c-test",
    project_id: "p1",
    employee_id: "e1",
    schedule_date: "2026-01-05",
    role_on_job: "Installer",
    base_day_rate: 300,
    rate_multiplier: 1,
    time_and_half: false,
    assignment_cost: 300,
    created_at: "2026-01-05T00:00:00.000Z",
  };
  const groups = buildPayroll(["2026-01-05"], [employee], [], [assignment]);
  const row = groups.flatMap((g) => g.rows).find((r) => r.employee.id === "e1")!;
  expect(row.pay).toBe(300);
  expect(row.days[0].fromSchedule).toBe(true);
  expect(row.scheduledOnlyDays).toBe(1);
});

test("buildPayroll: double-booked same day still pays one day rate (the max assignment, never the sum)", () => {
  const employee = emp({ id: "e1", pay_type: "daily", daily_rate: 300 });
  const base: ScheduleAssignment = {
    id: "a1",
    company_id: "c-test",
    project_id: "p1",
    employee_id: "e1",
    schedule_date: "2026-01-05",
    role_on_job: "Installer",
    base_day_rate: 300,
    rate_multiplier: 1,
    time_and_half: false,
    assignment_cost: 300,
    created_at: "2026-01-05T00:00:00.000Z",
  };
  const groups = buildPayroll(["2026-01-05"], [employee], [], [base, { ...base, id: "a2", project_id: "p2" }]);
  const row = groups.flatMap((g) => g.rows).find((r) => r.employee.id === "e1")!;
  expect(row.pay).toBe(300); // not 600
});

/**
 * KNOWN BEHAVIOR, flagged for a human decision — not asserted here as
 * either "correct" or "a bug": time_and_half only affects the PLANNED
 * schedule_assignments.assignment_cost (createScheduleAssignment, lib/db.ts)
 * used as the payroll fallback BEFORE hours are confirmed. Once real hours
 * are confirmed (createActualLaborEntry, lib/db.ts), the entry only
 * snapshots the employee's plain hourly_rate/daily_rate — the 1.5×
 * multiplier is never carried over. This test pins down the CURRENT
 * behavior so a change to it is deliberate, not accidental; whether
 * confirmed hours should also apply time-and-half is a product decision,
 * not a QA call.
 */
test("confirmed actual hours do NOT carry a time-and-half multiplier (current behavior, not a correctness claim)", () => {
  const employee = emp({ id: "e1", pay_type: "hourly", hourly_rate: 20 });
  const entries: ActualLaborEntry[] = [entry({ employee_id: "e1", work_date: "2026-01-05", hours: 8, rate_type: "hourly", rate_amount: 20 })];
  const groups = buildPayroll(["2026-01-05"], [employee], entries, []);
  const row = groups.flatMap((g) => g.rows).find((r) => r.employee.id === "e1")!;
  expect(row.pay).toBe(160); // 8 × $20 — no 1.5× applied, regardless of whether the original schedule assignment was marked time-and-half
});

test("buildPayroll: employees group by tax status (W-4 / 1099 / Not set)", () => {
  const w4 = emp({ id: "e1", tax_status: "W-4" });
  const c1099 = emp({ id: "e2", tax_status: "1099" });
  const unset = emp({ id: "e3" });
  const groups = buildPayroll(["2026-01-05"], [w4, c1099, unset], [], []);
  expect(groups.find((g) => g.key === "W-4")?.rows.map((r) => r.employee.id)).toEqual(["e1"]);
  expect(groups.find((g) => g.key === "1099")?.rows.map((r) => r.employee.id)).toEqual(["e2"]);
  expect(groups.find((g) => g.key === "Not set")?.rows.map((r) => r.employee.id)).toEqual(["e3"]);
});
