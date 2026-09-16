"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  confirmDay,
  createActualLaborEntry,
  createScheduleAssignment,
  createSchedulePickupItem,
  createWorkType,
  deleteActualLaborEntry,
  deleteScheduleAssignment,
  deleteSchedulePickupItem,
  getOrCreateProjectScheduleDay,
  listScheduleAssignments,
  saveCompletionNotes,
  toggleSchedulePickupItemStatus,
  updateProjectScheduleDay,
  updateScheduleAssignmentCallTime,
  updateWorkType,
} from "@/lib/db";
import { getActingUser } from "@/lib/current-user";
import { canEdit } from "@/lib/permissions";
import type { CoiStatus, ScheduleColor, ScheduleJobStatus, ScheduleMaterialsStatus, StaffCapability } from "@/lib/types";

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

  const schedule_color = String(formData.get("schedule_color") ?? "");
  const coi_status = String(formData.get("coi_status") ?? "");
  const materials_status = String(formData.get("materials_status") ?? "");
  const job_status = String(formData.get("job_status") ?? "");
  const work_type_id = String(formData.get("work_type_id") ?? "");
  const notes = String(formData.get("notes") ?? "");

  if (schedule_color && schedule_color !== day.schedule_color) await setScheduleColorAction(project_id, schedule_date, formData);
  if (coi_status && coi_status !== day.coi_status) await setCoiStatusAction(project_id, schedule_date, formData);
  if (materials_status && materials_status !== day.materials_status) await setMaterialsStatusAction(project_id, schedule_date, formData);
  if (job_status && job_status !== day.job_status) await setJobStatusAction(project_id, schedule_date, formData);
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

  redirect(`/schedule?date=${schedule_date}`);
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
