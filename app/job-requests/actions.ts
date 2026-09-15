"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createJobRequest, updateJobRequestStatus, convertJobRequestToProject } from "@/lib/db";
import type { JobRequestStatus } from "@/lib/types";

export async function createJobRequestAction(formData: FormData) {
  const building_id = String(formData.get("building_id") ?? "");
  const contact_id = String(formData.get("contact_id") ?? "") || undefined;
  const unit_number = String(formData.get("unit_number") ?? "") || undefined;
  const description = String(formData.get("description") ?? "");
  const received_via = String(formData.get("received_via") ?? "phone");
  if (!building_id || !description) return;
  const jr = await createJobRequest({ building_id, contact_id, unit_number, description, received_via });
  revalidatePath("/job-requests");
  redirect(`/job-requests/${jr.id}`);
}

export async function setJobRequestStatusAction(id: string, status: JobRequestStatus) {
  await updateJobRequestStatus(id, status);
  revalidatePath(`/job-requests/${id}`);
  revalidatePath("/job-requests");
}

export async function convertToProjectAction(id: string) {
  const project = await convertJobRequestToProject(id);
  revalidatePath("/job-requests");
  revalidatePath("/projects");
  redirect(`/projects/${project.id}`);
}
