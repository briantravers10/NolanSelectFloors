// ACTUAL-hours labor cost tracking (build 6) — additive to, and computed
// entirely separately from, the PLANNED-cost system in lib/calculations.ts
// (schedule_assignments.base_day_rate/rate_multiplier/assignment_cost).
// See README "Labor Cost Tracking" for the full write-up.
//
// Every function here is pure and derives cost from
// actual_labor_entries.rate_type/rate_amount (snapshotted at entry-creation
// time — see lib/db.ts#createActualLaborEntry) plus that day's hours split.
// Nothing here reads an employee's CURRENT rate — that would violate
// Historical Pay Rate Accuracy (a later raise must never change an old
// job's calculated cost).
import type { ActualLaborEntry, Employee, PayType, Project } from "./types";
import { round2 } from "./calculations";

// ---------------------------------------------------------------------
// CORE ALLOCATION — the one calculation the whole feature is built on.
// ---------------------------------------------------------------------

export interface EntryCost {
  entryId: string;
  cost: number;
}

/**
 * Allocates cost to every actual_labor_entries row.
 *
 * - HOURLY: cost = hours × rate_amount, independently per entry (no
 *   allocation needed — it's already a direct rate).
 * - DAILY: the employee's daily rate is allocated PROPORTIONALLY across
 *   that day's entries by hours worked, e.g. daily rate $300, 6h on Job A +
 *   2h on Job B (8h total) → Job A gets 6/8×$300=$225, Job B gets
 *   2/8×$300=$75. A single job that day gets the FULL daily rate (the
 *   proportion is 100% when total hours for the day IS that job's hours).
 *   Amounts are adjusted so they always sum to EXACTLY the daily rate for
 *   that employee+day (never overcharging by rounding each entry
 *   independently) — the last entry in the day absorbs the rounding
 *   remainder.
 *
 * Entries are grouped by (employee_id, work_date, rate_type, rate_amount)
 * so a rate change mid-day (an edge case) still allocates correctly within
 * each rate "generation" rather than incorrectly averaging across it.
 */
export function computeActualLaborCosts(entries: ActualLaborEntry[]): EntryCost[] {
  const groups = new Map<string, ActualLaborEntry[]>();
  for (const e of entries) {
    const key = `${e.employee_id}__${e.work_date}__${e.rate_type ?? ""}__${e.rate_amount ?? ""}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(e);
  }

  const results: EntryCost[] = [];
  for (const group of groups.values()) {
    const rateType: PayType | undefined = group[0].rate_type;
    const rateAmount = group[0].rate_amount ?? 0;

    if (rateType === "hourly") {
      for (const e of group) {
        results.push({ entryId: e.id, cost: round2(e.hours * rateAmount) });
      }
      continue;
    }

    // Daily (or unknown/legacy rows with no snapshot — treated as daily so
    // they still produce a number rather than silently dropping cost).
    const totalHours = group.reduce((sum, e) => sum + e.hours, 0);
    if (totalHours <= 0 || rateAmount <= 0) {
      for (const e of group) results.push({ entryId: e.id, cost: 0 });
      continue;
    }
    let allocated = 0;
    group.forEach((e, i) => {
      const isLast = i === group.length - 1;
      const share = isLast ? round2(rateAmount - allocated) : round2((e.hours / totalHours) * rateAmount);
      allocated = round2(allocated + share);
      results.push({ entryId: e.id, cost: share });
    });
  }
  return results;
}

/** Convenience: cost-per-entry as a Map keyed by entry id. */
export function laborCostByEntryId(entries: ActualLaborEntry[]): Map<string, number> {
  return new Map(computeActualLaborCosts(entries).map((r) => [r.entryId, r.cost]));
}

// ---------------------------------------------------------------------
// PER-JOB LABOR SUMMARY ("Job Labor Summary")
// ---------------------------------------------------------------------

export interface JobLaborEmployeeRow {
  employee_id: string;
  employeeName: string;
  daysWorked: number;
  totalHours: number;
  totalCost: number;
}

export interface JobLaborSummary {
  projectId: string;
  rows: JobLaborEmployeeRow[];
  totalManHours: number;
  totalLaborCost: number;
}

/** For a given job/project: every employee involved, days worked, actual
 * hours, and allocated labor cost — plus man-hours/cost totals. Computed
 * entirely from actual_labor_entries, never manually entered. */
export function jobLaborSummary(projectId: string, entries: ActualLaborEntry[], employees: Employee[]): JobLaborSummary {
  const costByEntry = laborCostByEntryId(entries);
  const projectEntries = entries.filter((e) => e.project_id === projectId);
  const employeeById = new Map(employees.map((e) => [e.id, e]));

  const byEmployee = new Map<string, ActualLaborEntry[]>();
  for (const e of projectEntries) {
    if (!byEmployee.has(e.employee_id)) byEmployee.set(e.employee_id, []);
    byEmployee.get(e.employee_id)!.push(e);
  }

  const rows: JobLaborEmployeeRow[] = Array.from(byEmployee.entries()).map(([employeeId, empEntries]) => {
    const emp = employeeById.get(employeeId);
    const days = new Set(empEntries.map((e) => e.work_date));
    return {
      employee_id: employeeId,
      employeeName: emp ? `${emp.first_name} ${emp.last_name}` : employeeId,
      daysWorked: days.size,
      totalHours: round2(empEntries.reduce((sum, e) => sum + e.hours, 0)),
      totalCost: round2(empEntries.reduce((sum, e) => sum + (costByEntry.get(e.id) ?? 0), 0)),
    };
  });
  rows.sort((a, b) => a.employeeName.localeCompare(b.employeeName));

  return {
    projectId,
    rows,
    totalManHours: round2(rows.reduce((sum, r) => sum + r.totalHours, 0)),
    totalLaborCost: round2(rows.reduce((sum, r) => sum + r.totalCost, 0)),
  };
}

// ---------------------------------------------------------------------
// PER-DAY LABOR COST TOTAL — across ALL jobs for a given day.
// ---------------------------------------------------------------------

export function dayLaborCostTotal(date: string, entries: ActualLaborEntry[]): number {
  const dayEntries = entries.filter((e) => e.work_date === date);
  const costByEntry = laborCostByEntryId(dayEntries);
  return round2(dayEntries.reduce((sum, e) => sum + (costByEntry.get(e.id) ?? 0), 0));
}

// ---------------------------------------------------------------------
// PER-EMPLOYEE LABOR HISTORY — actual work allocation by date.
// ---------------------------------------------------------------------

export interface EmployeeLaborHistoryJob {
  projectId: string | null;
  projectName: string;
  hours: number;
  cost: number;
}

export interface EmployeeLaborHistoryDay {
  date: string;
  jobs: EmployeeLaborHistoryJob[];
  totalHours: number;
  totalCost: number;
}

/** One employee's actual work allocation by date: which jobs, hours per
 * job, allocated labor cost per job, and a daily total. Newest date first. */
export function employeeLaborHistory(
  employeeId: string,
  entries: ActualLaborEntry[],
  projects: Project[]
): EmployeeLaborHistoryDay[] {
  const empEntries = entries.filter((e) => e.employee_id === employeeId);
  const costByEntry = laborCostByEntryId(empEntries);
  const projectById = new Map(projects.map((p) => [p.id, p]));

  const byDate = new Map<string, ActualLaborEntry[]>();
  for (const e of empEntries) {
    if (!byDate.has(e.work_date)) byDate.set(e.work_date, []);
    byDate.get(e.work_date)!.push(e);
  }

  const days: EmployeeLaborHistoryDay[] = Array.from(byDate.entries()).map(([date, dayEntries]) => {
    const jobs: EmployeeLaborHistoryJob[] = dayEntries.map((e) => ({
      projectId: e.project_id,
      projectName: e.project_id ? (projectById.get(e.project_id)?.name ?? e.project_id) : "Driver — no job assigned",
      hours: e.hours,
      cost: costByEntry.get(e.id) ?? 0,
    }));
    return {
      date,
      jobs,
      totalHours: round2(jobs.reduce((sum, j) => sum + j.hours, 0)),
      totalCost: round2(jobs.reduce((sum, j) => sum + j.cost, 0)),
    };
  });

  return days.sort((a, b) => b.date.localeCompare(a.date));
}

// ---------------------------------------------------------------------
// FORMATTING HELPER — the "applicable rate" label for a pay rate field.
// ---------------------------------------------------------------------

export function payRateLabel(employee: Pick<Employee, "pay_type" | "daily_rate" | "hourly_rate">): string {
  if (employee.pay_type === "hourly") {
    return employee.hourly_rate != null ? `$${employee.hourly_rate}/hr` : "—";
  }
  return employee.daily_rate != null ? `$${employee.daily_rate}/day` : "—";
}
