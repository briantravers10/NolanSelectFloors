"use server";

import { revalidatePath } from "next/cache";
import { createScheduleAssignment, deleteScheduleAssignment, updateScheduleAssignmentCallTime } from "@/lib/db";
import type { StaffCapability } from "@/lib/types";

export async function addAssignmentAction(formData: FormData) {
  const project_id = String(formData.get("project_id") ?? "");
  const employee_id = String(formData.get("employee_id") ?? "");
  const schedule_date = String(formData.get("schedule_date") ?? "");
  const role_on_job = String(formData.get("role_on_job") ?? "") as StaffCapability;
  const time_and_half = formData.get("time_and_half") === "on";
  const call_time = String(formData.get("call_time") ?? "").trim() || "7:00 AM";
  if (!project_id || !employee_id || !schedule_date || !role_on_job) return;
  await createScheduleAssignment({ project_id, employee_id, schedule_date, role_on_job, time_and_half, call_time });
  revalidatePath("/schedule");
  revalidatePath("/dashboard");
  revalidatePath(`/projects/${project_id}`);
}

export async function setAssignmentCallTimeAction(id: string, projectId: string, formData: FormData) {
  const call_time = String(formData.get("call_time") ?? "").trim() || "7:00 AM";
  await updateScheduleAssignmentCallTime(id, call_time);
  revalidatePath("/schedule");
  revalidatePath(`/projects/${projectId}`);
}

export async function removeAssignmentAction(id: string, projectId: string) {
  await deleteScheduleAssignment(id);
  revalidatePath("/schedule");
  revalidatePath("/dashboard");
  revalidatePath(`/projects/${projectId}`);
}
