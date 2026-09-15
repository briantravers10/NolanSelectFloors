"use server";

import { revalidatePath } from "next/cache";
import {
  confirmDay,
  createActualLaborEntry,
  createScheduleAssignment,
  createWorkType,
  deleteActualLaborEntry,
  deleteScheduleAssignment,
  getOrCreateProjectScheduleDay,
  saveCompletionNotes,
  updateProjectScheduleDay,
  updateScheduleAssignmentCallTime,
  updateWorkType,
} from "@/lib/db";
import { getActingUser } from "@/lib/current-user";
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
  const call_time = String(formData.get("call_time") ?? "").trim() || "7:00 AM";
  await updateScheduleAssignmentCallTime(id, call_time);
  revalidateSchedule(projectId);
}

export async function removeAssignmentAction(id: string, projectId: string) {
  const actingUser = await getActingUser();
  await deleteScheduleAssignment(id, actingUser.fullName);
  revalidateSchedule(projectId);
}

// ---------------------------------------------------------------------
// Schedule day entry — inline color / COI / materials / job status
// ---------------------------------------------------------------------

export async function setScheduleColorAction(projectId: string, date: string, formData: FormData) {
  const color = String(formData.get("schedule_color") ?? "") as ScheduleColor;
  if (!color) return;
  const actingUser = await getActingUser();
  const day = await getOrCreateProjectScheduleDay(projectId, date, actingUser.fullName);
  await updateProjectScheduleDay(day.id, { schedule_color: color }, actingUser.fullName);
  revalidateSchedule(projectId);
}

export async function setCoiStatusAction(projectId: string, date: string, formData: FormData) {
  const coi_status = String(formData.get("coi_status") ?? "") as CoiStatus;
  if (!coi_status) return;
  const actingUser = await getActingUser();
  const day = await getOrCreateProjectScheduleDay(projectId, date, actingUser.fullName);
  await updateProjectScheduleDay(day.id, { coi_status }, actingUser.fullName);
  revalidateSchedule(projectId);
}

export async function setMaterialsStatusAction(projectId: string, date: string, formData: FormData) {
  const materials_status = String(formData.get("materials_status") ?? "") as ScheduleMaterialsStatus;
  if (!materials_status) return;
  const actingUser = await getActingUser();
  const day = await getOrCreateProjectScheduleDay(projectId, date, actingUser.fullName);
  await updateProjectScheduleDay(day.id, { materials_status }, actingUser.fullName);
  revalidateSchedule(projectId);
}

export async function setJobStatusAction(projectId: string, date: string, formData: FormData) {
  const job_status = String(formData.get("job_status") ?? "") as ScheduleJobStatus;
  if (!job_status) return;
  const actingUser = await getActingUser();
  const day = await getOrCreateProjectScheduleDay(projectId, date, actingUser.fullName);
  await updateProjectScheduleDay(day.id, { job_status }, actingUser.fullName);
  revalidateSchedule(projectId);
}

export async function setWorkTypeAction(projectId: string, date: string, formData: FormData) {
  const work_type_id = String(formData.get("work_type_id") ?? "") || undefined;
  const actingUser = await getActingUser();
  const day = await getOrCreateProjectScheduleDay(projectId, date, actingUser.fullName);
  await updateProjectScheduleDay(day.id, { work_type_id }, actingUser.fullName);
  revalidateSchedule(projectId);
}

export async function setScheduleNotesAction(projectId: string, date: string, formData: FormData) {
  const notes = String(formData.get("notes") ?? "");
  const actingUser = await getActingUser();
  const day = await getOrCreateProjectScheduleDay(projectId, date, actingUser.fullName);
  await updateProjectScheduleDay(day.id, { notes }, actingUser.fullName);
  revalidateSchedule(projectId);
}

// ---------------------------------------------------------------------
// Actual hours
// ---------------------------------------------------------------------

export async function addActualLaborEntryAction(formData: FormData) {
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
  const actingUser = await getActingUser();
  await deleteActualLaborEntry(id, actingUser.fullName);
  revalidateSchedule();
}

// ---------------------------------------------------------------------
// End-of-day review / confirm day
// ---------------------------------------------------------------------

export async function confirmDayAction(workDate: string, formData: FormData) {
  const notes = String(formData.get("notes") ?? "") || undefined;
  const actingUser = await getActingUser();
  await confirmDay(workDate, actingUser.fullName, notes);
  revalidateSchedule();
}

// ---------------------------------------------------------------------
// Completed Job Summary — the one manually-editable field
// ---------------------------------------------------------------------

export async function saveCompletionNotesAction(projectId: string, formData: FormData) {
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
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;
  await createWorkType(name);
  revalidatePath("/company-setup");
}

export async function renameWorkTypeAction(id: string, formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;
  await updateWorkType(id, { name });
  revalidatePath("/company-setup");
}

export async function toggleWorkTypeActiveAction(id: string, active: boolean) {
  await updateWorkType(id, { active });
  revalidatePath("/company-setup");
}
