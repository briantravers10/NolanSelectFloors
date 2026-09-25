import {
  listBuildings,
  listClientCompanies,
  listContacts,
  listEmployees,
  listEmployeeAvailability,
  listJobRequests,
  listProjectMaterialStatuses,
  listProjects,
  listCrewRequirements,
  listScheduleAssignments,
  listTimeOffEntries,
  getLatestInboundEmailReceivedAt,
  listProjectScheduleDays,
  listActualLaborEntriesForDate,
} from "./db";
import { projectDisplayName, round2 } from "./calculations";
import { getTimeOffForDate, isEmployeeOffOn } from "./time-off";
import {
  compareCrewForProjectDate,
  summarizeDay,
} from "./calculations";
import { laborCostByEntryId } from "./labor-cost";
import { addDays, isoDate, todayIso } from "./dates";
import type { Employee, MaterialStatus, Project } from "./types";

export interface TodayJobRow {
  project: Project;
  buildingName: string;
  clientName: string;
  pmName: string;
  workTypes: string[];
  crew: { name: string; role: string; isDriver: boolean }[];
  manCount: number;
  laborCost: number;
  hasDriver: boolean;
  needsDriver: boolean;
  materialsWorstStatus: MaterialStatus | null;
  notes?: string;
}

export interface AttentionItem {
  severity: "bad" | "warn";
  message: string;
  href: string;
}

const MATERIAL_SEVERITY: Record<MaterialStatus, number> = {
  Problem: 6,
  Needed: 5,
  "Quote Requested": 4,
  Ordered: 3,
  "Partially Delivered": 2,
  Delivered: 0,
  Returned: 1,
};

export async function getDashboardData() {
  const today = todayIso();
  const [
    buildings,
    clientCompanies,
    contacts,
    employees,
    availability,
    jobRequests,
    projects,
    crewRequirements,
    assignments,
    projectMaterials,
    timeOffEntries,
    latestInboundReceivedAt,
    scheduleDays,
    todaysActualLaborEntries,
  ] = await Promise.all([
    listBuildings(),
    listClientCompanies(),
    listContacts(),
    listEmployees(),
    listEmployeeAvailability(),
    listJobRequests(),
    listProjects(),
    listCrewRequirements(),
    listScheduleAssignments(),
    listProjectMaterialStatuses(),
    listTimeOffEntries(),
    getLatestInboundEmailReceivedAt(),
    listProjectScheduleDays(),
    listActualLaborEntriesForDate(today),
  ]);

  const buildingById = new Map(buildings.map((b) => [b.id, b]));
  const clientById = new Map(clientCompanies.map((c) => [c.id, c]));
  const contactById = new Map(contacts.map((c) => [c.id, c]));
  const employeeById = new Map(employees.map((e) => [e.id, e]));

  const todaysAssignments = assignments.filter((a) => a.schedule_date === today);
  const todaysProjectIds = Array.from(new Set(todaysAssignments.map((a) => a.project_id)));

  const todaysJobs: TodayJobRow[] = todaysProjectIds
    .map((projectId): TodayJobRow | null => {
      const project = projects.find((p) => p.id === projectId);
      if (!project) return null;
      const building = buildingById.get(project.building_id);
      const client = building ? clientById.get(building.client_company_id) : undefined;
      const pm = building?.primary_contact_id ? contactById.get(building.primary_contact_id) : undefined;
      const dayAssignments = todaysAssignments.filter((a) => a.project_id === projectId);
      const crew = dayAssignments.map((a) => {
        const emp = employeeById.get(a.employee_id);
        return { name: emp ? `${emp.first_name} ${emp.last_name}` : "Unknown", role: a.role_on_job, isDriver: !!emp?.is_driver };
      });
      const summary = summarizeDay(dayAssignments, today);
      const needsDriver = project.needs_transportation;
      const hasDriver = crew.some((c) => c.isDriver);
      const materials = projectMaterials.filter((m) => m.project_id === projectId);
      const worst = materials.reduce<MaterialStatus | null>((acc, m) => {
        if (!acc) return m.status;
        return MATERIAL_SEVERITY[m.status] > MATERIAL_SEVERITY[acc] ? m.status : acc;
      }, null);
      return {
        project,
        buildingName: building?.name ?? "Unknown building",
        clientName: client?.name ?? "—",
        pmName: pm ? `${pm.first_name} ${pm.last_name}` : "—",
        workTypes: [] as string[],
        crew,
        manCount: summary.manCount,
        laborCost: summary.laborCost,
        hasDriver,
        needsDriver,
        materialsWorstStatus: worst,
        notes: project.notes,
      };
    })
    .filter((x): x is TodayJobRow => x !== null)
    .sort((a, b) => a.buildingName.localeCompare(b.buildingName));

  // Drivers/office staff marked "Working" for today (Create/Edit Schedule)
  // never appear in todaysJobs — they're never on a job's crew list, just a
  // day rate with no job assignment (actual_labor_entries, project_id
  // null; see lib/db.ts#setDriverWorkingDay/setOfficeWorkingDay). Still
  // real headcount and real cost for the day, so they're added in here.
  const todaysAssignedEmployeeIds = new Set(todaysAssignments.map((a) => a.employee_id));
  const todaysBaseEntries = todaysActualLaborEntries.filter((e) => e.project_id === null && !todaysAssignedEmployeeIds.has(e.employee_id));
  const baseEntryCosts = laborCostByEntryId(todaysBaseEntries);
  const baseManCount = todaysBaseEntries.length;
  const baseLaborCost = todaysBaseEntries.reduce((sum, e) => sum + (baseEntryCosts.get(e.id) ?? 0), 0);

  const totalManCount = todaysJobs.reduce((sum, j) => sum + j.manCount, 0) + baseManCount;
  const totalLaborCost = round2(todaysJobs.reduce((sum, j) => sum + j.laborCost, 0) + baseLaborCost);

  const activeEmployees = employees.filter((e) => e.active);
  const todaysAvailability = new Map(availability.filter((a) => a.schedule_date === today).map((a) => [a.employee_id, a.status]));
  // Vacation & Sick Day Tracker (build 7) — the real, auditable data source
  // going forward (see README). `employee_availability` above predates it
  // and still feeds this same stat, so both are honored: an employee counts
  // as "off" if EITHER says so.
  const todaysTimeOff = getTimeOffForDate(timeOffEntries, today);
  // Working = on a job's crew today OR a driver/office day-rate entry with
  // no job (todaysBaseEntries above) — without the latter, a driver/office
  // person marked Working showed up as "Available" instead, since they're
  // never in schedule_assignments.
  const workingIds = new Set([...todaysAssignments.map((a) => a.employee_id), ...todaysBaseEntries.map((e) => e.employee_id)]);
  let staffWorking = 0;
  let staffOff = 0;
  let staffAvailable = 0;
  for (const emp of activeEmployees) {
    const status = todaysAvailability.get(emp.id);
    const loggedOff = todaysTimeOff.has(emp.id) || status === "day_off" || status === "vacation" || status === "unavailable";
    // Confirmed working today (crew assignment, or a driver/office day
    // explicitly checked Working) wins over a general time-off/availability
    // flag — the schedule UI already lets the office check someone Working
    // as a deliberate override while they're marked off, and that override
    // should count here too, not silently flip them back to "Off".
    if (workingIds.has(emp.id)) staffWorking++;
    else if (loggedOff) staffOff++;
    else staffAvailable++;
  }

  // -------------------- Attention Required --------------------
  const attention: AttentionItem[] = [];

  // Missing crew today
  for (const job of todaysJobs) {
    const rows = compareCrewForProjectDate(crewRequirements, assignments, job.project.id, today);
    for (const row of rows.filter((r) => !r.complete)) {
      attention.push({
        severity: "bad",
        message: `${job.buildingName} (${job.project.name}) is missing ${row.missing} ${row.role}${row.missing > 1 ? "s" : ""} today`,
        href: `/projects/${job.project.id}`,
      });
    }
  }

  // Note: double-booking is NOT flagged here — staff are double-booked
  // often enough (per the client) that surfacing every instance as an
  // "attention required" item was just noise, not something to act on.

  // Scheduled during logged time off (Vacation & Sick Day Tracker, build 7)
  // — same "warn, don't block" pattern as double-booking above: this never
  // removes anyone from the crew, it just surfaces the conflict. Grouped by
  // (employee, time-off entry) rather than one item per assignment-day, so
  // a multi-day vacation with several conflicting shifts is one clear
  // attention item instead of flooding the list.
  const conflictsByEntry = new Map<string, { entry: (typeof timeOffEntries)[number]; dates: Set<string> }>();
  for (const a of assignments) {
    const entry = isEmployeeOffOn(timeOffEntries, a.employee_id, a.schedule_date);
    if (!entry) continue;
    if (!conflictsByEntry.has(entry.id)) conflictsByEntry.set(entry.id, { entry, dates: new Set() });
    conflictsByEntry.get(entry.id)!.dates.add(a.schedule_date);
  }
  for (const { entry, dates } of conflictsByEntry.values()) {
    const emp = employeeById.get(entry.employee_id);
    const sortedDates = Array.from(dates).sort();
    const range = entry.start_date === entry.end_date ? entry.start_date : `${entry.start_date} to ${entry.end_date}`;
    attention.push({
      severity: "warn",
      message: `${emp ? `${emp.first_name} ${emp.last_name}` : "An employee"} is scheduled on ${sortedDates.length} day(s) (${sortedDates[0]}${sortedDates.length > 1 ? "…" : ""}) while marked ${entry.type} (${range})`,
      href: `/staff/${entry.employee_id}`,
    });
  }

  // Materials not delivered for jobs starting soon (within 3 days)
  const soon = isoDate(addDays(new Date(), 3));
  for (const project of projects) {
    if (!project.start_date) continue;
    if (project.start_date < today || project.start_date > soon) continue;
    const materials = projectMaterials.filter((m) => m.project_id === project.id);
    const undelivered = materials.filter((m) => m.status !== "Delivered" && m.status !== "Returned");
    if (undelivered.length > 0) {
      const building = buildingById.get(project.building_id);
      attention.push({
        severity: "warn",
        message: `${building?.name ?? "Project"} (${project.name}) starts ${project.start_date === today ? "today" : "soon"} with ${undelivered.length} material item(s) not yet delivered`,
        href: `/projects/${project.id}`,
      });
    }
  }

  // Estimates awaiting approval
  for (const jr of jobRequests.filter((j) => j.status === "Awaiting Approval" || j.status === "Estimate Sent")) {
    const building = buildingById.get(jr.building_id);
    attention.push({
      severity: "warn",
      message: `Estimate awaiting approval — ${building?.name ?? "Building"}${jr.unit_number ? " Unit " + jr.unit_number : ""}`,
      href: `/job-requests/${jr.id}`,
    });
  }

  // Unprocessed new job requests
  for (const jr of jobRequests.filter((j) => j.status === "New Request")) {
    const building = buildingById.get(jr.building_id);
    attention.push({
      severity: "bad",
      message: `Unprocessed job request from ${building?.name ?? "a building"} needs to be triaged`,
      href: `/job-requests/${jr.id}`,
    });
  }

  // -------------------- Upcoming (next 7 days) --------------------
  const weekOut = isoDate(addDays(new Date(), 7));
  const upcomingProjects = projects
    .filter((p) => p.start_date && p.start_date > today && p.start_date <= weekOut)
    .sort((a, b) => (a.start_date! < b.start_date! ? -1 : 1))
    .map((p) => ({ project: p, building: buildingById.get(p.building_id) }));

  // Completed jobs nobody has marked "Invoice Sent" on yet — shows on
  // every dashboard until one person ticks it.
  // Meetings are never invoiced: a job whose schedule entries are all
  // meetings is skipped even when marked Complete.
  const meetingOnly = new Set<string>();
  {
    const byProject = new Map<string, { total: number; meetings: number }>();
    for (const d of scheduleDays) {
      const c = byProject.get(d.project_id) ?? { total: 0, meetings: 0 };
      c.total += 1;
      if (d.is_meeting) c.meetings += 1;
      byProject.set(d.project_id, c);
    }
    for (const [id, c] of byProject) if (c.total > 0 && c.meetings === c.total) meetingOnly.add(id);
  }
  const invoicesToSend = projects
    .filter((p) => p.pipeline_stage === "Complete" && !p.invoice_sent_at && !meetingOnly.has(p.id))
    .map((p) => {
      const building = buildings.find((b) => b.id === p.building_id);
      const client = building ? clientCompanies.find((c) => c.id === building.client_company_id) : undefined;
      return {
        projectId: p.id,
        name: projectDisplayName(p, building?.name),
        clientName: client?.name,
        completedOn: p.project_completed_at?.slice(0, 10) ?? null,
        value: p.project_value,
        assignedTo: p.invoice_assigned_to ?? null,
      };
    })
    .sort((a, b) => (a.completedOn ?? "").localeCompare(b.completedOn ?? ""));

  // Email intake health: warn when forwarded mail has stopped arriving.
  // Only meaningful once at least one email has ever come in.
  const lastInbound = latestInboundReceivedAt;
  const emailIntake = {
    lastReceivedAt: lastInbound,
    staleDays: lastInbound ? Math.floor((Date.now() - new Date(lastInbound).getTime()) / 86_400_000) : null,
  };

  return {
    emailIntake,
    invoicesToSend,
    today,
    todaysJobs,
    totalJobs: todaysJobs.length,
    totalManCount,
    totalLaborCost,
    staffWorking,
    staffAvailable,
    staffOff,
    attention,
    upcomingProjects,
  };
}

export function activeEmployeesOnly(employees: Employee[]) {
  return employees.filter((e) => e.active);
}
