"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import {
  createBidFromJobRequest,
  createJobRequest,
  findOpenDuplicateBids,
  logDuplicateBidOverride,
  updateJobRequestStatus,
  convertJobRequestToProject,
} from "@/lib/db";
import { getCurrentUser } from "@/lib/current-user";
import type { JobRequestStatus } from "@/lib/types";

export async function createJobRequestAction(formData: FormData) {
  const building_id = String(formData.get("building_id") ?? "");
  const contact_id = String(formData.get("contact_id") ?? "") || undefined;
  const unit_number = String(formData.get("unit_number") ?? "") || undefined;
  const description = String(formData.get("description") ?? "");
  const received_via = String(formData.get("received_via") ?? "phone");
  if (!building_id || !description) return;

  const confirmed = String(formData.get("confirm_duplicate") ?? "") === "1";
  const overrideReason = String(formData.get("duplicate_reason") ?? "").trim();

  const existingMatches = await findOpenDuplicateBids(building_id, unit_number);

  if (!confirmed && existingMatches.length > 0) {
    // Round-trip back to the New Job Request page with the same values so
    // it can re-run the check, show the warning, and require an explicit
    // "Create Anyway" + reason before proceeding — see
    // app/job-requests/new/page.tsx.
    const params = new URLSearchParams({
      dup: "1",
      building_id,
      description,
      received_via,
      ...(contact_id ? { contact_id } : {}),
      ...(unit_number ? { unit_number } : {}),
    });
    redirect(`/job-requests/new?${params.toString()}`);
  }

  const jr = await createJobRequest({ building_id, contact_id, unit_number, description, received_via });

  if (confirmed && overrideReason && existingMatches.length > 0) {
    await logDuplicateBidOverride(jr.id, overrideReason, existingMatches, getCurrentUser().fullName);
  }
  revalidatePath("/job-requests");
  redirect(`/job-requests/${jr.id}`);
}

export async function createBidAction(jobRequestId: string) {
  const project = await createBidFromJobRequest(jobRequestId);
  revalidatePath("/job-requests");
  revalidatePath("/projects");
  redirect(`/projects/${project.id}`);
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
