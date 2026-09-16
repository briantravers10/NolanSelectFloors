// Schedule-specific business logic: color-priority sorting, actual-hours
// summation/validation warnings, the job-status <-> pipeline_stage mapping,
// and the Completed Job Summary compilation. Pure functions over arrays,
// same convention as lib/calculations.ts, so they work identically whether
// the data came from Supabase or the in-memory seed store.
import type {
  ActualLaborEntry,
  Building,
  BuildingContact,
  ClientCompany,
  CoiStatus,
  Contact,
  Employee,
  PipelineStage,
  Project,
  ProjectScheduleDay,
  QuickBooksDocument,
  ScheduleAssignment,
  ScheduleColor,
  ScheduleJobStatus,
  ScheduleMaterialsStatus,
  SchedulePickupItem,
  WorkTypeRecord,
} from "./types";
import { round2 } from "./calculations";
import { jobLaborSummary } from "./labor-cost";

// ---------------------------------------------------------------------
// SCHEDULE COLOR PRIORITY
// ---------------------------------------------------------------------

// YELLOW, then BLUE, then GRAY, then PINK — drives sort order everywhere
// the Daily/Weekly views render job rows.
const COLOR_PRIORITY: Record<ScheduleColor, number> = { Yellow: 0, Blue: 1, Gray: 2, Pink: 3 };

export function scheduleColorPriority(color: ScheduleColor): number {
  return COLOR_PRIORITY[color] ?? 99;
}

/**
 * Sorts job/day entries by schedule color priority first (Yellow, Blue,
 * Gray, Pink), then chronologically by the earliest call_time among that
 * job's crew for the day where one exists, then alphabetically as a stable
 * final tiebreak.
 */
export function sortScheduleDayRows<T extends { scheduleColor: ScheduleColor; earliestCallTime?: string | null; sortLabel?: string }>(
  rows: T[]
): T[] {
  return [...rows].sort((a, b) => {
    const p = scheduleColorPriority(a.scheduleColor) - scheduleColorPriority(b.scheduleColor);
    if (p !== 0) return p;
    const ta = parseCallTimeMinutes(a.earliestCallTime);
    const tb = parseCallTimeMinutes(b.earliestCallTime);
    if (ta !== tb) return ta - tb;
    return (a.sortLabel ?? "").localeCompare(b.sortLabel ?? "");
  });
}

/** Parses free-form call times like "7:00 AM" into minutes-since-midnight
 * for sorting; unparseable/missing values sort last. */
export function parseCallTimeMinutes(callTime?: string | null): number {
  if (!callTime) return 24 * 60 + 1;
  const m = callTime.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
  if (!m) return 24 * 60 + 1;
  let hour = parseInt(m[1], 10) % 12;
  const minute = parseInt(m[2], 10);
  if (m[3]?.toUpperCase() === "PM") hour += 12;
  return hour * 60 + minute;
}

// ---------------------------------------------------------------------
// JOB STATUS <-> PIPELINE STAGE MAPPING
// ---------------------------------------------------------------------
// Documented in README "Job Status <-> Pipeline Stage mapping". Setting a
// job_status from the Schedule always writes through to the real
// projects.pipeline_stage via lib/db.ts's setScheduleJobStatus — never an
// isolated duplicate.

export function mapJobStatusToPipelineStage(status: ScheduleJobStatus): PipelineStage {
  switch (status) {
    case "Scheduled":
      return "Scheduled";
    case "In Progress":
      return "In Progress";
    case "Complete":
      return "Complete";
  }
}

export function mapPipelineStageToJobStatus(stage: PipelineStage): ScheduleJobStatus {
  switch (stage) {
    case "Bid Sent":
    case "Bid Accepted":
    case "Scheduled":
      return "Scheduled";
    case "In Progress":
      return "In Progress";
    case "Complete":
      return "Complete";
  }
}

// ---------------------------------------------------------------------
// ACTUAL HOURS — summation + soft-warning validation
// ---------------------------------------------------------------------

export interface EmployeeDayTotal {
  employee_id: string;
  work_date: string;
  totalHours: number;
  entries: ActualLaborEntry[];
}

export function totalActualHoursByEmployeeDay(entries: ActualLaborEntry[]): EmployeeDayTotal[] {
  const map = new Map<string, EmployeeDayTotal>();
  for (const e of entries) {
    const key = `${e.employee_id}__${e.work_date}`;
    if (!map.has(key)) map.set(key, { employee_id: e.employee_id, work_date: e.work_date, totalHours: 0, entries: [] });
    const bucket = map.get(key)!;
    bucket.totalHours = round2(bucket.totalHours + e.hours);
    bucket.entries.push(e);
  }
  return Array.from(map.values());
}

export interface ActualHoursWarning {
  type: "high_total" | "possible_duplicate";
  employee_id: string;
  work_date: string;
  message: string;
}

const HIGH_HOURS_THRESHOLD = 16;
const DUPLICATE_WINDOW_MINUTES = 15;

/**
 * Soft warnings only — never a hard block, per spec: an unusually high
 * daily total (sum > 16 hrs) and likely-accidental duplicate entries (same
 * employee+project+date+hours logged within a few minutes of each other).
 */
export function actualHoursWarnings(entries: ActualLaborEntry[]): ActualHoursWarning[] {
  const warnings: ActualHoursWarning[] = [];
  const dayTotals = totalActualHoursByEmployeeDay(entries);
  for (const day of dayTotals) {
    if (day.totalHours > HIGH_HOURS_THRESHOLD) {
      warnings.push({
        type: "high_total",
        employee_id: day.employee_id,
        work_date: day.work_date,
        message: `Logged ${day.totalHours} hrs total on ${day.work_date} — that's unusually high. Double-check before confirming the day.`,
      });
    }
  }

  const byGroup = new Map<string, ActualLaborEntry[]>();
  for (const e of entries) {
    const key = `${e.employee_id}__${e.project_id}__${e.work_date}__${e.hours}`;
    if (!byGroup.has(key)) byGroup.set(key, []);
    byGroup.get(key)!.push(e);
  }
  for (const group of byGroup.values()) {
    if (group.length < 2) continue;
    const sorted = [...group].sort((a, b) => a.created_at.localeCompare(b.created_at));
    for (let i = 1; i < sorted.length; i++) {
      const gapMinutes = (new Date(sorted[i].created_at).getTime() - new Date(sorted[i - 1].created_at).getTime()) / 60000;
      if (gapMinutes >= 0 && gapMinutes <= DUPLICATE_WINDOW_MINUTES) {
        warnings.push({
          type: "possible_duplicate",
          employee_id: sorted[i].employee_id,
          work_date: sorted[i].work_date,
          message: `Two ${sorted[i].hours}-hr entries for the same job on ${sorted[i].work_date} were logged within ${Math.round(gapMinutes)} min of each other — possible accidental duplicate.`,
        });
        break;
      }
    }
  }
  return warnings;
}

// ---------------------------------------------------------------------
// DAILY / WEEKLY JOB ROW VIEW MODEL — one row per job per day, the shape
// every schedule view (Daily/Weekly/Monthly/Review) renders from.
// ---------------------------------------------------------------------

export interface ScheduleJobRow {
  key: string;
  projectId: string;
  date: string;
  project: Project;
  buildingName?: string;
  address?: string;
  unitNumber?: string;
  clientName?: string;
  contactName?: string;
  contactPhone?: string;
  contactEmail?: string;
  crewCount: number;
  crewNames: string[];
  crew: { assignmentId: string; employeeId: string; name: string }[];
  coiStatus: CoiStatus;
  materialsStatus: ScheduleMaterialsStatus;
  jobStatus: ScheduleJobStatus;
  scheduleColor: ScheduleColor;
  workTypeName?: string;
  notes?: string;
  scheduleDayId?: string;
  earliestCallTime?: string | null;
  // "Items to Order / Collect" (build 8) — empty when the job/day has no
  // project_schedule_days row yet, or none were added.
  pickupItems: SchedulePickupItem[];
  // QUICKBOOKS (build 10) — read-only, inherited automatically via
  // project_id, per the client's explicit "no manual entry fields on
  // Create/Edit Schedule, no QuickBooks settings/editing controls on View
  // Schedule" instruction. Empty when nothing's linked, or when
  // qbDocuments wasn't passed in (older call sites).
  qbDocuments: QuickBooksDocument[];
}

export interface ScheduleRowInputs {
  projects: Project[];
  buildings: Building[];
  clients: ClientCompany[];
  contacts: Contact[];
  buildingContacts: BuildingContact[];
  employees: Employee[];
  assignments: ScheduleAssignment[];
  scheduleDays: ProjectScheduleDay[];
  workTypes: WorkTypeRecord[];
  // Optional — omitted callers (e.g. older call sites) simply render no
  // pickup items rather than needing every page updated at once.
  pickupItems?: SchedulePickupItem[];
  // Optional, same convention as pickupItems above.
  qbDocuments?: QuickBooksDocument[];
}

function pointOfContact(
  buildingId: string | undefined,
  buildings: Building[],
  buildingContacts: BuildingContact[],
  contacts: Contact[]
): Contact | undefined {
  const building = buildings.find((b) => b.id === buildingId);
  if (building?.primary_contact_id) {
    const c = contacts.find((c) => c.id === building.primary_contact_id);
    if (c) return c;
  }
  const link = buildingContacts.find((bc) => bc.building_id === buildingId && bc.is_primary) ?? buildingContacts.find((bc) => bc.building_id === buildingId);
  return link ? contacts.find((c) => c.id === link.contact_id) : undefined;
}

/** Builds the one-row-per-job list for a given date, sorted by schedule
 * color priority then earliest call time. Every project with EITHER a
 * project_schedule_days row OR a schedule_assignments row for the date
 * shows up — a job can be on the schedule with crew not yet assigned. */
export function buildScheduleJobRows(date: string, input: ScheduleRowInputs): ScheduleJobRow[] {
  const { projects, buildings, clients, contacts, buildingContacts, employees, assignments, scheduleDays, workTypes, pickupItems = [], qbDocuments = [] } = input;
  const projectById = new Map(projects.map((p) => [p.id, p]));
  const buildingById = new Map(buildings.map((b) => [b.id, b]));
  const clientById = new Map(clients.map((c) => [c.id, c]));
  const employeeById = new Map(employees.map((e) => [e.id, e]));
  const workTypeById = new Map(workTypes.map((w) => [w.id, w]));

  const dayAssignments = assignments.filter((a) => a.schedule_date === date);
  const dayScheduleDays = scheduleDays.filter((d) => d.schedule_date === date);
  const projectIds = new Set([...dayAssignments.map((a) => a.project_id), ...dayScheduleDays.map((d) => d.project_id)]);

  const rows: ScheduleJobRow[] = [];
  for (const projectId of projectIds) {
    const project = projectById.get(projectId);
    if (!project) continue;
    const building = buildingById.get(project.building_id);
    const client = building ? clientById.get(building.client_company_id) : undefined;
    const contact = pointOfContact(project.building_id, buildings, buildingContacts, contacts);
    const crew = dayAssignments.filter((a) => a.project_id === projectId);
    const crewNames = crew.map((a) => {
      const e = employeeById.get(a.employee_id);
      return e ? `${e.first_name} ${e.last_name}` : "Unknown";
    });
    const crewList = crew.map((a) => {
      const e = employeeById.get(a.employee_id);
      return { assignmentId: a.id, employeeId: a.employee_id, name: e ? `${e.first_name} ${e.last_name}` : "Unknown" };
    });
    const scheduleDay = dayScheduleDays.find((d) => d.project_id === projectId);
    const earliestCallTime = crew.length > 0 ? crew.reduce<string | null>((min, a) => {
      if (!a.call_time) return min;
      if (min === null) return a.call_time;
      return parseCallTimeMinutes(a.call_time) < parseCallTimeMinutes(min) ? a.call_time : min;
    }, null) : null;

    rows.push({
      key: `${projectId}__${date}`,
      projectId,
      date,
      project,
      buildingName: building?.name,
      address: building?.address,
      unitNumber: project.unit_number,
      clientName: client?.name,
      contactName: contact ? `${contact.first_name} ${contact.last_name}` : undefined,
      contactPhone: contact?.phone ?? contact?.mobile_phone,
      contactEmail: contact?.email,
      crewCount: crew.length,
      crewNames,
      crew: crewList,
      coiStatus: scheduleDay?.coi_status ?? "Not Sent",
      materialsStatus: scheduleDay?.materials_status ?? "Not Ordered",
      jobStatus: scheduleDay?.job_status ?? mapPipelineStageToJobStatus(project.pipeline_stage),
      scheduleColor: scheduleDay?.schedule_color ?? "Pink",
      workTypeName: scheduleDay?.work_type_id ? workTypeById.get(scheduleDay.work_type_id)?.name : undefined,
      notes: scheduleDay?.notes || project.description,
      scheduleDayId: scheduleDay?.id,
      earliestCallTime,
      pickupItems: scheduleDay ? pickupItems.filter((i) => i.project_schedule_day_id === scheduleDay.id) : [],
      qbDocuments: qbDocuments.filter((d) => d.project_id === projectId),
    });
  }

  const withSortLabel = rows.map((r) => ({ ...r, sortLabel: r.buildingName ?? r.projectId }));
  return sortScheduleDayRows<(typeof withSortLabel)[number]>(withSortLabel);
}

// ---------------------------------------------------------------------
// CHANGE HISTORY — which activity_log actions count as "schedule" activity
// for the Schedule section's Change History / Activity view, so it doesn't
// show the whole app's unrelated activity log (bids, invoices, etc).
// ---------------------------------------------------------------------
const SCHEDULE_ACTIVITY_PREFIXES = [
  "Assigned crew",
  "Removed crew assignment",
  "Schedule color changed",
  "COI status changed",
  "Materials status changed",
  "Job status changed",
  "Work type changed",
  "Notes changed",
  "Logged actual hours",
  "Edited actual hours entry",
  "Deleted actual hours entry",
  "Confirmed day",
  "Added work type",
  "Updated work type",
  "Updated completion notes",
  "Added pickup item",
  "Marked pickup item collected",
  "Marked pickup item needed",
  "Removed pickup item",
];

export function isScheduleActivity(action: string): boolean {
  return SCHEDULE_ACTIVITY_PREFIXES.some((p) => action.startsWith(p));
}

// ---------------------------------------------------------------------
// COMPLETED JOB SUMMARY
// ---------------------------------------------------------------------

export interface CompletedJobEmployeeLabor {
  employee_id: string;
  employeeName: string;
  daysWorked: number;
  totalHours: number;
  source: "actual" | "planned-fallback";
  // ACTUAL-cost labor tracking (build 6) — only populated when `source` is
  // "actual" (computed from actual_labor_entries.rate_type/rate_amount, see
  // lib/labor-cost.ts). Deliberately left undefined for "planned-fallback"
  // rows rather than substituting a planned-cost figure, so callers never
  // confuse the two systems. Access-gate this before rendering — see
  // lib/current-user.ts canViewLaborCost().
  laborCost?: number;
}

export interface CompletedJobSummary {
  project: Project;
  building?: Building;
  client?: ClientCompany;
  contactName?: string;
  contactPhone?: string;
  startDate?: string;
  completionDate?: string;
  totalDays: number;
  labor: CompletedJobEmployeeLabor[];
  totalCrew: number;
  totalManHours: number;
  // Sum of the "actual"-sourced labor.laborCost figures only (see above) —
  // the headline ACTUAL labor cost for this job. Gate visibility the same
  // way as labor[].laborCost.
  totalLaborCost: number;
  coiStatus?: string;
  materialsStatus?: string;
  notes: string[];
  completionNotes?: string;
  // QUICKBOOKS (build 10) — read-only, inherited via project_id, no manual
  // re-entry. See lib/quickbooks.ts / README.
  qbDocuments: QuickBooksDocument[];
}

/**
 * Compiles a Completed Job Summary entirely from existing data — nothing
 * here is manually re-entered except the separate, editable
 * `completionNotes` field the caller may attach afterward. Per-employee
 * hours use actual_labor_entries when present for that employee/date,
 * falling back to a planned-schedule hours-equivalent (one
 * schedule_assignments row = one 8-hour day) when actual-hours logging is
 * sparse, so the summary isn't empty for older/lightly-tracked jobs.
 */
export function compileCompletedJobSummary(
  project: Project,
  opts: {
    building?: Building;
    client?: ClientCompany;
    contact?: Contact;
    assignments: ScheduleAssignment[];
    scheduleDays: ProjectScheduleDay[];
    actualLaborEntries: ActualLaborEntry[];
    employees: Employee[];
    notes: string[];
    completionNotes?: string;
    qbDocuments?: QuickBooksDocument[];
  }
): CompletedJobSummary {
  const projectAssignments = opts.assignments.filter((a) => a.project_id === project.id);
  const projectActuals = opts.actualLaborEntries.filter((a) => a.project_id === project.id);
  const projectDays = opts.scheduleDays.filter((d) => d.project_id === project.id);

  const allDates = Array.from(
    new Set([...projectAssignments.map((a) => a.schedule_date), ...projectActuals.map((a) => a.work_date), ...projectDays.map((d) => d.schedule_date)])
  ).sort();
  const startDate = allDates[0] ?? project.start_date;
  const completionDate = allDates[allDates.length - 1] ?? project.actual_end_date;
  const totalDays = allDates.length;

  const employeeIds = Array.from(new Set([...projectAssignments.map((a) => a.employee_id), ...projectActuals.map((a) => a.employee_id)]));
  const employeeById = new Map(opts.employees.map((e) => [e.id, e]));
  // ACTUAL-cost figures for this project, computed once from
  // actual_labor_entries via lib/labor-cost.ts — never manually entered.
  const laborCostSummary = jobLaborSummary(project.id, opts.actualLaborEntries, opts.employees);
  const laborCostByEmployee = new Map(laborCostSummary.rows.map((r) => [r.employee_id, r.totalCost]));

  const labor: CompletedJobEmployeeLabor[] = employeeIds.map((employeeId) => {
    const actualsForEmployee = projectActuals.filter((a) => a.employee_id === employeeId);
    const emp = employeeById.get(employeeId);
    const employeeName = emp ? `${emp.first_name} ${emp.last_name}` : employeeId;
    if (actualsForEmployee.length > 0) {
      const days = new Set(actualsForEmployee.map((a) => a.work_date));
      return {
        employee_id: employeeId,
        employeeName,
        daysWorked: days.size,
        totalHours: round2(actualsForEmployee.reduce((sum, a) => sum + a.hours, 0)),
        source: "actual",
        laborCost: laborCostByEmployee.get(employeeId) ?? 0,
      };
    }
    // Fallback: no actual-hours logged for this employee — treat each
    // planned schedule_assignments day as an 8-hour day. No labor cost is
    // computed here (that would mix the planned- and actual-cost systems).
    const plannedDays = new Set(projectAssignments.filter((a) => a.employee_id === employeeId).map((a) => a.schedule_date));
    return {
      employee_id: employeeId,
      employeeName,
      daysWorked: plannedDays.size,
      totalHours: plannedDays.size * 8,
      source: "planned-fallback",
    };
  });

  const totalManHours = round2(labor.reduce((sum, l) => sum + l.totalHours, 0));
  const totalLaborCost = laborCostSummary.totalLaborCost;
  const lastDay = projectDays.length > 0 ? [...projectDays].sort((a, b) => b.schedule_date.localeCompare(a.schedule_date))[0] : undefined;

  return {
    project,
    building: opts.building,
    client: opts.client,
    contactName: opts.contact ? `${opts.contact.first_name} ${opts.contact.last_name}` : undefined,
    contactPhone: opts.contact?.phone ?? opts.contact?.mobile_phone,
    startDate,
    completionDate,
    totalDays,
    labor,
    totalCrew: employeeIds.length,
    totalManHours,
    totalLaborCost,
    coiStatus: lastDay?.coi_status,
    materialsStatus: lastDay?.materials_status,
    notes: opts.notes,
    completionNotes: opts.completionNotes,
    qbDocuments: (opts.qbDocuments ?? []).filter((d) => d.project_id === project.id),
  };
}
