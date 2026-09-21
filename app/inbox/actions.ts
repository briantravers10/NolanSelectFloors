"use server";

import { revalidatePath } from "next/cache";
import { fileInboundEmail, listInboundEmails, updateInboundEmail } from "@/lib/db";
import { getActingUser } from "@/lib/current-user";
import { canEdit } from "@/lib/permissions";
import type { InboundKind } from "@/lib/types";

function refresh(projectId?: string | null) {
  revalidatePath("/inbox");
  revalidatePath("/materials");
  revalidatePath("/suppliers");
  revalidatePath("/drawings");
  revalidatePath("/reports");
  if (projectId) revalidatePath(`/projects/${projectId}`);
}

export async function fileInboundAction(id: string, formData: FormData) {
  if (!(await canEdit("projects"))) return;
  const projectId = String(formData.get("project_id") ?? "").trim() || null;
  const kindRaw = String(formData.get("kind") ?? "");
  const kind: InboundKind = kindRaw === "invoice" ? "invoice" : "drawing";
  if (kind === "drawing" && !projectId) return;
  const amountRaw = String(formData.get("amount") ?? "").replace(/[$,\s]/g, "");
  const amount = amountRaw === "" ? null : Number(amountRaw);
  const actingUser = await getActingUser();
  await fileInboundEmail(
    id,
    {
      kind,
      projectId,
      supplier: String(formData.get("supplier") ?? "").trim() || undefined,
      amount: amount != null && Number.isFinite(amount) ? amount : null,
      invoiceDate: String(formData.get("invoice_date") ?? "").trim() || undefined,
    },
    actingUser.fullName
  );
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

/**
 * "Confirm all": files every automatically matched email exactly as the
 * app suggested (its job, drawing vs invoice, supplier from the sender).
 * Anything a person has doubts about should be confirmed one by one
 * instead, where the job can be changed first.
 */
export async function confirmAllMatchedAction() {
  if (!(await canEdit("projects"))) return;
  const actingUser = await getActingUser();
  const matched = (await listInboundEmails()).filter((e) => e.status === "matched" && e.suggested_project_id && e.kind !== "unknown");
  for (const e of matched) {
    await fileInboundEmail(e.id, { kind: e.kind, projectId: e.suggested_project_id, supplier: e.from_name?.trim() || undefined }, `${actingUser.fullName} (confirmed all)`);
  }
  refresh();
  for (const e of matched) if (e.suggested_project_id) revalidatePath(`/projects/${e.suggested_project_id}`);
}
