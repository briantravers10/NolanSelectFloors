"use server";

import { revalidatePath } from "next/cache";
import { listProjectScheduleDays, updateProjectScheduleDay } from "@/lib/db";
import { getActingUser } from "@/lib/current-user";
import { canEdit } from "@/lib/permissions";

function refresh(projectId: string) {
  revalidatePath("/meetings");
  revalidatePath("/schedule");
  revalidatePath("/schedule/edit");
  revalidatePath("/agenda");
  revalidatePath(`/projects/${projectId}`);
}

/** Inline edit from the Meetings page: time + notes. */
export async function updateMeetingAction(dayId: string, formData: FormData) {
  if (!(await canEdit("schedule"))) return;
  const day = (await listProjectScheduleDays()).find((d) => d.id === dayId);
  if (!day) return;
  const actingUser = await getActingUser();
  const meeting_time = String(formData.get("meeting_time") ?? "").trim() || null;
  const notes = String(formData.get("notes") ?? "");
  const patch: { meeting_time?: string | null; notes?: string } = {};
  if (meeting_time !== (day.meeting_time ?? null)) patch.meeting_time = meeting_time;
  if (notes !== (day.notes ?? "")) patch.notes = notes;
  if (Object.keys(patch).length) await updateProjectScheduleDay(dayId, patch, actingUser.fullName);
  refresh(day.project_id);
}

/** Done / not done. A meeting marked Complete never shows on "invoices to send". */
export async function setMeetingDoneAction(dayId: string, done: boolean) {
  if (!(await canEdit("schedule"))) return;
  const day = (await listProjectScheduleDays()).find((d) => d.id === dayId);
  if (!day) return;
  const actingUser = await getActingUser();
  await updateProjectScheduleDay(dayId, { job_status: done ? "Complete" : "Scheduled" }, actingUser.fullName);
  refresh(day.project_id);
}

/** Turn a meeting back into an ordinary job entry. */
export async function unmarkMeetingAction(dayId: string) {
  if (!(await canEdit("schedule"))) return;
  const day = (await listProjectScheduleDays()).find((d) => d.id === dayId);
  if (!day) return;
  const actingUser = await getActingUser();
  await updateProjectScheduleDay(dayId, { is_meeting: false, meeting_time: null }, actingUser.fullName);
  refresh(day.project_id);
}
