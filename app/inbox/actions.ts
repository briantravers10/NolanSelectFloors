"use server";

import { revalidatePath } from "next/cache";
import { createQuickProject, fileInboundEmail, getOrCreateProjectScheduleDay, listInboundEmails, updateInboundEmail, updateProjectScheduleDay } from "@/lib/db";
import { getActingUser } from "@/lib/current-user";
import { canEdit } from "@/lib/permissions";
import { resolveQuickJobBuilding } from "@/lib/quick-job";
import { BID_EMAIL_STATUSES, type BidEmailStatus, type InboundKind } from "@/lib/types";

const FILE_KINDS: InboundKind[] = ["drawing", "invoice", "outbound_invoice", "purchase_order", "bid", "coi"];
const NEEDS_JOB: InboundKind[] = ["drawing", "coi", "outbound_invoice", "purchase_order"];

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
  const kindRaw = String(formData.get("kind") ?? "") as InboundKind;
  const kind: InboundKind = FILE_KINDS.includes(kindRaw) ? kindRaw : "drawing";
  if (NEEDS_JOB.includes(kind) && !projectId) return;
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
      invoiceNumber: String(formData.get("invoice_number") ?? "").trim() || undefined,
    },
    actingUser.fullName
  );
  refresh(projectId);
  revalidatePath("/purchase-orders");
  revalidatePath("/bids");
  revalidatePath("/schedule");
}

/**
 * "New job from this email": Quick Job, but from Email Inbox. Creates the
 * job (building / company / contact found or created, same as the
 * schedule's Quick Job), puts it on the chosen date, and points this email
 * at it so the attachment can be filed straight away.
 */
export async function createJobFromInboxAction(emailId: string, formData: FormData) {
  if (!(await canEdit("projects"))) return;
  const schedule_date = String(formData.get("schedule_date") ?? "");
  const description = String(formData.get("description") ?? "").trim();
  if (!schedule_date || !description) return;
  const building = await resolveQuickJobBuilding(formData);
  if (!building) return;
  const actingUser = await getActingUser();
  const project = await createQuickProject({
    building_id: building.id,
    unit_number: String(formData.get("unit_number") ?? "").trim() || undefined,
    description,
    start_date: schedule_date,
    actorName: actingUser.fullName,
  });
  const day = await getOrCreateProjectScheduleDay(project.id, schedule_date, actingUser.fullName);
  if (day.schedule_color !== "Blue") await updateProjectScheduleDay(day.id, { schedule_color: "Blue", notes: description }, actingUser.fullName);
  await updateInboundEmail(emailId, { suggested_project_id: project.id, suggested_building_id: building.id });
  revalidatePath("/clients");
  revalidatePath("/buildings");
  revalidatePath("/projects");
  revalidatePath("/schedule");
  revalidatePath("/inbox");
}

/** Bids section: open → quoted → won / lost, plus a note. */
export async function setBidStatusAction(emailId: string, formData: FormData) {
  if (!(await canEdit("job_requests"))) return;
  const status = String(formData.get("bid_status") ?? "") as BidEmailStatus;
  if (!BID_EMAIL_STATUSES.includes(status)) return;
  const bid_notes = formData.has("bid_notes") ? String(formData.get("bid_notes") ?? "").trim() || null : undefined;
  await updateInboundEmail(emailId, { bid_status: status, ...(bid_notes !== undefined ? { bid_notes } : {}) });
  revalidatePath("/bids");
}

/** Take an email back out of Purchase Orders / Bids (it returns to Unfiled). */
export async function unfileInboundAction(emailId: string) {
  if (!(await canEdit("projects"))) return;
  await updateInboundEmail(emailId, { status: "unfiled", filed_kind: null, filed_project_id: null, filed_by: null, filed_at: null, bid_status: null });
  refresh();
  revalidatePath("/purchase-orders");
  revalidatePath("/bids");
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
