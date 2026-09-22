// Core computed business logic: labor cost, man counts, crew comparisons,
// driver checks, double-booking detection, and project costing.
// These are pure functions over arrays so they work identically whether
// the data came from Supabase or the in-memory seed store, and so they can
// be unit tested in isolation.
import type {
  Employee,
  Project,
  ProjectCrewRequirement,
  ProjectMaterial,
  ScheduleAssignment,
  StaffCapability,
} from "./types";

export interface DayLaborSummary {
  date: string;
  manCount: number;
  laborCost: number;
  normalCost: number;
  timeAndHalfCost: number;
  normalDays: number;
  timeAndHalfDays: number;
}

/**
 * "Is this project still active/upcoming" (vs. past job history) — used by
 * Buildings/Clients/Materials/Reports/Haul-Away to split active vs.
 * historical projects. Previously keyed off the old 13-value detailed
 * `ProjectStatus` (a hardcoded "active statuses" set repeated in half a
 * dozen pages); re-pointed to the simplified 5-value `pipeline_stage` per
 * the Project Pipeline Stage Simplification (build 9, see README) — a
 * project is active until it reaches "Complete".
 */
export function isActiveProjectStage(p: Pick<Project, "pipeline_stage">): boolean {
  return p.pipeline_stage !== "Complete";
}

export function assignmentsForDate(assignments: ScheduleAssignment[], date: string): ScheduleAssignment[] {
  return assignments.filter((a) => a.schedule_date === date);
}

export function assignmentsForProject(assignments: ScheduleAssignment[], projectId: string): ScheduleAssignment[] {
  return assignments.filter((a) => a.project_id === projectId);
}

/**
 * PLANNED cost per assignment with the "one day rate per person per day"
 * rule. A double-booked person (two jobs, same date) is still paid ONE
 * day rate — never two — so their day's cost (the highest single
 * assignment_cost that day, which covers a 1.5x day) is split evenly
 * across the jobs they're on. The last share absorbs rounding so a
 * person's shares always sum to exactly one day rate.
 * Returns assignment id → that job's share of the person's day.
 */
export function plannedAssignmentShares(assignments: ScheduleAssignment[]): Map<string, number> {
  const grouped = new Map<string, ScheduleAssignment[]>();
  for (const a of assignments) {
    const k = `${a.employee_id}__${a.schedule_date}`;
    if (!grouped.has(k)) grouped.set(k, []);
    grouped.get(k)!.push(a);
  }
  const shares = new Map<string, number>();
  for (const group of grouped.values()) {
    const dayPay = Math.max(0, ...group.map((a) => a.assignment_cost));
    let allocated = 0;
    group.forEach((a, i) => {
      const isLast = i === group.length - 1;
      const share = isLast ? round2(dayPay - allocated) : round2(dayPay / group.length);
      allocated = round2(allocated + share);
      shares.set(a.id, share);
    });
  }
  return shares;
}

/** Sum of planned shares (one day rate per person per day) for a subset of assignments. */
export function plannedCostOf(subset: ScheduleAssignment[], shares: Map<string, number>): number {
  return round2(subset.reduce((sum, a) => sum + (shares.get(a.id) ?? a.assignment_cost), 0));
}

/** Daily man count + labor cost, broken into normal vs time-and-half. */
export function summarizeDay(assignments: ScheduleAssignment[], date: string): DayLaborSummary {
  const dayAssignments = assignmentsForDate(assignments, date);
  const shares = plannedAssignmentShares(dayAssignments);
  const normal = dayAssignments.filter((a) => !a.time_and_half);
  const overtime = dayAssignments.filter((a) => a.time_and_half);
  // A double-booked person counts once: one man, one day rate.
  const people = new Set(dayAssignments.map((a) => a.employee_id));
  return {
    date,
    manCount: people.size,
    laborCost: plannedCostOf(dayAssignments, shares),
    normalCost: plannedCostOf(normal, shares),
    timeAndHalfCost: plannedCostOf(overtime, shares),
    normalDays: new Set(normal.map((a) => a.employee_id)).size,
    timeAndHalfDays: new Set(overtime.map((a) => a.employee_id)).size,
  };
}

/** Weekly man count + labor cost, broken out per day. */
export function summarizeWeek(assignments: ScheduleAssignment[], weekDates: string[]): {
  days: DayLaborSummary[];
  totalManDays: number;
  totalLaborCost: number;
  totalNormalCost: number;
  totalTimeAndHalfCost: number;
} {
  const days = weekDates.map((date) => summarizeDay(assignments, date));
  return {
    days,
    totalManDays: days.reduce((sum, day) => sum + day.manCount, 0),
    totalLaborCost: round2(days.reduce((sum, day) => sum + day.laborCost, 0)),
    totalNormalCost: round2(days.reduce((sum, day) => sum + day.normalCost, 0)),
    totalTimeAndHalfCost: round2(days.reduce((sum, day) => sum + day.timeAndHalfCost, 0)),
  };
}

/**
 * Total planned labor cost for a project across every scheduled date.
 * Pass ALL assignments (not just this project's) so a person who is on
 * another job the same day only contributes their share of one day rate.
 */
export function projectLaborCost(assignments: ScheduleAssignment[], projectId: string): number {
  return plannedCostOf(assignmentsForProject(assignments, projectId), plannedAssignmentShares(assignments));
}

export interface CrewComparisonRow {
  role: StaffCapability;
  required: number;
  assigned: number;
  complete: boolean;
  missing: number;
}

/**
 * Compares required crew (project_crew_requirements, either date-specific
 * or blanket/null-date "every scheduled day" requirements) against actual
 * schedule_assignments for a given project + date, grouped by role.
 */
export function compareCrewForProjectDate(
  requirements: ProjectCrewRequirement[],
  assignments: ScheduleAssignment[],
  projectId: string,
  date: string
): CrewComparisonRow[] {
  const applicable = requirements.filter(
    (r) => r.project_id === projectId && (r.schedule_date === null || r.schedule_date === undefined || r.schedule_date === date)
  );
  const dayAssignments = assignments.filter((a) => a.project_id === projectId && a.schedule_date === date);

  const byRole = new Map<StaffCapability, number>();
  for (const req of applicable) {
    byRole.set(req.role, (byRole.get(req.role) ?? 0) + req.quantity);
  }

  return Array.from(byRole.entries()).map(([role, required]) => {
    const assigned = dayAssignments.filter((a) => a.role_on_job === role).length;
    return {
      role,
      required,
      assigned,
      complete: assigned >= required,
      missing: Math.max(0, required - assigned),
    };
  });
}

/**
 * Whether transportation/driver coverage is satisfied for a project on a
 * given date: true if the project needs transportation and no assigned
 * employee that day is a designated driver.
 */
export function isMissingDriver(
  project: Pick<Project, "needs_transportation">,
  assignments: ScheduleAssignment[],
  employees: Employee[],
  projectId: string,
  date: string
): boolean {
  if (!project.needs_transportation) return false;
  const dayAssignments = assignments.filter((a) => a.project_id === projectId && a.schedule_date === date);
  if (dayAssignments.length === 0) return false; // nobody scheduled, nothing to flag
  const employeeMap = new Map(employees.map((e) => [e.id, e]));
  return !dayAssignments.some((a) => employeeMap.get(a.employee_id)?.is_driver);
}

export interface DoubleBooking {
  employee_id: string;
  schedule_date: string;
  project_ids: string[];
}

/** Employees assigned to more than one project on the same date. */
export function findDoubleBookings(assignments: ScheduleAssignment[]): DoubleBooking[] {
  const key = (a: ScheduleAssignment) => `${a.employee_id}__${a.schedule_date}`;
  const grouped = new Map<string, ScheduleAssignment[]>();
  for (const a of assignments) {
    const k = key(a);
    if (!grouped.has(k)) grouped.set(k, []);
    grouped.get(k)!.push(a);
  }
  const result: DoubleBooking[] = [];
  for (const group of grouped.values()) {
    const projectIds = Array.from(new Set(group.map((a) => a.project_id)));
    if (projectIds.length > 1) {
      result.push({ employee_id: group[0].employee_id, schedule_date: group[0].schedule_date, project_ids: projectIds });
    }
  }
  return result;
}

export interface ProjectCosting {
  laborCost: number;
  materialCost: number;
  otherCost: number;
  totalCost: number;
  projectValue: number;
  grossProfit: number;
  grossMarginPct: number | null;
}

/** Full project costing: labor + materials + other vs. contract value. */
export function computeProjectCosting(
  project: Pick<Project, "project_value" | "other_cost">,
  assignments: ScheduleAssignment[],
  projectMaterials: ProjectMaterial[],
  projectId: string,
  extraMaterialCost = 0
): ProjectCosting {
  const laborCost = projectLaborCost(assignments, projectId);
  const materialCost = round2(
    projectMaterials.filter((m) => m.project_id === projectId).reduce((sum, m) => sum + m.cost, 0) + extraMaterialCost
  );
  const otherCost = project.other_cost ?? 0;
  const totalCost = round2(laborCost + materialCost + otherCost);
  const projectValue = project.project_value ?? 0;
  const grossProfit = round2(projectValue - totalCost);
  const grossMarginPct = projectValue > 0 ? round2((grossProfit / projectValue) * 100) : null;
  return { laborCost, materialCost, otherCost, totalCost, projectValue, grossProfit, grossMarginPct };
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Consistent "#10042" display for a project's permanent job number, used
 * wherever a project is referenced in the UI. */
export function formatJobNumber(n: number | null | undefined): string {
  if (n === null || n === undefined) return "—";
  return `#${n}`;
}

export function formatCurrency(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

export function formatCurrencyPrecise(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  return n.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

export function formatPercent(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  return `${n.toFixed(1)}%`;
}
