import {
  listBuildings,
  listClientCompanies,
  listContacts,
  listEmployees,
  listEmployeeAvailability,
  listJobRequests,
  listProjectMaterials,
  listProjects,
  listCrewRequirements,
  listScheduleAssignments,
  listTasks,
} from "./db";
import {
  compareCrewForProjectDate,
  findDoubleBookings,
  isMissingDriver,
  summarizeDay,
} from "./calculations";
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
    tasks,
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
    listProjectMaterials(),
    listTasks(),
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

  const totalManCount = todaysJobs.reduce((sum, j) => sum + j.manCount, 0);
  const totalLaborCost = todaysJobs.reduce((sum, j) => sum + j.laborCost, 0);

  const activeEmployees = employees.filter((e) => e.active);
  const todaysAvailability = new Map(availability.filter((a) => a.schedule_date === today).map((a) => [a.employee_id, a.status]));
  const workingIds = new Set(todaysAssignments.map((a) => a.employee_id));
  let staffWorking = 0;
  let staffOff = 0;
  let staffAvailable = 0;
  for (const emp of activeEmployees) {
    const status = todaysAvailability.get(emp.id);
    if (workingIds.has(emp.id)) staffWorking++;
    else if (status === "day_off" || status === "vacation" || status === "unavailable") staffOff++;
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

  // No driver assigned
  for (const job of todaysJobs) {
    if (isMissingDriver(job.project, assignments, employees, job.project.id, today)) {
      attention.push({
        severity: "bad",
        message: `NO DRIVER ASSIGNED — ${job.buildingName} (${job.project.name}) needs transportation today`,
        href: `/projects/${job.project.id}`,
      });
    }
  }

  // Double-booked staff (this week)
  const doubleBookings = findDoubleBookings(assignments);
  for (const db of doubleBookings) {
    const emp = employeeById.get(db.employee_id);
    const names = db.project_ids
      .map((pid) => projects.find((p) => p.id === pid)?.name ?? pid)
      .join(" and ");
    attention.push({
      severity: "bad",
      message: `${emp ? `${emp.first_name} ${emp.last_name}` : "An employee"} is double-booked on ${db.schedule_date}: ${names}`,
      href: `/schedule?date=${db.schedule_date}`,
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

  // Overdue tasks
  for (const task of tasks.filter((t) => t.status !== "Completed" && t.due_date && t.due_date < today)) {
    attention.push({
      severity: "bad",
      message: `Overdue task: ${task.title}`,
      href: `/tasks`,
    });
  }

  // -------------------- Upcoming (next 7 days) --------------------
  const weekOut = isoDate(addDays(new Date(), 7));
  const upcomingProjects = projects
    .filter((p) => p.start_date && p.start_date > today && p.start_date <= weekOut)
    .sort((a, b) => (a.start_date! < b.start_date! ? -1 : 1))
    .map((p) => ({ project: p, building: buildingById.get(p.building_id) }));

  return {
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
