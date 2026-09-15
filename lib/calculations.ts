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

export function assignmentsForDate(assignments: ScheduleAssignment[], date: string): ScheduleAssignment[] {
  return assignments.filter((a) => a.schedule_date === date);
}

export function assignmentsForProject(assignments: ScheduleAssignment[], projectId: string): ScheduleAssignment[] {
  return assignments.filter((a) => a.project_id === projectId);
}

/** Daily man count + labor cost, broken into normal vs time-and-half. */
export function summarizeDay(assignments: ScheduleAssignment[], date: string): DayLaborSummary {
  const dayAssignments = assignmentsForDate(assignments, date);
  const normal = dayAssignments.filter((a) => !a.time_and_half);
  const overtime = dayAssignments.filter((a) => a.time_and_half);
  return {
    date,
    manCount: dayAssignments.length,
    laborCost: round2(dayAssignments.reduce((sum, a) => sum + a.assignment_cost, 0)),
    normalCost: round2(normal.reduce((sum, a) => sum + a.assignment_cost, 0)),
    timeAndHalfCost: round2(overtime.reduce((sum, a) => sum + a.assignment_cost, 0)),
    normalDays: normal.length,
    timeAndHalfDays: overtime.length,
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

/** Total labor cost for a project across every scheduled date. */
export function projectLaborCost(assignments: ScheduleAssignment[], projectId: string): number {
  return round2(assignmentsForProject(assignments, projectId).reduce((sum, a) => sum + a.assignment_cost, 0));
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
  projectId: string
): ProjectCosting {
  const laborCost = projectLaborCost(assignments, projectId);
  const materialCost = round2(
    projectMaterials.filter((m) => m.project_id === projectId).reduce((sum, m) => sum + m.cost, 0)
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
