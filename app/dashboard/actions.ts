"use server";

import { revalidatePath } from "next/cache";
import { setProjectInvoiceAssignee, setProjectInvoiceSent } from "@/lib/db";
import { getActingUser } from "@/lib/current-user";
import { canEdit } from "@/lib/permissions";

/** "Invoice Sent" on a completed job — clears it from everyone's dashboard. */
export async function markInvoiceSentAction(projectId: string, sent: boolean) {
  if (!(await canEdit("projects"))) return;
  const actingUser = await getActingUser();
  await setProjectInvoiceSent(projectId, sent, actingUser.fullName);
  revalidatePath("/dashboard");
  revalidatePath("/projects");
  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/schedule/completed");
}

/** Pick who in the office is sending a completed job's invoice. */
export async function assignInvoiceAction(projectId: string, formData: FormData) {
  if (!(await canEdit("projects"))) return;
  const actingUser = await getActingUser();
  const who = String(formData.get("office_user_id") ?? "").trim() || null;
  await setProjectInvoiceAssignee(projectId, who, actingUser.fullName);
  revalidatePath("/dashboard");
  revalidatePath(`/projects/${projectId}`);
}
