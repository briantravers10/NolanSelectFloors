"use server";

import { revalidatePath } from "next/cache";
import { fileInboundEmail, updateInboundEmail } from "@/lib/db";
import { getActingUser } from "@/lib/current-user";
import { canEdit } from "@/lib/permissions";
import type { InboundKind } from "@/lib/types";

function refresh(projectId?: string) {
  revalidatePath("/inbox");
  revalidatePath("/invoices");
  revalidatePath("/materials");
  if (projectId) revalidatePath(`/projects/${projectId}`);
}

export async function fileInboundAction(id: string, formData: FormData) {
  if (!(await canEdit("projects"))) return;
  const projectId = String(formData.get("project_id") ?? "");
  const kindRaw = String(formData.get("kind") ?? "");
  const kind: InboundKind = kindRaw === "invoice" ? "invoice" : "drawing";
  if (!projectId) return;
  const actingUser = await getActingUser();
  await fileInboundEmail(id, projectId, kind, actingUser.fullName);
  refresh(projectId);
}

export async function ignoreInboundAction(id: string) {
  if (!(await canEdit("projects"))) return;
  await updateInboundEmail(id, { status: "ignored" });
  refresh();
}

export async function reopenInboundAction(id: string) {
  if (!(await canEdit("projects"))) return;
  await updateInboundEmail(id, { status: "unfiled" });
  refresh();
}
