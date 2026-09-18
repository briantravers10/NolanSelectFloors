import type { ActualLaborEntry, Employee, ScheduleAssignment } from "./types";
import { computeActualLaborCosts } from "./labor-cost";
import { round2 } from "./calculations";

export interface PayrollDay {
  date: string;
  hours: number;
  /** true when no hours were logged that day and we fell back to the
   * schedule (counted as a standard 8-hour day). */
  fromSchedule: boolean;
  pay: number;
}

export interface PayrollRow {
  employee: Employee;
  days: PayrollDay[];
  totalHours: number;
  daysWorked: number;
  scheduledOnlyDays: number;
  pay: number;
}

export interface PayrollGroup {
  key: "W-4" | "1099" | "Not set";
  label: string;
  rows: PayrollRow[];
  totalHours: number;
  pay: number;
}

const STANDARD_DAY_HOURS = 8;

/**
 * Weekly payroll: for each person, hours per day from End of Day Review
 * (actual_labor_entries, costed with the rate snapshot on each entry).
 * A day with nothing logged but a schedule assignment counts as a
 * standard 8-hour day at the planned assignment cost, flagged so the
 * office knows it still needs confirming. Grouped by tax status.
 */
export function buildPayroll(weekDates: string[], employees: Employee[], entries: ActualLaborEntry[], assignments: ScheduleAssignment[]): PayrollGroup[] {
  const dateSet = new Set(weekDates);
  const weekEntries = entries.filter((e) => dateSet.has(e.work_date));
  const costById = new Map(computeActualLaborCosts(weekEntries).map((c) => [c.entryId, c.cost]));
  const weekAssignments = assignments.filter((a) => dateSet.has(a.schedule_date));

  const rows: PayrollRow[] = [];
  for (const emp of employees) {
    const days: PayrollDay[] = weekDates.map((date) => {
      const mine = weekEntries.filter((e) => e.employee_id === emp.id && e.work_date === date);
      if (mine.length > 0) {
        return {
          date,
          hours: round2(mine.reduce((s, e) => s + e.hours, 0)),
          fromSchedule: false,
          pay: round2(mine.reduce((s, e) => s + (costById.get(e.id) ?? 0), 0)),
        };
      }
      const sched = weekAssignments.filter((a) => a.employee_id === emp.id && a.schedule_date === date);
      if (sched.length > 0) {
        return { date, hours: STANDARD_DAY_HOURS, fromSchedule: true, pay: round2(sched.reduce((s, a) => s + a.assignment_cost, 0)) };
      }
      return { date, hours: 0, fromSchedule: false, pay: 0 };
    });
    const totalHours = round2(days.reduce((s, d) => s + d.hours, 0));
    if (totalHours === 0 && !emp.active) continue;
    rows.push({
      employee: emp,
      days,
      totalHours,
      daysWorked: days.filter((d) => d.hours > 0).length,
      scheduledOnlyDays: days.filter((d) => d.fromSchedule).length,
      pay: round2(days.reduce((s, d) => s + d.pay, 0)),
    });
  }

  const groups: PayrollGroup[] = [
    { key: "W-4", label: "W-4 Employees", rows: [], totalHours: 0, pay: 0 },
    { key: "1099", label: "1099 Contractors", rows: [], totalHours: 0, pay: 0 },
    { key: "Not set", label: "Tax status not set", rows: [], totalHours: 0, pay: 0 },
  ];
  for (const r of rows) {
    const g = groups.find((x) => x.key === (r.employee.tax_status ?? "Not set")) ?? groups[2];
    g.rows.push(r);
    g.totalHours = round2(g.totalHours + r.totalHours);
    g.pay = round2(g.pay + r.pay);
  }
  for (const g of groups) g.rows.sort((a, b) => a.employee.first_name.localeCompare(b.employee.first_name));
  return groups.filter((g) => g.rows.length > 0 || g.key !== "Not set");
}

export function payrollCsv(groups: PayrollGroup[], weekDates: string[], includePay: boolean): string {
  const esc = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
  const head = ["Tax status", "Name", "Title", ...weekDates, "Total hours", "Days", "Scheduled-only days", ...(includePay ? ["Pay"] : [])];
  const lines = [head.map(esc).join(",")];
  for (const g of groups) {
    for (const r of g.rows) {
      lines.push(
        [
          g.key,
          `${r.employee.first_name} ${r.employee.last_name}`,
          r.employee.title,
          ...r.days.map((d) => (d.hours ? `${d.hours}${d.fromSchedule ? " (sched)" : ""}` : "")),
          r.totalHours,
          r.daysWorked,
          r.scheduledOnlyDays,
          ...(includePay ? [r.pay.toFixed(2)] : []),
        ]
          .map(esc)
          .join(",")
      );
    }
    lines.push([`${g.key} total`, "", "", ...weekDates.map(() => ""), g.totalHours, "", "", ...(includePay ? [g.pay.toFixed(2)] : [])].map(esc).join(","));
  }
  return lines.join("\n");
}
