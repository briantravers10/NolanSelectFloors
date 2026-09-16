"use server";

import { revalidatePath } from "next/cache";
import { updateContact } from "@/lib/db";
import { canEdit } from "@/lib/permissions";

export async function saveContactAction(id: string, formData: FormData) {
  if (!(await canEdit("clients"))) return;
  await updateContact(id, {
    first_name: String(formData.get("first_name") ?? ""),
    last_name: String(formData.get("last_name") ?? ""),
    title: String(formData.get("title") ?? ""),
    phone: String(formData.get("phone") ?? ""),
    mobile_phone: String(formData.get("mobile_phone") ?? ""),
    email: String(formData.get("email") ?? ""),
    notes: String(formData.get("notes") ?? ""),
  });
  revalidatePath(`/contacts/${id}`);
}
