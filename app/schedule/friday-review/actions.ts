"use server";

import { revalidatePath } from "next/cache";
import { createProjectNote } from "@/lib/db";
import { getActingUser } from "@/lib/current-user";
import { canEdit } from "@/lib/permissions";

/** Add a note to a job from the Weekly Review screen — same ProjectNote
 * record the job page's own Notes section reads, just written from here too. */
export async function addWeeklyReviewNoteAction(projectId: string, formData: FormData) {
  if (!(await canEdit("schedule"))) return;
  const body = String(formData.get("body") ?? "");
  if (!body.trim()) return;
  const actingUser = await getActingUser();
  await createProjectNote({ project_id: projectId, author_name: actingUser.fullName, body });
  revalidatePath("/schedule/friday-review");
  revalidatePath(`/projects/${projectId}`);
}
