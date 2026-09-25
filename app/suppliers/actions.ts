"use server";

import { revalidatePath } from "next/cache";
import { createProjectMaterial, deleteProjectMaterial, linkMaterialToProject, listProjectMaterials, logMaterialAdded, updateProjectMaterial } from "@/lib/db";
import { uploadMaterialInvoice } from "@/lib/storage";
import { supplierKey } from "@/lib/suppliers";
import { getActingUser } from "@/lib/current-user";
import { canEdit } from "@/lib/permissions";

function refresh(projectId?: string | null, previousProjectId?: string | null, supplier?: string) {
  revalidatePath("/suppliers");
  revalidatePath("/materials");
  revalidatePath("/reports");
  revalidatePath("/dashboard");
  if (projectId) revalidatePath(`/projects/${projectId}`);
  if (previousProjectId) revalidatePath(`/projects/${previousProjectId}`);
  revalidatePath(`/suppliers/${encodeURIComponent(supplierKey({ supplier }))}`);
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
  refresh(projectId, null, supplier);
}

/** Link (or unlink with an empty job) an invoice line to a job. */
export async function linkInvoiceToJobAction(materialId: string, previousProjectId: string | null, formData: FormData) {
  if (!(await canEdit("materials"))) return;
  const projectId = String(formData.get("project_id") ?? "").trim() || null;
  if (projectId === previousProjectId) return;
  const actingUser = await getActingUser();
  const material = (await listProjectMaterials()).find((m) => m.id === materialId);
  await linkMaterialToProject(materialId, projectId, actingUser.fullName);
  refresh(projectId, previousProjectId, material?.supplier);
}

export async function deleteSupplierInvoiceAction(materialId: string, projectId: string | null) {
  if (!(await canEdit("materials"))) return;
  const actingUser = await getActingUser();
  const material = (await listProjectMaterials()).find((m) => m.id === materialId);
  await deleteProjectMaterial(materialId, actingUser.fullName);
  refresh(projectId, null, material?.supplier);
}

/**
 * Split one invoice line across several jobs. The parts must add up to
 * the original amount; the original is replaced by the parts (each with
 * the same supplier, date and invoice file), so the supplier total is
 * unchanged and no dollar is counted twice.
 */
export async function splitInvoiceAction(materialId: string, formData: FormData) {
  if (!(await canEdit("materials"))) return;
  const original = (await listProjectMaterials()).find((m) => m.id === materialId);
  if (!original) return;
  const count = Math.min(12, Math.max(2, Number(formData.get("parts") ?? 0) || 0));
  const parts: { projectId: string; amount: number }[] = [];
  for (let i = 0; i < count; i++) {
    const projectId = String(formData.get(`job_${i}`) ?? "").trim();
    const amount = Math.round((Number(String(formData.get(`amount_${i}`) ?? "").replace(/[$,\s]/g, "")) || 0) * 100) / 100;
    if (!projectId || amount <= 0) return;
    parts.push({ projectId, amount });
  }
  const sum = Math.round(parts.reduce((s, p) => s + p.amount, 0) * 100) / 100;
  if (Math.abs(sum - original.cost) > 0.005) return;

  const actingUser = await getActingUser();
  for (const [i, p] of parts.entries()) {
    await createProjectMaterial({
      project_id: p.projectId,
      description: `${original.description} (part ${i + 1} of ${parts.length})`,
      quantity: 1,
      unit: "invoice",
      unit_price: p.amount,
      cost: p.amount,
      status: original.status,
      supplier: original.supplier,
      ordered_at: original.ordered_at,
      delivered_at: original.delivered_at,
      invoice_path: original.invoice_path ?? null,
      invoice_name: original.invoice_name ?? null,
      notes: original.notes,
      split_from_id: original.id,
    });
    logMaterialAdded(p.projectId, `${original.description} (split part)`, 1, p.amount, original.supplier, actingUser.fullName);
  }
  await deleteProjectMaterial(original.id, actingUser.fullName);
  refresh(original.project_id, null, original.supplier);
  for (const p of parts) revalidatePath(`/projects/${p.projectId}`);
}
