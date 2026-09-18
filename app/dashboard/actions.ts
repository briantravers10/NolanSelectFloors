"use server";

import { revalidatePath } from "next/cache";
import { setProjectInvoiceSent } from "@/lib/db";
import { getActingUser } from "@/lib/current-user";
import { canEdit } from "@/lib/permissions";

/** "Invoice Sent" on a completed job — clears it from everyone's dashboard. */
export async function markInvoiceSentAction(projectId: string, sent: boolean) {
  if (!(await canEdit("projects")) && !(await canEdit("invoices"))) return;
  const actingUser = await getActingUser();
  await setProjectInvoiceSent(projectId, sent, actingUser.fullName);
  revalidatePath("/dashboard");
  revalidatePath("/projects");
  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/schedule/completed");
}
