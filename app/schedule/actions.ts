"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  confirmDay,
  createActualLaborEntry,
  createBuildingContact,
  createBuildingRecord,
  createClientCompanyRecord,
  createContact,
  getOrCreateUnassignedClient,
  listActualLaborEntries,
  listBuildingContacts,
  listBuildings,
  listClientCompanies,
  listContacts,
  listProjects,
  removeProjectFromSchedule,
  updateBuilding,
  updateContact,
  updateProjectUnitNumber,
  createScheduleAssignment,
  createQuickProject,
  createSchedulePickupItem,
  createWorkType,
  deleteActualLaborEntry,
  deleteScheduleAssignment,
  deleteSchedulePickupItem,
  getOrCreateProjectScheduleDay,
  listScheduleAssignments,
  saveCompletionNotes,
  toggleSchedulePickupItemStatus,
  updateActualLaborEntry,
  updateProjectScheduleDay,
  updateScheduleAssignmentCallTime,
  updateWorkType,
} from "@/lib/db";
import { getActingUser } from "@/lib/current-user";
import { canEdit } from "@/lib/permissions";
import type { BuildingRegion, CoiStatus, ScheduleColor, ScheduleJobStatus, ScheduleMaterialsStatus, StaffCapability } from "@/lib/types";
import { BUILDING_REGIONS } from "@/lib/types";

function revalidateSchedule(projectId?: string) {
  revalidatePath("/schedule");
  revalidatePath("/schedule/review");
  revalidatePath("/schedule/history");
  revalidatePath("/schedule/completed");
  revalidatePath("/dashboard");
  if (projectId) revalidatePath(`/projects/${projectId}`);
}

export async function addAssignmentAction(formData: FormData) {
  if (!(await canEdit("schedule"))) return;
  const project_id = String(formData.get("project_id") ?? "");
  const employee_id = String(formData.get("employee_id") ?? "");
  const schedule_date = String(formData.get("schedule_date") ?? "");
  const role_on_job = String(formData.get("role_on_job") ?? "") as StaffCapability;
  const time_and_half = formData.get("time_and_half") === "on";
  const call_time = String(formData.get("call_time") ?? "").trim() || "7:00 AM";
  if (!project_id || !employee_id || !schedule_date || !role_on_job) return;
  const actingUser = await getActingUser();
  await createScheduleAssignment({ project_id, employee_id, schedule_date, role_on_job, time_and_half, call_time, actorName: actingUser.fullName });
  revalidateSchedule(project_id);
}

export async function setAssignmentCallTimeAction(id: string, projectId: string, formData: FormData) {
  if (!(await canEdit("schedule"))) return;
  const call_time = String(formData.get("call_time") ?? "").trim() || "7:00 AM";
  await updateScheduleAssignmentCallTime(id, call_time);
  revalidateSchedule(projectId);
}

export async function removeAssignmentAction(id: string, projectId: string) {
  if (!(await canEdit("schedule"))) return;
  const actingUser = await getActingUser();
  await deleteScheduleAssignment(id, actingUser.fullName);
  revalidateSchedule(projectId);
}

// ---------------------------------------------------------------------
// Schedule day entry — inline color / COI / materials / job status
// ---------------------------------------------------------------------

export async function setScheduleColorAction(projectId: string, date: string, formData: FormData) {
  if (!(await canEdit("schedule"))) return;
  const color = String(formData.get("schedule_color") ?? "") as ScheduleColor;
  if (!color) return;
  const actingUser = await getActingUser();
  const day = await getOrCreateProjectScheduleDay(projectId, date, actingUser.fullName);
  await updateProjectScheduleDay(day.id, { schedule_color: color }, actingUser.fullName);
  revalidateSchedule(projectId);
}

export async function setCoiStatusAction(projectId: string, date: string, formData: FormData) {
  if (!(await canEdit("schedule"))) return;
  const coi_status = String(formData.get("coi_status") ?? "") as CoiStatus;
  if (!coi_status) return;
  const actingUser = await getActingUser();
  const day = await getOrCreateProjectScheduleDay(projectId, date, actingUser.fullName);
  await updateProjectScheduleDay(day.id, { coi_status }, actingUser.fullName);
  revalidateSchedule(projectId);
}

export async function setMaterialsStatusAction(projectId: string, date: string, formData: FormData) {
  if (!(await canEdit("schedule"))) return;
  const materials_status = String(formData.get("materials_status") ?? "") as ScheduleMaterialsStatus;
  if (!materials_status) return;
  const actingUser = await getActingUser();
  const day = await getOrCreateProjectScheduleDay(projectId, date, actingUser.fullName);
  await updateProjectScheduleDay(day.id, { materials_status }, actingUser.fullName);
  revalidateSchedule(projectId);
}

export async function setJobStatusAction(projectId: string, date: string, formData: FormData) {
  if (!(await canEdit("schedule"))) return;
  const job_status = String(formData.get("job_status") ?? "") as ScheduleJobStatus;
  if (!job_status) return;
  const actingUser = await getActingUser();
  const day = await getOrCreateProjectScheduleDay(projectId, date, actingUser.fullName);
  await updateProjectScheduleDay(day.id, { job_status }, actingUser.fullName);
  revalidateSchedule(projectId);
}

export async function setWorkTypeAction(projectId: string, date: string, formData: FormData) {
  if (!(await canEdit("schedule"))) return;
  const work_type_id = String(formData.get("work_type_id") ?? "") || undefined;
  const actingUser = await getActingUser();
  const day = await getOrCreateProjectScheduleDay(projectId, date, actingUser.fullName);
  await updateProjectScheduleDay(day.id, { work_type_id }, actingUser.fullName);
  revalidateSchedule(projectId);
}

export async function setScheduleNotesAction(projectId: string, date: string, formData: FormData) {
  if (!(await canEdit("schedule"))) return;
  const notes = String(formData.get("notes") ?? "");
  const actingUser = await getActingUser();
  const day = await getOrCreateProjectScheduleDay(projectId, date, actingUser.fullName);
  await updateProjectScheduleDay(day.id, { notes }, actingUser.fullName);
  revalidateSchedule(projectId);
}

// ---------------------------------------------------------------------
// Items to Order / Collect — a lightweight per-schedule-entry checklist
// (build 8), separate from the heavier project_materials system. Each add
// happens immediately (not deferred to "Save to Schedule"), the same "quick
// inline add" convention as AddTimeOffForm, so getOrCreateProjectScheduleDay
// is called here too — adding the first item can create the day row before
// the main form is ever saved.
// ---------------------------------------------------------------------

export async function addPickupItemAction(projectId: string, date: string, formData: FormData) {
  if (!(await canEdit("schedule"))) return;
  const description = String(formData.get("description") ?? "").trim();
  if (!projectId || !date || !description) return;
  const actingUser = await getActingUser();
  const day = await getOrCreateProjectScheduleDay(projectId, date, actingUser.fullName);
  await createSchedulePickupItem({ project_schedule_day_id: day.id, description, actorName: actingUser.fullName });
  revalidateSchedule(projectId);
}

export async function togglePickupItemStatusAction(id: string, projectId: string) {
  if (!(await canEdit("schedule"))) return;
  const actingUser = await getActingUser();
  await toggleSchedulePickupItemStatus(id, actingUser.fullName);
  revalidateSchedule(projectId);
}

export async function deletePickupItemAction(id: string, projectId: string) {
  if (!(await canEdit("schedule"))) return;
  const actingUser = await getActingUser();
  await deleteSchedulePickupItem(id, actingUser.fullName);
  revalidateSchedule(projectId);
}

// ---------------------------------------------------------------------
// Create / Edit Schedule — the single "SAVE TO SCHEDULE" form action.
// Reuses the exact per-field actions above (and, through them, the same
// getOrCreateProjectScheduleDay/updateProjectScheduleDay/createScheduleAssignment/
// deleteScheduleAssignment calls and audit logging the previous
// inline-dropdown implementation used) — just from one combined form
// instead of from inline row controls. Only fields that actually changed
// are written, so re-saving an untouched value never creates a spurious
// Change History entry, and editing never creates a duplicate schedule
// record — it updates the same project_schedule_days/schedule_assignments
// rows in place.
// ---------------------------------------------------------------------

export async function saveScheduleEntryAction(formData: FormData) {
  if (!(await canEdit("schedule"))) return;
  const project_id = String(formData.get("project_id") ?? "");
  const schedule_date = String(formData.get("schedule_date") ?? "");
  if (!project_id || !schedule_date) return;

  const actingUser = await getActingUser();
  const day = await getOrCreateProjectScheduleDay(project_id, schedule_date, actingUser.fullName);

  // Unit number lives on the project, editable from here for convenience.
  if (formData.has("unit_number")) {
    const unit = String(formData.get("unit_number") ?? "").trim() || undefined;
    const project = (await listProjects()).find((p) => p.id === project_id);
    if (project && (project.unit_number ?? undefined) !== unit) await updateProjectUnitNumber(project_id, unit, actingUser.fullName);
  }

  const schedule_color = String(formData.get("schedule_color") ?? "");
  const coi_status = String(formData.get("coi_status") ?? "");
  const materials_status = String(formData.get("materials_status") ?? "");
  const job_status = String(formData.get("job_status") ?? "");
  const work_type_id = String(formData.get("work_type_id") ?? "");
  const notes = String(formData.get("notes") ?? "");

  const markComplete = schedule_color === "Complete";
  if (!markComplete && schedule_color && schedule_color !== day.schedule_color) await setScheduleColorAction(project_id, schedule_date, formData);
  if (coi_status && coi_status !== day.coi_status) await setCoiStatusAction(project_id, schedule_date, formData);
  if (materials_status && materials_status !== day.materials_status) await setMaterialsStatusAction(project_id, schedule_date, formData);
  if (markComplete) {
    // "Completed" from the Schedule Type dropdown: writes job_status
    // (and through it the project's pipeline stage) so the job drops off
    // the schedule from the next day onward.
    const done = new FormData();
    done.set("job_status", "Complete");
    if (day.job_status !== "Complete") await setJobStatusAction(project_id, schedule_date, done);
  } else if (job_status && job_status !== day.job_status) await setJobStatusAction(project_id, schedule_date, formData);
  if (work_type_id !== (day.work_type_id ?? "")) await setWorkTypeAction(project_id, schedule_date, formData);
  if (notes !== (day.notes ?? "")) await setScheduleNotesAction(project_id, schedule_date, formData);

  // Crew — reconcile the selected employee checkboxes against the
  // existing schedule_assignments for this project+date, reusing the same
  // add/remove actions (and their audit logging) as before.
  const selectedEmployeeIds = new Set(formData.getAll("employee_ids").map(String).filter(Boolean));
  const currentAssignments = (await listScheduleAssignments()).filter(
    (a) => a.project_id === project_id && a.schedule_date === schedule_date
  );

  for (const assignment of currentAssignments) {
    if (!selectedEmployeeIds.has(assignment.employee_id)) {
      await removeAssignmentAction(assignment.id, project_id);
    }
  }
  for (const employeeId of selectedEmployeeIds) {
    if (!currentAssignments.some((a) => a.employee_id === employeeId)) {
      const crewForm = new FormData();
      crewForm.set("project_id", project_id);
      crewForm.set("employee_id", employeeId);
      crewForm.set("schedule_date", schedule_date);
      crewForm.set("role_on_job", "Installer");
      crewForm.set("call_time", "7:00 AM");
      await addAssignmentAction(crewForm);
    }
  }

  // Stay on Create/Edit so the change is visible right away in the
  // day's list next to the form (View Schedule is still one tab away).
  redirect(`/schedule/edit?date=${schedule_date}`);
}

// ---------------------------------------------------------------------
// Actual hours
// ---------------------------------------------------------------------

export async function addActualLaborEntryAction(formData: FormData) {
  if (!(await canEdit("schedule"))) return;
  const employee_id = String(formData.get("employee_id") ?? "");
  const project_id = String(formData.get("project_id") ?? "");
  const work_date = String(formData.get("work_date") ?? "");
  const hours = Number(formData.get("hours") ?? 0);
  const start_time = String(formData.get("start_time") ?? "") || undefined;
  const end_time = String(formData.get("end_time") ?? "") || undefined;
  const notes = String(formData.get("notes") ?? "") || undefined;
  if (!employee_id || !project_id || !work_date || !hours) return;
  const actingUser = await getActingUser();
  await createActualLaborEntry({ employee_id, project_id, work_date, hours, start_time, end_time, notes, actorName: actingUser.fullName });
  revalidateSchedule(project_id);
}

export async function deleteActualLaborEntryAction(id: string) {
  if (!(await canEdit("schedule"))) return;
  const actingUser = await getActingUser();
  await deleteActualLaborEntry(id, actingUser.fullName);
  revalidateSchedule();
}

// ---------------------------------------------------------------------
// End-of-day review / confirm day
// ---------------------------------------------------------------------

export async function confirmDayAction(workDate: string, formData: FormData) {
  if (!(await canEdit("schedule"))) return;
  const notes = String(formData.get("notes") ?? "") || undefined;
  const actingUser = await getActingUser();
  await confirmDay(workDate, actingUser.fullName, notes);
  revalidateSchedule();
}

// ---------------------------------------------------------------------
// Completed Job Summary — the one manually-editable field
// ---------------------------------------------------------------------

export async function saveCompletionNotesAction(projectId: string, formData: FormData) {
  if (!(await canEdit("schedule"))) return;
  const body = String(formData.get("completion_notes") ?? "").trim();
  if (!body) return;
  const actingUser = await getActingUser();
  await saveCompletionNotes(projectId, body, actingUser.fullName);
  revalidatePath("/schedule/completed");
}

// ---------------------------------------------------------------------
// Work types admin (Company Setup)
// ---------------------------------------------------------------------

export async function addWorkTypeAction(formData: FormData) {
  if (!(await canEdit("company_setup"))) return;
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;
  await createWorkType(name);
  revalidatePath("/company-setup");
}

export async function renameWorkTypeAction(id: string, formData: FormData) {
  if (!(await canEdit("company_setup"))) return;
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;
  await updateWorkType(id, { name });
  revalidatePath("/company-setup");
}

export async function toggleWorkTypeActiveAction(id: string, active: boolean) {
  if (!(await canEdit("company_setup"))) return;
  await updateWorkType(id, { active });
  revalidatePath("/company-setup");
}

/**
 * Quick Job from the schedule page: building + optional unit + a line of
 * what the work is → a project straight in "Scheduled", then back to
 * Create/Edit with that job loaded in the form so crew/color can be set.
 */
export async function createQuickJobAction(formData: FormData) {
  if (!(await canEdit("schedule"))) return;
  const schedule_date = String(formData.get("schedule_date") ?? "");
  const description = String(formData.get("description") ?? "").trim();
  const buildingName = String(formData.get("building_name") ?? "").trim();
  const clientName = String(formData.get("client_name") ?? "").trim();
  const contactName = String(formData.get("contact_name") ?? "").trim();
  const contactPhone = String(formData.get("contact_phone") ?? "").trim();
  if (!schedule_date || !description || !buildingName) return;

  const norm = (x: string) => x.trim().toLowerCase();
  const [buildings, clients, contacts, links] = await Promise.all([listBuildings(), listClientCompanies(), listContacts(), listBuildingContacts()]);

  // Management company: pick the existing one by name, or create it.
  let client = clientName ? clients.find((c) => norm(c.name) === norm(clientName)) : undefined;

  // Building: existing by name (preferring one under the named company),
  // otherwise created under the company — which then must be known.
  const nameMatches = buildings.filter((b) => norm(b.name) === norm(buildingName) || norm(b.address) === norm(buildingName));
  let building = client ? nameMatches.find((b) => b.client_company_id === client!.id) ?? nameMatches[0] : nameMatches[0];
  if (building && !client) client = clients.find((c) => c.id === building!.client_company_id);
  if (!building) {
    if (!client) {
      // No company given: file the building under the "Unassigned"
      // placeholder so the job can go ahead; it can be moved to the real
      // company from the building page later.
      client = clientName
        ? await createClientCompanyRecord({ name: clientName, type: "Property Management", active: true })
        : await getOrCreateUnassignedClient();
    }
    const latRaw = String(formData.get("latitude") ?? "");
    const lngRaw = String(formData.get("longitude") ?? "");
    const regionRaw = String(formData.get("region") ?? "");
    building = await createBuildingRecord({
      client_company_id: client.id,
      name: buildingName,
      address: String(formData.get("address") ?? "").trim() || buildingName,
      city: String(formData.get("city") ?? "").trim(),
      state: String(formData.get("state") ?? "").trim() || "NY",
      zip: String(formData.get("zip") ?? "").trim(),
      region: (BUILDING_REGIONS as readonly string[]).includes(regionRaw) ? (regionRaw as BuildingRegion) : "Other",
      latitude: latRaw ? Number(latRaw) : null,
      longitude: lngRaw ? Number(lngRaw) : null,
      active: true,
    });
  }

  // Point of contact: existing contact on this company by name, or a new
  // one; linked to the building (as its POC if it has none yet).
  if (contactName && client) {
    const clientId = client.id;
    let contact = contacts.find((c) => c.client_company_id === clientId && norm(`${c.first_name} ${c.last_name}`) === norm(contactName));
    if (!contact) {
      const parts = contactName.split(/\s+/);
      contact = await createContact({
        client_company_id: clientId,
        first_name: parts.length > 1 ? parts.slice(0, -1).join(" ") : parts[0],
        last_name: parts.length > 1 ? parts[parts.length - 1] : "",
        phone: contactPhone || undefined,
      });
    } else if (contactPhone && !contact.phone) {
      await updateContact(contact.id, { phone: contactPhone });
    }
    const buildingLinks = links.filter((l) => l.building_id === building!.id);
    if (!buildingLinks.some((l) => l.contact_id === contact!.id)) {
      const isPrimary = !buildingLinks.some((l) => l.is_primary);
      await createBuildingContact({ building_id: building.id, contact_id: contact.id, role: "Other", is_primary: isPrimary });
      if (!building.primary_contact_id) await updateBuilding(building.id, { primary_contact_id: contact.id });
    }
  }

  const building_id = building.id;
  const actingUser = await getActingUser();
  revalidatePath("/clients");
  revalidatePath("/buildings");
  const project = await createQuickProject({
    building_id,
    unit_number: String(formData.get("unit_number") ?? "").trim() || undefined,
    description,
    start_date: schedule_date,
    actorName: actingUser.fullName,
  });
  // Put it on the day straight away (Blue — starting today) so it shows in
  // the list immediately and loads into the form as an existing entry.
  const day = await getOrCreateProjectScheduleDay(project.id, schedule_date, actingUser.fullName);
  if (day.schedule_color !== "Blue") await updateProjectScheduleDay(day.id, { schedule_color: "Blue", notes: description }, actingUser.fullName);
  revalidatePath("/projects");
  revalidateSchedule(project.id);
  redirect(`/schedule/edit?project=${project.id}&date=${schedule_date}`);
}

/** Remove a job from the schedule — this day only, or every day. */
export async function removeFromScheduleAction(projectId: string, date: string, scope: "day" | "all") {
  if (!(await canEdit("schedule"))) return;
  const actingUser = await getActingUser();
  await removeProjectFromSchedule(projectId, scope === "day" ? date : undefined, actingUser.fullName);
  revalidateSchedule(projectId);
  redirect(`/schedule/edit?date=${date}`);
}

/**
 * "Working this Saturday/Sunday": turns a greyed weekend carry-over into a
 * real scheduled day — creates the day row (copied from the last working
 * day, crew included) so it counts like any other day.
 */
export async function workWeekendDayAction(projectId: string, date: string) {
  if (!(await canEdit("schedule"))) return;
  const actingUser = await getActingUser();
  await getOrCreateProjectScheduleDay(projectId, date, actingUser.fullName);
  revalidateSchedule(projectId);
  redirect(`/schedule/edit?date=${date}`);
}

/** Undo of the above: drop the weekend day's entry and crew again. */
export async function notWorkingWeekendDayAction(projectId: string, date: string) {
  if (!(await canEdit("schedule"))) return;
  const actingUser = await getActingUser();
  await removeProjectFromSchedule(projectId, date, actingUser.fullName);
  revalidateSchedule(projectId);
  redirect(`/schedule/edit?date=${date}`);
}

// ---------------------------------------------------------------------
// End of Day Review — per-job status + who worked / hours
// ---------------------------------------------------------------------

/** Status from the review card: Complete takes the job off the schedule
 * from tomorrow (and marks the project Complete); In Progress keeps it
 * carrying over. Same write path as the Schedule Type dropdown. */
export async function setReviewJobStatusAction(projectId: string, date: string, formData: FormData) {
  if (!(await canEdit("schedule"))) return;
  const status = String(formData.get("job_status") ?? "");
  if (status !== "Complete" && status !== "In Progress") return;
  const actingUser = await getActingUser();
  const day = await getOrCreateProjectScheduleDay(projectId, date, actingUser.fullName);
  if (day.job_status !== status) await updateProjectScheduleDay(day.id, { job_status: status as ScheduleJobStatus }, actingUser.fullName);
  revalidateSchedule(projectId);
  revalidatePath("/schedule/review");
}

/**
 * Saves who worked a job on a date and their hours, as actual_labor_entries
 * (the basis for real labor cost): one entry per person per job per day —
 * updated in place if it exists, created if not, removed if their hours
 * are cleared or they were taken off the list.
 */
export async function saveJobHoursAction(projectId: string, date: string, formData: FormData) {
  if (!(await canEdit("schedule"))) return;
  const actingUser = await getActingUser();
  const listed = formData.getAll("employee_ids").map(String).filter(Boolean);
  const existing = (await listActualLaborEntries()).filter((e) => e.project_id === projectId && e.work_date === date);
  const byEmployee = new Map(existing.map((e) => [e.employee_id, e]));

  for (const employeeId of listed) {
    const hours = Number(formData.get(`hours__${employeeId}`) ?? 0) || 0;
    const current = byEmployee.get(employeeId);
    if (hours <= 0) {
      if (current) await deleteActualLaborEntry(current.id, actingUser.fullName);
      continue;
    }
    if (current) {
      if (current.hours !== hours) await updateActualLaborEntry(current.id, { hours }, actingUser.fullName);
    } else {
      await createActualLaborEntry({ employee_id: employeeId, project_id: projectId, work_date: date, hours, actorName: actingUser.fullName });
    }
  }
  // Anyone with an entry who's no longer listed didn't work this job today.
  for (const e of existing) {
    if (!listed.includes(e.employee_id)) await deleteActualLaborEntry(e.id, actingUser.fullName);
  }
  revalidateSchedule(projectId);
  revalidatePath("/schedule/review");
  revalidatePath("/reports");
  revalidatePath("/payroll");
  revalidatePath("/staff");
}
