"use server";

import { revalidatePath } from "next/cache";
import {
  claimBid,
  createProjectCrewRequirement,
  createProjectDrawing,
  createProjectMaterial,
  createProjectNote,
  deleteProjectCrewRequirement,
  deleteProjectMaterial,
  deleteProjectOutboundInvoice,
  listProjectMaterials,
  logMaterialAdded,
  updateProjectMaterial,
  setSchedulePickupItemCost,
  updateProjectName,
  createPhotoRecord,
  reassignOrReleaseBid,
  saveProjectEstimatedValue,
  updateBidStatus,
  updateProjectPipelineStage,
} from "@/lib/db";
import { uploadMaterialInvoice, uploadProjectDrawing, uploadProjectPhoto } from "@/lib/storage";
import { getActingUser } from "@/lib/current-user";
import { canEdit } from "@/lib/permissions";
import type { BidStatus, PhotoCategory, PipelineStage, StaffCapability } from "@/lib/types";

function revalidateProjectViews(id: string) {
  revalidatePath(`/projects/${id}`);
  revalidatePath("/projects");
  revalidatePath("/job-requests");
  revalidatePath("/dashboard");
}

export async function setPipelineStageAction(id: string, stage: PipelineStage) {
  if (!(await canEdit("projects"))) return;
  await updateProjectPipelineStage(id, stage);
  revalidateProjectViews(id);
}

/** Used by the Pipeline kanban's per-card "Move to stage" dropdown, where
 * the target stage is chosen at submit time rather than bound ahead. */
export async function movePipelineStageFormAction(id: string, formData: FormData) {
  const stage = String(formData.get("stage") ?? "") as PipelineStage;
  if (!stage) return;
  await setPipelineStageAction(id, stage);
}

export async function setBidStatusAction(id: string, status: BidStatus) {
  if (!(await canEdit("projects"))) return;
  const actingUser = await getActingUser();
  await updateBidStatus(id, status, actingUser.fullName);
  revalidateProjectViews(id);
}

/** "Claim Bid" — atomic; if it fails, the page just re-renders showing who
 * actually holds it now (claimBid itself resolves the race, this action
 * has nothing left to check). */
export async function claimBidAction(id: string) {
  if (!(await canEdit("projects"))) return;
  const actingUser = await getActingUser();
  await claimBid(id, actingUser.id, actingUser.fullName);
  revalidateProjectViews(id);
}

/** Manager-only in intent (see README): release a bid back to Unclaimed. */
export async function releaseBidAction(id: string) {
  if (!(await canEdit("projects"))) return;
  const actingUser = await getActingUser();
  await reassignOrReleaseBid(id, null, actingUser.fullName);
  revalidateProjectViews(id);
}

/** Manager-only in intent (see README): reassign a bid to a different
 * estimator, recording previous/new estimator + actor + timestamp. */
export async function reassignBidAction(id: string, newEstimatorId: string) {
  if (!(await canEdit("projects"))) return;
  const actingUser = await getActingUser();
  await reassignOrReleaseBid(id, newEstimatorId, actingUser.fullName);
  revalidateProjectViews(id);
}

export async function reassignBidFormAction(id: string, formData: FormData) {
  const newEstimatorId = String(formData.get("estimator_id") ?? "");
  if (!newEstimatorId) return;
  await reassignBidAction(id, newEstimatorId);
}

export async function addCrewRequirementAction(projectId: string, formData: FormData) {
  if (!(await canEdit("projects"))) return;
  const role = String(formData.get("role")) as StaffCapability;
  const quantity = Number(formData.get("quantity") ?? 1);
  const scheduleDate = String(formData.get("schedule_date") ?? "") || null;
  const employee_ids = formData.getAll("employee_ids").map(String).filter(Boolean);
  const daysRaw = String(formData.get("estimated_days") ?? "").trim();
  const estimated_days = daysRaw ? Number(daysRaw) : null;
  await createProjectCrewRequirement({ project_id: projectId, role, quantity, schedule_date: scheduleDate, employee_ids, estimated_days });
  revalidatePath(`/projects/${projectId}`);
}

export async function deleteCrewRequirementAction(projectId: string, id: string) {
  if (!(await canEdit("projects"))) return;
  await deleteProjectCrewRequirement(id);
  revalidatePath(`/projects/${projectId}`);
}

export async function addProjectMaterialAction(projectId: string, formData: FormData) {
  if (!(await canEdit("materials"))) return;
  const description = String(formData.get("description") ?? "").trim();
  if (!description) return;
  const quantity = Math.max(0, Number(formData.get("quantity") ?? 1) || 0);
  const unitPriceRaw = String(formData.get("unit_price") ?? "").trim();
  const unit_price = unitPriceRaw === "" ? null : Math.max(0, Number(unitPriceRaw) || 0);
  const cost = Math.round(quantity * (unit_price ?? 0) * 100) / 100;
  const orderedOn = String(formData.get("ordered_on") ?? "").trim();
  const supplier = String(formData.get("supplier") ?? "").trim() || undefined;
  const actingUser = await getActingUser();

  const material = await createProjectMaterial({
    project_id: projectId,
    description,
    quantity,
    unit: String(formData.get("unit") ?? "") || "unit",
    unit_price,
    cost,
    status: orderedOn ? "Ordered" : "Needed",
    supplier,
    ordered_at: orderedOn ? new Date(orderedOn + "T12:00:00").toISOString() : undefined,
  });

  // Optional invoice/receipt attachment — soft-fails if storage isn't set up.
  const file = formData.get("invoice");
  if (file instanceof File && file.size > 0) {
    const up = await uploadMaterialInvoice(file, material.id);
    if (!up.unavailable && up.storage_path) {
      await updateProjectMaterial(material.id, { invoice_path: up.storage_path, invoice_name: file.name });
    }
  }
  logMaterialAdded(projectId, description, quantity, cost, supplier, actingUser.fullName);
  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/materials");
  revalidatePath("/reports");
}

export async function deleteProjectMaterialAction(projectId: string, id: string) {
  if (!(await canEdit("materials"))) return;
  const actingUser = await getActingUser();
  await deleteProjectMaterial(id, actingUser.fullName);
  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/materials");
  revalidatePath("/reports");
}

export async function addProjectNoteAction(projectId: string, formData: FormData) {
  if (!(await canEdit("projects"))) return;
  const body = String(formData.get("body") ?? "");
  if (!body.trim()) return;
  const actingUser = await getActingUser();
  await createProjectNote({ project_id: projectId, author_name: actingUser.fullName, body });
  revalidatePath(`/projects/${projectId}`);
}

/** Photos & Progress: attempts a real Supabase Storage upload via
 * lib/storage.ts when configured; when it isn't, the entry is still saved
 * (caption/category/date) with `storage_unavailable: true` so the UI can
 * show an honest "saved without an image" notice instead of pretending. */
export async function addProjectPhotoAction(projectId: string, formData: FormData) {
  if (!(await canEdit("projects"))) return;
  const caption = String(formData.get("caption") ?? "").trim();
  if (!caption) return;
  const title = String(formData.get("title") ?? "").trim() || undefined;
  const category = String(formData.get("category") ?? "Progress") as PhotoCategory;
  const takenAt = String(formData.get("taken_at") ?? "") || undefined;
  const actingUser = await getActingUser();
  const file = formData.get("photo");

  let storage_path: string | undefined;
  let storage_unavailable = true;
  let fileName = "no-image.txt";
  if (file instanceof File && file.size > 0) {
    fileName = file.name;
    const result = await uploadProjectPhoto(file, "project", projectId);
    storage_path = result.storage_path;
    storage_unavailable = result.unavailable;
  }

  await createPhotoRecord({
    related_type: "project",
    related_id: projectId,
    file_name: fileName,
    storage_path,
    category,
    title,
    caption,
    taken_at: takenAt ? `${takenAt}T00:00:00.000Z` : undefined,
    uploaded_by: actingUser.fullName,
    storage_unavailable,
  });
  revalidatePath(`/projects/${projectId}`);
}

/** Drawings & Plans (Procore-inspired, build 9): uploads a new drawing, or
 * a new VERSION of an existing one when `supersedes_id` is set (see
 * lib/db.ts createProjectDrawing). Same soft-fail storage pattern as
 * Photos above — never fabricates a successful upload. */
export async function addProjectDrawingAction(projectId: string, formData: FormData) {
  if (!(await canEdit("projects"))) return;
  const drawingName = String(formData.get("drawing_name") ?? "").trim();
  const supersedesId = String(formData.get("supersedes_id") ?? "") || undefined;
  if (!drawingName && !supersedesId) return;
  const drawingNumber = String(formData.get("drawing_number") ?? "").trim() || undefined;
  const notes = String(formData.get("notes") ?? "").trim() || undefined;
  const actingUser = await getActingUser();
  const file = formData.get("file");

  let file_reference: string | undefined;
  let storage_unavailable = true;
  if (file instanceof File && file.size > 0) {
    const result = await uploadProjectDrawing(file, projectId);
    file_reference = result.storage_path;
    storage_unavailable = result.unavailable;
  }

  await createProjectDrawing({
    project_id: projectId,
    drawing_name: drawingName,
    drawing_number: drawingNumber,
    file_reference,
    notes,
    uploaded_by: actingUser.fullName,
    storage_unavailable,
    supersedes_id: supersedesId,
  });
  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/schedule");
  revalidatePath("/schedule/edit");
}

/** Saves a computed suggested price from the Estimate Calculator onto the
 * project's `project_value` field. */
export async function saveProjectEstimateAction(id: string, value: number) {
  if (!(await canEdit("projects"))) return;
  await saveProjectEstimatedValue(id, value);
  revalidatePath(`/projects/${id}`);
}

/** Price on a schedule pickup item — counts toward the project's materials cost. */
export async function setPickupItemCostAction(projectId: string, itemId: string, formData: FormData) {
  if (!(await canEdit("materials")) && !(await canEdit("projects"))) return;
  const raw = String(formData.get("cost") ?? "").trim();
  const cost = raw === "" ? null : Math.max(0, Number(raw));
  if (cost !== null && !Number.isFinite(cost)) return;
  const actingUser = await getActingUser();
  await setSchedulePickupItemCost(itemId, cost, actingUser.fullName);
  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/schedule");
}

/** Rename a job (e.g. "East" → "West"). Logged to the project's history. */
export async function renameProjectAction(projectId: string, formData: FormData) {
  if (!(await canEdit("projects"))) return;
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;
  const actingUser = await getActingUser();
  await updateProjectName(projectId, name, actingUser.fullName);
  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/projects");
  revalidatePath("/schedule");
  revalidatePath("/schedule/edit");
  revalidatePath("/dashboard");
}

/** Inline price on a Materials line (e.g. an item collected off the schedule). */
export async function setMaterialUnitPriceAction(projectId: string, materialId: string, formData: FormData) {
  if (!(await canEdit("materials"))) return;
  const raw = String(formData.get("unit_price") ?? "").trim();
  const unit_price = raw === "" ? null : Math.max(0, Number(raw) || 0);
  const material = (await listProjectMaterials()).find((m) => m.id === materialId);
  if (!material) return;
  const cost = Math.round((material.quantity || 1) * (unit_price ?? 0) * 100) / 100;
  await updateProjectMaterial(materialId, { unit_price, cost });
  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/materials");
  revalidatePath("/reports");
}

/** Remove one outbound invoice from a job's history (the newest remaining one becomes current). */
export async function deleteOutboundInvoiceAction(projectId: string, invoiceId: string) {
  if (!(await canEdit("projects"))) return;
  const actingUser = await getActingUser();
  await deleteProjectOutboundInvoice(invoiceId, actingUser.fullName);
  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/schedule");
  revalidatePath("/schedule/edit");
}
