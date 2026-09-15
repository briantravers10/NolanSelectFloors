"use server";

import { revalidatePath } from "next/cache";
import {
  claimBid,
  createProjectCrewRequirement,
  createProjectMaterial,
  createProjectNote,
  createPhotoRecord,
  createTask,
  reassignOrReleaseBid,
  updateBidStatus,
  updateProjectPipelineStage,
  updateProjectStatus,
} from "@/lib/db";
import { uploadProjectPhoto } from "@/lib/storage";
import { getActingUser } from "@/lib/current-user";
import type { BidStatus, MaterialStatus, PhotoCategory, PipelineStage, ProjectStatus, StaffCapability } from "@/lib/types";

export async function setProjectStatusAction(id: string, status: ProjectStatus) {
  await updateProjectStatus(id, status);
  revalidatePath(`/projects/${id}`);
  revalidatePath("/projects");
  revalidatePath("/dashboard");
}

function revalidateProjectViews(id: string) {
  revalidatePath(`/projects/${id}`);
  revalidatePath("/projects");
  revalidatePath("/job-requests");
  revalidatePath("/dashboard");
}

export async function setPipelineStageAction(id: string, stage: PipelineStage) {
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
  const actingUser = await getActingUser();
  await updateBidStatus(id, status, actingUser.fullName);
  revalidateProjectViews(id);
}

/** "Claim Bid" — atomic; if it fails, the page just re-renders showing who
 * actually holds it now (claimBid itself resolves the race, this action
 * has nothing left to check). */
export async function claimBidAction(id: string) {
  const actingUser = await getActingUser();
  await claimBid(id, actingUser.id, actingUser.fullName);
  revalidateProjectViews(id);
}

/** Manager-only in intent (see README): release a bid back to Unclaimed. */
export async function releaseBidAction(id: string) {
  const actingUser = await getActingUser();
  await reassignOrReleaseBid(id, null, actingUser.fullName);
  revalidateProjectViews(id);
}

/** Manager-only in intent (see README): reassign a bid to a different
 * estimator, recording previous/new estimator + actor + timestamp. */
export async function reassignBidAction(id: string, newEstimatorId: string) {
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
  const role = String(formData.get("role")) as StaffCapability;
  const quantity = Number(formData.get("quantity") ?? 1);
  const scheduleDate = String(formData.get("schedule_date") ?? "") || null;
  await createProjectCrewRequirement({ project_id: projectId, role, quantity, schedule_date: scheduleDate });
  revalidatePath(`/projects/${projectId}`);
}

export async function addProjectMaterialAction(projectId: string, formData: FormData) {
  await createProjectMaterial({
    project_id: projectId,
    description: String(formData.get("description") ?? ""),
    quantity: Number(formData.get("quantity") ?? 1),
    unit: String(formData.get("unit") ?? "unit"),
    cost: Number(formData.get("cost") ?? 0),
    status: (String(formData.get("status") ?? "Needed") as MaterialStatus),
    supplier: String(formData.get("supplier") ?? "") || undefined,
    expected_delivery: String(formData.get("expected_delivery") ?? "") || undefined,
  });
  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/materials");
}

export async function addProjectTaskAction(projectId: string, formData: FormData) {
  await createTask({
    title: String(formData.get("title") ?? ""),
    related_type: "project",
    related_id: projectId,
    due_date: String(formData.get("due_date") ?? "") || undefined,
  });
  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/tasks");
}

export async function addProjectNoteAction(projectId: string, formData: FormData) {
  const body = String(formData.get("body") ?? "");
  if (!body.trim()) return;
  await createProjectNote({ project_id: projectId, author_name: "Brian Travers", body });
  revalidatePath(`/projects/${projectId}`);
}

/** Photos & Progress: attempts a real Supabase Storage upload via
 * lib/storage.ts when configured; when it isn't, the entry is still saved
 * (caption/category/date) with `storage_unavailable: true` so the UI can
 * show an honest "saved without an image" notice instead of pretending. */
export async function addProjectPhotoAction(projectId: string, formData: FormData) {
  const caption = String(formData.get("caption") ?? "").trim();
  if (!caption) return;
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
    caption,
    taken_at: takenAt ? `${takenAt}T00:00:00.000Z` : undefined,
    uploaded_by: actingUser.fullName,
    storage_unavailable,
  });
  revalidatePath(`/projects/${projectId}`);
}
