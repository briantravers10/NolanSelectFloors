"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClientCompanyRecord } from "@/lib/db";
import { canEdit } from "@/lib/permissions";

export async function createClientAction(formData: FormData) {
  // Server-action gate (build 11) — the real security boundary, since a
  // view-only user could otherwise bypass a hidden "New Client" button.
  // See README "Enforcement".
  if (!(await canEdit("clients"))) return;
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;
  const client = await createClientCompanyRecord({
    name,
    type: String(formData.get("type") ?? "Property Management"),
    phone: String(formData.get("phone") ?? "") || undefined,
    email: String(formData.get("email") ?? "") || undefined,
    address: String(formData.get("address") ?? "") || undefined,
    website: String(formData.get("website") ?? "") || undefined,
    ap_contact_name: String(formData.get("ap_contact_name") ?? "") || undefined,
    ap_contact_phone: String(formData.get("ap_contact_phone") ?? "") || undefined,
    ap_contact_email: String(formData.get("ap_contact_email") ?? "") || undefined,
    relationship_start_date: String(formData.get("relationship_start_date") ?? "") || undefined,
    active: formData.get("active") !== "off",
    billing_notes: String(formData.get("billing_notes") ?? "") || undefined,
    notes: String(formData.get("notes") ?? "") || undefined,
  });
  revalidatePath("/clients");
  redirect(`/clients/${client.id}`);
}
