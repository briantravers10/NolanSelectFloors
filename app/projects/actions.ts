"use server";

import { revalidatePath } from "next/cache";
import {
  createProjectCrewRequirement,
  createProjectMaterial,
  createProjectNote,
  createTask,
  updateProjectStatus,
} from "@/lib/db";
import type { ProjectStatus, StaffCapability, MaterialStatus } from "@/lib/types";

export async function setProjectStatusAction(id: string, status: ProjectStatus) {
  await updateProjectStatus(id, status);
  revalidatePath(`/projects/${id}`);
  revalidatePath("/projects");
  revalidatePath("/dashboard");
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
