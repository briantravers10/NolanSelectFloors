"use server";

import { revalidatePath } from "next/cache";
import { convertLeadToClient, createLead, updateLeadStatus } from "@/lib/db";
import type { LeadStatus } from "@/lib/types";

export async function addLeadAction(formData: FormData) {
  const company_name = String(formData.get("company_name") ?? "");
  if (!company_name.trim()) return;
  await createLead({
    company_name,
    contact_name: String(formData.get("contact_name") ?? "") || undefined,
    phone: String(formData.get("phone") ?? "") || undefined,
    email: String(formData.get("email") ?? "") || undefined,
    source: String(formData.get("source") ?? "") || undefined,
    estimated_value: formData.get("estimated_value") ? Number(formData.get("estimated_value")) : undefined,
    notes: String(formData.get("notes") ?? "") || undefined,
  });
  revalidatePath("/new-business");
}

export async function setLeadStatusAction(id: string, status: LeadStatus) {
  await updateLeadStatus(id, status);
  revalidatePath("/new-business");
}

export async function convertLeadAction(id: string) {
  await convertLeadToClient(id);
  revalidatePath("/new-business");
  revalidatePath("/clients");
}
