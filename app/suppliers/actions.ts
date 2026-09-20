"use server";

import { revalidatePath } from "next/cache";
import { createProjectMaterial, deleteProjectMaterial, linkMaterialToProject, logMaterialAdded, updateProjectMaterial } from "@/lib/db";
import { uploadMaterialInvoice } from "@/lib/storage";
import { getActingUser } from "@/lib/current-user";
import { canEdit } from "@/lib/permissions";

function refresh(projectId?: string | null, previousProjectId?: string | null) {
  revalidatePath("/suppliers");
  revalidatePath("/materials");
  revalidatePath("/reports");
  revalidatePath("/dashboard");
  if (projectId) revalidatePath(`/projects/${projectId}`);
  if (previousProjectId) revalidatePath(`/projects/${previousProjectId}`);
}

/**
 * Add an invoice straight from the Suppliers page. One record: under the
 * supplier always, on a job only if one is picked.
 */
export async function addSupplierInvoiceAction(formData: FormData) {
  if (!(await canEdit("materials"))) return;
  const supplier = String(formData.get("supplier") ?? "").trim();
  if (!supplier) return;
  const description = String(formData.get("description") ?? "").trim() || `${supplier} invoice`;
  const amountRaw = String(formData.get("amount") ?? "").replace(/[$,\s]/g, "");
  const amount = Math.max(0, Number(amountRaw) || 0);
  const dateRaw = String(formData.get("invoice_date") ?? "").trim();
  const projectId = String(formData.get("project_id") ?? "").trim() || null;
  const actingUser = await getActingUser();

  const material = await createProjectMaterial({
    project_id: projectId,
    description,
    quantity: 1,
    unit: "invoice",
    unit_price: amount,
    cost: Math.round(amount * 100) / 100,
    status: "Delivered",
    supplier,
    ordered_at: dateRaw ? new Date(dateRaw + "T12:00:00").toISOString() : new Date().toISOString(),
  });

  const file = formData.get("invoice");
  if (file instanceof File && file.size > 0) {
    const up = await uploadMaterialInvoice(file, material.id);
    if (!up.unavailable && up.storage_path) {
      await updateProjectMaterial(material.id, { invoice_path: up.storage_path, invoice_name: file.name });
    }
  }
  if (projectId) logMaterialAdded(projectId, description, 1, material.cost, supplier, actingUser.fullName);
  refresh(projectId);
}

/** Link (or unlink with an empty job) an invoice line to a job. */
export async function linkInvoiceToJobAction(materialId: string, previousProjectId: string | null, formData: FormData) {
  if (!(await canEdit("materials"))) return;
  const projectId = String(formData.get("project_id") ?? "").trim() || null;
  if (projectId === previousProjectId) return;
  const actingUser = await getActingUser();
  await linkMaterialToProject(materialId, projectId, actingUser.fullName);
  refresh(projectId, previousProjectId);
}

export async function deleteSupplierInvoiceAction(materialId: string, projectId: string | null) {
  if (!(await canEdit("materials"))) return;
  const actingUser = await getActingUser();
  await deleteProjectMaterial(materialId, actingUser.fullName);
  refresh(projectId);
}
