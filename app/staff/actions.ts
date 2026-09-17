"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createEmployee, createTimeOffEntry, deleteTimeOffEntry, updateEmployee } from "@/lib/db";
import { canEditPayRates, canEditTimeOffAllowance, getActingUser } from "@/lib/current-user";
import { canEdit } from "@/lib/permissions";
import type { PayType, StaffCapability, TaxStatus, TimeOffType } from "@/lib/types";
import { TAX_STATUSES, TIME_OFF_TYPES } from "@/lib/types";

function parseTaxStatus(raw: FormDataEntryValue | null): TaxStatus | undefined {
  const value = String(raw ?? "").trim();
  return (TAX_STATUSES as readonly string[]).includes(value) ? (value as TaxStatus) : undefined;
}

export async function createStaffAction(formData: FormData) {
  if (!(await canEdit("staff"))) return;
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
    tax_status: parseTaxStatus(formData.get("tax_status")),
    capabilities,
  });
  revalidatePath("/staff");
  redirect(`/staff/${employee.id}`);
}

/**
 * Sets whether the person is a W-4 payroll employee or a 1099 contractor.
 * Not gated like pay rates — anyone with Staff edit access can set it.
 * An empty selection clears it back to "not set".
 */
export async function updateEmployeeTaxStatusAction(employeeId: string, formData: FormData) {
  if (!(await canEdit("staff"))) return;
  const actingUser = await getActingUser();
  const tax_status = parseTaxStatus(formData.get("tax_status")) ?? null;
  await updateEmployee(employeeId, { tax_status: tax_status as TaxStatus | undefined }, actingUser.fullName);
  revalidatePath(`/staff/${employeeId}`);
  revalidatePath("/staff");
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
  if (!canEditPayRates(actingUser) || !(await canEdit("staff"))) return;

  const pay_type = String(formData.get("pay_type") ?? "daily") as PayType;
  const daily_rate = Number(formData.get("daily_rate") ?? 0) || undefined;
  const hourly_rate = Number(formData.get("hourly_rate") ?? 0) || undefined;

  await updateEmployee(employeeId, { pay_type, daily_rate, hourly_rate }, actingUser.fullName);
  revalidatePath(`/staff/${employeeId}`);
  revalidatePath("/staff");
}

// ---------------------------------------------------------------------
// VACATION & SICK DAY TRACKER (build 7) — see lib/db.ts and README
// "Vacation & Sick Day Tracker". No access gating: day-off status is
// visible/loggable by anyone, consistent with the rest of the Staff
// section (only pay rates are gated — see canViewLaborCost/canEditPayRates
// above).
// ---------------------------------------------------------------------

export async function addTimeOffAction(employeeId: string, formData: FormData) {
  if (!(await canEdit("staff"))) return;
  const startDate = String(formData.get("start_date") ?? "");
  const endRaw = String(formData.get("end_date") ?? "");
  const endDate = endRaw || startDate; // a single day off leaves "end date" blank
  if (!startDate) return;
  const type = String(formData.get("type") ?? "Vacation") as TimeOffType;
  if (!TIME_OFF_TYPES.includes(type)) return;
  const notes = String(formData.get("notes") ?? "") || undefined;

  const actingUser = await getActingUser();
  await createTimeOffEntry({
    employee_id: employeeId,
    start_date: startDate,
    end_date: endDate < startDate ? startDate : endDate,
    type,
    notes,
    actorName: actingUser.fullName,
  });
  revalidatePath(`/staff/${employeeId}`);
  revalidatePath("/staff");
  revalidatePath("/dashboard");
}

/**
 * Updates an employee's annual vacation/sick allowance — gated the same
 * way as updateEmployeePayRateAction above (Owner/Admin only; see
 * lib/current-user.ts canEditTimeOffAllowance()). Re-checked server-side
 * so the form (itself only rendered for an Owner/Admin acting user) can't
 * be bypassed by a direct submit.
 */
export async function updateEmployeeTimeOffAllowanceAction(employeeId: string, formData: FormData) {
  const actingUser = await getActingUser();
  if (!canEditTimeOffAllowance(actingUser) || !(await canEdit("staff"))) return;

  const vacationRaw = String(formData.get("vacation_days_allowed") ?? "").trim();
  const sickRaw = String(formData.get("sick_days_allowed") ?? "").trim();
  const vacation_days_allowed = vacationRaw === "" ? undefined : Math.max(0, Number(vacationRaw));
  const sick_days_allowed = sickRaw === "" ? undefined : Math.max(0, Number(sickRaw));

  await updateEmployee(employeeId, { vacation_days_allowed, sick_days_allowed }, actingUser.fullName);
  revalidatePath(`/staff/${employeeId}`);
  revalidatePath("/staff");
}

export async function deleteTimeOffAction(employeeId: string, entryId: string) {
  if (!(await canEdit("staff"))) return;
  const actingUser = await getActingUser();
  await deleteTimeOffEntry(entryId, actingUser.fullName);
  revalidatePath(`/staff/${employeeId}`);
  revalidatePath("/staff");
  revalidatePath("/dashboard");
}
