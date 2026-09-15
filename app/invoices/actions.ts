"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createEmailRoutingRule, createInvoice, setEmailRoutingRuleActive, setInvoiceFileReference, updateInvoiceStatus } from "@/lib/db";
import { uploadInvoiceFile } from "@/lib/storage";
import type { EmailRoutingAction, EmailRoutingBy, InvoiceStatus } from "@/lib/types";

export async function createInvoiceAction(formData: FormData) {
  const supplier = String(formData.get("supplier") ?? "").trim();
  if (!supplier) return;
  const amountRaw = String(formData.get("amount") ?? "").trim();
  const invoice_date = String(formData.get("invoice_date") ?? "") || undefined;
  const due_date = String(formData.get("due_date") ?? "") || undefined;
  const related_project_id = String(formData.get("related_project_id") ?? "") || undefined;
  const related_building_id = String(formData.get("related_building_id") ?? "") || undefined;
  const status = String(formData.get("status") ?? "Needed") as InvoiceStatus;
  const notes = String(formData.get("notes") ?? "").trim() || undefined;

  const invoice = await createInvoice({
    supplier,
    amount: amountRaw ? Number(amountRaw) : undefined,
    invoice_date,
    due_date,
    related_project_id,
    related_building_id,
    status,
    source: "Manual Entry",
    notes,
  });

  // File upload: soft-fails exactly like the Photos feature (lib/storage.ts)
  // — the invoice row is still saved either way, never a fabricated path.
  const file = formData.get("file");
  if (file instanceof File && file.size > 0) {
    const result = await uploadInvoiceFile(file, invoice.id);
    if (!result.unavailable && result.storage_path) {
      await setInvoiceFileReference(invoice.id, result.storage_path);
    }
  }

  revalidatePath("/invoices");
  redirect("/invoices");
}

export async function setInvoiceStatusAction(id: string, status: InvoiceStatus) {
  await updateInvoiceStatus(id, status);
  revalidatePath("/invoices");
}

export async function createEmailRoutingRuleAction(formData: FormData) {
  const keyword = String(formData.get("keyword") ?? "").trim();
  if (!keyword) return;
  const action_type = String(formData.get("action_type") ?? "Flag For Review") as EmailRoutingAction;
  const route_by = String(formData.get("route_by") ?? "Manual/Case-by-Case") as EmailRoutingBy;
  const notes = String(formData.get("notes") ?? "").trim() || undefined;
  await createEmailRoutingRule({ keyword, action_type, route_by, notes });
  revalidatePath("/invoices/rules");
}

export async function setEmailRoutingRuleActiveAction(id: string, active: boolean) {
  await setEmailRoutingRuleActive(id, active);
  revalidatePath("/invoices/rules");
}
