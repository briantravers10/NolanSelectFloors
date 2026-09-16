"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createOfficeUser, setSectionPermission, updateOfficeUser } from "@/lib/db";
import { getActingUser } from "@/lib/current-user";
import { isOwnerActingUser } from "@/lib/permissions";
import { ACCESS_ROLES, SECTION_ACCESS_LEVELS, SECTION_KEYS, type AccessRole, type OfficeUserRole, type SectionAccessLevel, type SectionKey } from "@/lib/types";

/**
 * Owner/Admin-only staff access management (build 11) — see
 * lib/permissions.ts isOwnerActingUser() and README "Permissions & Staff
 * Access". Every action here re-checks server-side, since the page that
 * renders these forms is itself only shown to an Owner/Admin acting user —
 * this is the real security boundary, not the hidden page alone.
 */

export async function createStaffAccountAction(formData: FormData) {
  const actingUser = await getActingUser();
  if (!(await isOwnerActingUser(actingUser))) return;

  const full_name = String(formData.get("full_name") ?? "").trim();
  if (!full_name) return;
  const email = String(formData.get("email") ?? "").trim() || undefined;
  const role = (String(formData.get("role") ?? "estimator") as OfficeUserRole) || "estimator";
  const access_role = (String(formData.get("access_role") ?? "office_staff") as AccessRole) || "office_staff";

  const created = await createOfficeUser({ full_name, email, role, access_role, active: true }, actingUser.fullName);

  // Per-section grid submitted at creation time (see README "Owner/Admin
  // Staff-Access UI") — one <select> per SECTION_KEYS, name
  // `section__<key>`. Rows are only written for non-'none' values (a
  // missing row already means 'none' — secure by default).
  for (const key of SECTION_KEYS) {
    const level = String(formData.get(`section__${key}`) ?? "none") as SectionAccessLevel;
    if (SECTION_ACCESS_LEVELS.includes(level) && level !== "none") {
      await setSectionPermission(created.id, key, level, actingUser.fullName);
    }
  }

  revalidatePath("/company-setup/staff-access");
  redirect(`/company-setup/staff-access/${created.id}`);
}

export async function updateSectionPermissionAction(officeUserId: string, sectionKey: SectionKey, formData: FormData) {
  const actingUser = await getActingUser();
  if (!(await isOwnerActingUser(actingUser))) return;
  const level = String(formData.get("access_level") ?? "none") as SectionAccessLevel;
  if (!SECTION_ACCESS_LEVELS.includes(level)) return;
  await setSectionPermission(officeUserId, sectionKey, level, actingUser.fullName);
  revalidatePath(`/company-setup/staff-access/${officeUserId}`);
}

export async function setStaffActiveAction(officeUserId: string, active: boolean) {
  const actingUser = await getActingUser();
  if (!(await isOwnerActingUser(actingUser))) return;
  await updateOfficeUser(officeUserId, { active }, actingUser.fullName);
  revalidatePath(`/company-setup/staff-access/${officeUserId}`);
  revalidatePath("/company-setup/staff-access");
}

/**
 * Promotes/demotes the Owner flag. Guarded so only ANOTHER Owner can grant
 * Owner status — see README "Permissions & Staff Access" -> "Audit
 * logging". (isOwnerActingUser() above already enforces "only an Owner may
 * call this at all"; nothing here lets a non-Owner self-promote.)
 */
export async function setStaffOwnerAction(officeUserId: string, isOwner: boolean) {
  const actingUser = await getActingUser();
  if (!(await isOwnerActingUser(actingUser))) return;
  await updateOfficeUser(officeUserId, { is_owner: isOwner }, actingUser.fullName);
  revalidatePath(`/company-setup/staff-access/${officeUserId}`);
  revalidatePath("/company-setup/staff-access");
}

export async function updateStaffAccessRoleAction(officeUserId: string, formData: FormData) {
  const actingUser = await getActingUser();
  if (!(await isOwnerActingUser(actingUser))) return;
  const access_role = String(formData.get("access_role") ?? "") as AccessRole;
  if (!ACCESS_ROLES.includes(access_role)) return;
  await updateOfficeUser(officeUserId, { access_role }, actingUser.fullName);
  revalidatePath(`/company-setup/staff-access/${officeUserId}`);
}
