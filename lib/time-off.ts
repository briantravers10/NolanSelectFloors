// Vacation & Sick Day Tracker — pure helper functions over TimeOffEntry
// arrays, same convention as lib/calculations.ts (findDoubleBookings) and
// lib/schedule.ts: callers fetch the data (lib/db.ts#listTimeOffEntries)
// and pass it in here, so these work identically against Supabase or the
// in-memory seed store. See README "Vacation & Sick Day Tracker".
import type { Employee, TimeOffEntry, TimeOffType } from "./types";

/** The minimal shape these helpers need — `TimeOffEntry` satisfies it, and
 * so does the trimmed-down shape CrewPicker.tsx (a client component) uses,
 * so the same overlap logic works on both sides without either needing the
 * other's full type. */
export interface TimeOffRange {
  employee_id: string;
  start_date: string;
  end_date: string;
  type: TimeOffType;
}

/** True if `date` falls within the entry's [start_date, end_date] range
 * (inclusive) — a single day off is start_date === end_date. */
function overlaps(entry: TimeOffRange, date: string): boolean {
  return date >= entry.start_date && date <= entry.end_date;
}

/** The time-off entry covering `employeeId` on `date`, or undefined if
 * they're not off that day. Powers the "⚠ On Vacation" / "⚠ Out Sick"
 * scheduling-conflict warning in the Crew picker (CrewPicker.tsx). */
export function isEmployeeOffOn<T extends TimeOffRange>(entries: T[], employeeId: string, date: string): T | undefined {
  return entries.find((e) => e.employee_id === employeeId && overlaps(e, date));
}

/** Every time-off entry active on `date`, one per employee (first match if
 * an employee somehow has overlapping entries). Used for the Dashboard's
 * "Staff Off" stat and the Staff list's "on time off today" badge. */
export function getTimeOffForDate<T extends TimeOffRange>(entries: T[], date: string): Map<string, T> {
  const map = new Map<string, T>();
  for (const e of entries) {
    if (!map.has(e.employee_id) && overlaps(e, date)) map.set(e.employee_id, e);
  }
  return map;
}

/** Short warning label shown next to a name in the Crew picker. */
export function timeOffWarningLabel(type: TimeOffEntry["type"]): string {
  switch (type) {
    case "Vacation":
      return "⚠ On Vacation";
    case "Sick":
      return "⚠ Out Sick";
    case "Personal":
      return "⚠ Personal Day";
    case "Unpaid":
      return "⚠ Unpaid Leave";
  }
}

// ---------------------------------------------------------------------
// ANNUAL VACATION / SICK DAY ALLOWANCE (build 7) — a pure computed rollup,
// no separate balance/ledger table. Not an accrual system: days don't
// accrue monthly or roll over, this is a flat "N days per calendar year"
// comparison against a year-to-date sum of logged entries. See README
// "Vacation & Sick Day Tracker — Annual Allowance".
// ---------------------------------------------------------------------

/** Inclusive day count of [startDate, endDate], clipped to `year`
 * (Jan 1 – Dec 31). Returns 0 if the range doesn't intersect that year —
 * e.g. a vacation spanning Dec 29 – Jan 2 only contributes the in-year
 * days to each year's total. */
export function daysInYear(startDate: string, endDate: string, year: number): number {
  const yearStart = `${year}-01-01`;
  const yearEnd = `${year}-12-31`;
  const start = startDate < yearStart ? yearStart : startDate;
  const end = endDate > yearEnd ? yearEnd : endDate;
  if (end < start) return 0;
  // Working days only — Saturdays and Sundays never count against
  // anyone's vacation or sick allowance.
  let count = 0;
  const cursor = new Date(start + "T00:00:00");
  const last = new Date(end + "T00:00:00");
  while (cursor <= last) {
    const dow = cursor.getDay();
    if (dow !== 0 && dow !== 6) count += 1;
    cursor.setDate(cursor.getDate() + 1);
  }
  return count;
}

export interface TimeOffUsage {
  year: number;
  vacationUsed: number;
  vacationAllowed: number | null;
  vacationOver: boolean;
  sickUsed: number;
  sickAllowed: number | null;
  sickOver: boolean;
  personalUsed: number;
  unpaidUsed: number;
}

/** One employee's year-to-date Vacation/Sick usage vs. their allowance.
 * `entries` should already be filtered to this employee (see
 * lib/db.ts#listTimeOffForEmployee) — pass the whole company's entries and
 * every employee will show 0 used. */
export function computeTimeOffUsage(
  entries: TimeOffEntry[],
  employee: Pick<Employee, "vacation_days_allowed" | "sick_days_allowed">,
  year: number = new Date().getFullYear()
): TimeOffUsage {
  let vacationUsed = 0;
  let sickUsed = 0;
  let personalUsed = 0;
  let unpaidUsed = 0;
  for (const e of entries) {
    const days = daysInYear(e.start_date, e.end_date, year);
    if (days <= 0) continue;
    if (e.type === "Vacation") vacationUsed += days;
    else if (e.type === "Sick") sickUsed += days;
    else if (e.type === "Personal") personalUsed += days;
    else if (e.type === "Unpaid") unpaidUsed += days;
  }
  const vacationAllowed = employee.vacation_days_allowed ?? null;
  const sickAllowed = employee.sick_days_allowed ?? null;
  return {
    year,
    vacationUsed,
    vacationAllowed,
    vacationOver: vacationAllowed != null && vacationUsed > vacationAllowed,
    sickUsed,
    sickAllowed,
    sickOver: sickAllowed != null && sickUsed > sickAllowed,
    personalUsed,
    unpaidUsed,
  };
}

/** Same as computeTimeOffUsage, but for every employee at once (keyed by
 * employee id) — used for the Staff list's "Over Allowance" badge, which
 * needs every employee's usage without a per-row round trip. */
export function computeTimeOffUsageByEmployee(
  entries: TimeOffEntry[],
  employees: Pick<Employee, "id" | "vacation_days_allowed" | "sick_days_allowed">[],
  year: number = new Date().getFullYear()
): Map<string, TimeOffUsage> {
  const byEmployee = new Map<string, TimeOffEntry[]>();
  for (const e of entries) {
    if (!byEmployee.has(e.employee_id)) byEmployee.set(e.employee_id, []);
    byEmployee.get(e.employee_id)!.push(e);
  }
  const result = new Map<string, TimeOffUsage>();
  for (const emp of employees) {
    result.set(emp.id, computeTimeOffUsage(byEmployee.get(emp.id) ?? [], emp, year));
  }
  return result;
}

/** Sorts an employee's time-off entries into upcoming (today or later,
 * soonest first) and past (most recent first) buckets, for the Staff
 * profile "Time Off" section. */
export function splitUpcomingAndPast(
  entries: TimeOffEntry[],
  todayIso: string
): { upcoming: TimeOffEntry[]; past: TimeOffEntry[] } {
  const upcoming = entries
    .filter((e) => e.end_date >= todayIso)
    .sort((a, b) => (a.start_date < b.start_date ? -1 : 1));
  const past = entries
    .filter((e) => e.end_date < todayIso)
    .sort((a, b) => (a.start_date < b.start_date ? 1 : -1));
  return { upcoming, past };
}
