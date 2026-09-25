"use server";

import { revalidatePath } from "next/cache";
import { getContact, listBuildingContacts, updateContact } from "@/lib/db";
import { canEdit } from "@/lib/permissions";

export async function saveContactAction(id: string, formData: FormData) {
  if (!(await canEdit("clients"))) return;
  const before = await getContact(id);
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
  if (before?.client_company_id) revalidatePath(`/clients/${before.client_company_id}`);
  const linkedBuildingIds = new Set((await listBuildingContacts()).filter((bc) => bc.contact_id === id).map((bc) => bc.building_id));
  for (const buildingId of linkedBuildingIds) revalidatePath(`/buildings/${buildingId}`);
}
