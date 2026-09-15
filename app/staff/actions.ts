"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createEmployee } from "@/lib/db";
import type { StaffCapability } from "@/lib/types";

export async function createStaffAction(formData: FormData) {
  const first_name = String(formData.get("first_name") ?? "").trim();
  const last_name = String(formData.get("last_name") ?? "").trim();
  if (!first_name || !last_name) return;

  const capabilities = formData.getAll("capabilities").map(String) as StaffCapability[];

  const employee = await createEmployee({
    first_name,
    last_name,
    title: String(formData.get("title") ?? "Installer"),
    phone: String(formData.get("phone") ?? "") || undefined,
    email: String(formData.get("email") ?? "") || undefined,
    day_rate: Number(formData.get("day_rate") ?? 0),
    is_driver: formData.get("is_driver") === "on",
    active: formData.get("active") !== "off",
    hire_date: String(formData.get("hire_date") ?? "") || undefined,
    notes: String(formData.get("notes") ?? "") || undefined,
    capabilities,
  });
  revalidatePath("/staff");
  redirect(`/staff/${employee.id}`);
}
