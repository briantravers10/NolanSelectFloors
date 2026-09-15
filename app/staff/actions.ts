"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createEmployee, updateEmployee } from "@/lib/db";
import { canEditPayRates, getActingUser } from "@/lib/current-user";
import type { PayType, StaffCapability } from "@/lib/types";

export async function createStaffAction(formData: FormData) {
  const first_name = String(formData.get("first_name") ?? "").trim();
  const last_name = String(formData.get("last_name") ?? "").trim();
  if (!first_name || !last_name) return;

  const capabilities = formData.getAll("capabilities").map(String) as StaffCapability[];
  const dayRate = Number(formData.get("day_rate") ?? 0);

  // Pay-rate fields only appear on the form for an Owner/Admin acting user
  // (see app/staff/new/page.tsx) — anyone else creates a new hire with a
  // sane default (daily, mirroring the legacy day_rate) that an Owner/Admin
  // can set properly afterward from the staff profile.
  const actingUser = await getActingUser();
  const canEditRates = canEditPayRates(actingUser);
  const pay_type = (canEditRates ? String(formData.get("pay_type") ?? "daily") : "daily") as PayType;
  const daily_rate = canEditRates ? Number(formData.get("daily_rate") ?? dayRate) : dayRate;
  const hourly_rate = canEditRates ? Number(formData.get("hourly_rate") ?? 0) || undefined : undefined;

  const employee = await createEmployee({
    first_name,
    last_name,
    title: String(formData.get("title") ?? "Installer"),
    phone: String(formData.get("phone") ?? "") || undefined,
    email: String(formData.get("email") ?? "") || undefined,
    day_rate: dayRate,
    pay_type,
    daily_rate,
    hourly_rate,
    is_driver: formData.get("is_driver") === "on",
    active: formData.get("active") !== "off",
    hire_date: String(formData.get("hire_date") ?? "") || undefined,
    notes: String(formData.get("notes") ?? "") || undefined,
    capabilities,
  });
  revalidatePath("/staff");
  redirect(`/staff/${employee.id}`);
}

/**
 * Updates an employee's pay rate — Owner/Admin only (see
 * lib/current-user.ts canEditPayRates()). This is the UI-level gate; the
 * form that submits here is itself only rendered for an Owner/Admin acting
 * user (app/staff/[id]/page.tsx), and this action re-checks server-side so
 * a submitted form still can't slip through for a lower-tier acting user.
 */
export async function updateEmployeePayRateAction(employeeId: string, formData: FormData) {
  const actingUser = await getActingUser();
  if (!canEditPayRates(actingUser)) return;

  const pay_type = String(formData.get("pay_type") ?? "daily") as PayType;
  const daily_rate = Number(formData.get("daily_rate") ?? 0) || undefined;
  const hourly_rate = Number(formData.get("hourly_rate") ?? 0) || undefined;

  await updateEmployee(employeeId, { pay_type, daily_rate, hourly_rate }, actingUser.fullName);
  revalidatePath(`/staff/${employeeId}`);
  revalidatePath("/staff");
}
