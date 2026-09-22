"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  confirmDay,
  createActualLaborEntry,
  listActualLaborEntries,
  listBuildings,
  listProjects,
  removeProjectFromSchedule,
  setScheduleOrder,
  updateProjectUnitNumber,
  createScheduleAssignment,
  createQuickProject,
  createSchedulePickupItem,
  ensureMaterialForPickup,
  createWorkType,
  deleteActualLaborEntry,
  deleteScheduleAssignment,
  deleteSchedulePickupItem,
  getOrCreateProjectScheduleDay,
  cancelProjectScheduleDay,
  listScheduleAssignments,
  saveCompletionNotes,
  toggleSchedulePickupItemStatus,
  updateActualLaborEntry,
  updateProjectScheduleDay,
  updateScheduleAssignmentCallTime,
  updateWorkType,
  createTimeOffEntry,
  listTimeOffEntries,
  listAgendaEvents,
  listOfficeUsers,
  createAgendaEvent,
  updateAgendaEvent,
  setDriverWorkingDay,
} from "@/lib/db";
import { getActingUser } from "@/lib/current-user";
import { resolveQuickJobBuilding } from "@/lib/quick-job";
import { canEdit } from "@/lib/permissions";
import type { CoiStatus, ScheduleColor, ScheduleJobStatus, ScheduleMaterialsStatus, StaffCapability } from "@/lib/types";
import { TIME_OFF_TYPES } from "@/lib/types";
import type { TimeOffType } from "@/lib/types";

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
  const item = await createSchedulePickupItem({ project_schedule_day_id: day.id, description, actorName: actingUser.fullName });
  // Also a line in the job's Materials so a price can go on it later.
  await ensureMaterialForPickup(item, projectId);
  revalidateSchedule(projectId);
  revalidatePath("/materials");
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

/**
 * A schedule meeting also lands on the agenda (the owner's and the person
 * who set it up), linked back to the job, so it's in one place with the
 * rest of the day. Re-saving updates the same agenda entry.
 */
async function syncMeetingToAgenda(projectId: string, date: string, time: string | null, notes: string, actingUser: { id: string; fullName: string }) {
  const [projects, buildings, events, officeUsers] = await Promise.all([listProjects(), listBuildings(), listAgendaEvents(), listOfficeUsers()]);
  const project = projects.find((p) => p.id === projectId);
  const building = project ? buildings.find((b) => b.id === project.building_id) : undefined;
  const title = `Meeting — ${building?.name ?? project?.name ?? "job"}${project?.unit_number ? ` Unit ${project.unit_number}` : ""}`;
  const owners = new Set<string>(officeUsers.filter((u) => u.active && u.is_owner).map((u) => u.id));
  owners.add(actingUser.id);
  for (const ownerId of owners) {
    const existing = events.find((e) => e.owner_user_id === ownerId && e.related_type === "project" && e.related_id === projectId && e.event_date === date);
    if (existing) {
      if (existing.title !== title || (existing.start_time ?? null) !== time || (existing.notes ?? null) !== (notes || null)) {
        await updateAgendaEvent(existing.id, { title, start_time: time, notes: notes || null }, actingUser.fullName);
      }
    } else {
      await createAgendaEvent({
        owner_user_id: ownerId,
        title,
        event_date: date,
        start_time: time ?? undefined,
        location: building?.address ?? undefined,
        notes: notes || undefined,
        related_type: "project",
        related_id: projectId,
        actorName: actingUser.fullName,
        created_by_name: actingUser.fullName,
      });
    }
  }
  revalidatePath("/agenda");
  revalidatePath("/meetings");
}

export async function saveScheduleEntryAction(formData: FormData) {
  if (!(await canEdit("schedule"))) return;
  const project_id = String(formData.get("project_id") ?? "");
  const schedule_date = String(formData.get("schedule_date") ?? "");
  if (!project_id || !schedule_date) return;

  const actingUser = await getActingUser();
  const day = await getOrCreateProjectScheduleDay(project_id, schedule_date, actingUser.fullName);

  // Editing an existing entry sends the id twice (locked field + hidden
  // marker). If they ever disagree, something went wrong on the client —
  // refuse rather than write one job's details onto another.
  const editProjectId = String(formData.get("edit_project_id") ?? "");
  if (editProjectId && editProjectId !== project_id) return;

  // Unit number lives on the project, editable from here for convenience —
  // only while editing that same job (never on a "new entry" save).
  if (editProjectId && formData.has("unit_number")) {
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
  const markCancelled = schedule_color === "Cancelled";

  // Meeting flag + time. A meeting is always Yellow.
  const is_meeting = formData.get("is_meeting") === "1";
  const meeting_time = is_meeting ? String(formData.get("meeting_time") ?? "").trim() || null : null;
  if (is_meeting !== Boolean(day.is_meeting) || meeting_time !== (day.meeting_time ?? null)) {
    await updateProjectScheduleDay(day.id, { is_meeting, meeting_time }, actingUser.fullName);
    if (is_meeting) await syncMeetingToAgenda(project_id, schedule_date, meeting_time, notes, actingUser);
  }
  if (is_meeting && !markComplete && !markCancelled) formData.set("schedule_color", "Yellow");
  const effectiveColor = is_meeting && !markComplete && !markCancelled ? "Yellow" : schedule_color;
  if (!markComplete && !markCancelled && effectiveColor && effectiveColor !== day.schedule_color) await setScheduleColorAction(project_id, schedule_date, formData);
  if (coi_status && coi_status !== day.coi_status) await setCoiStatusAction(project_id, schedule_date, formData);
  if (materials_status && materials_status !== day.materials_status) await setMaterialsStatusAction(project_id, schedule_date, formData);
  if (markComplete) {
    // "Completed" from the Schedule Type dropdown: writes job_status
    // (and through it the project's pipeline stage) so the job drops off
    // the schedule from the next day onward.
    const done = new FormData();
    done.set("job_status", "Complete");
    if (day.job_status !== "Complete") await setJobStatusAction(project_id, schedule_date, done);
  } else if (markCancelled) {
    // "Cancelled": keep the entry for history but drop its crew and hours
    // so nobody is costed against it. Crew boxes below are ignored.
    await cancelProjectScheduleDay(project_id, schedule_date, actingUser.fullName);
    if (notes !== (day.notes ?? "")) await setScheduleNotesAction(project_id, schedule_date, formData);
    revalidateSchedule(project_id);
    return;
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
// Daily Driver Working Status
// ---------------------------------------------------------------------

export async function setDriverWorkingAction(employeeId: string, workDate: string, working: boolean) {
  if (!(await canEdit("schedule"))) return;
  const actingUser = await getActingUser();
  await setDriverWorkingDay(employeeId, workDate, working, actingUser.fullName);
  revalidateSchedule();
  revalidatePath("/payroll");
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
  if (!schedule_date || !description) return;

  const building = await resolveQuickJobBuilding(formData);
  if (!building) return;
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
  if (status !== "Complete" && status !== "In Progress" && status !== "Cancelled") return;
  const actingUser = await getActingUser();
  if (status === "Cancelled") {
    // Keeps the job in history; removes its crew + logged hours for the day
    // so their labor cost drops off. The office reassigns them elsewhere.
    await cancelProjectScheduleDay(projectId, date, actingUser.fullName);
    revalidateSchedule(projectId);
    revalidatePath("/schedule/review");
    return;
  }
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

  const absent: { employeeId: string; type: TimeOffType }[] = [];
  for (const employeeId of listed) {
    const absence = String(formData.get(`absence__${employeeId}`) ?? "");
    if ((TIME_OFF_TYPES as readonly string[]).includes(absence)) {
      absent.push({ employeeId, type: absence as TimeOffType });
      const current = byEmployee.get(employeeId);
      if (current) await deleteActualLaborEntry(current.id, actingUser.fullName);
      continue;
    }
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
  // Anyone the SCHEDULE had on this job who was removed with ✕ is taken off
  // the day's crew too — otherwise they'd come straight back from the
  // schedule (and still be costed against this job).
  const scheduled = formData.getAll("scheduled_ids").map(String).filter(Boolean);
  const absentIds = new Set(absent.map((a) => a.employeeId));
  const removed = scheduled.filter((id) => !listed.includes(id) || absentIds.has(id));
  if (removed.length > 0) {
    // Materialises a carried-forward day (copying its crew) so the
    // removal applies to this date only, not the day it was carried from.
    await getOrCreateProjectScheduleDay(projectId, date, actingUser.fullName);
    const dayCrew = (await listScheduleAssignments()).filter((a) => a.project_id === projectId && a.schedule_date === date && removed.includes(a.employee_id));
    for (const a of dayCrew) await deleteScheduleAssignment(a.id, actingUser.fullName);
  }
  // Absences: log the time off for that day (once) so Staff, Time Off
  // Summary and payroll all agree; the crew removal above already took
  // them off this job's cost.
  if (absent.length > 0) {
    const existing = await listTimeOffEntries();
    for (const a of absent) {
      const already = existing.some((t) => t.employee_id === a.employeeId && t.start_date <= date && t.end_date >= date);
      if (!already) {
        await createTimeOffEntry({ employee_id: a.employeeId, start_date: date, end_date: date, type: a.type, notes: "Marked on End of Day Review", actorName: actingUser.fullName });
      }
    }
    revalidatePath("/staff/time-off");
  }
  revalidateSchedule(projectId);
  revalidatePath("/schedule/review");
  revalidatePath("/reports");
  revalidatePath("/payroll");
  revalidatePath("/staff");
}

/** Drag-to-rearrange on Create/Edit Schedule (order within colour groups). */
export async function reorderScheduleAction(date: string, orderedProjectIds: string[]) {
  if (!(await canEdit("schedule"))) return;
  const actingUser = await getActingUser();
  await setScheduleOrder(date, orderedProjectIds.filter(Boolean), actingUser.fullName);
  revalidateSchedule();
  revalidatePath("/schedule/edit");
}
