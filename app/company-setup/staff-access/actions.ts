"use server";

import { randomBytes } from "crypto";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createOfficeUser, getOfficeUser, getStaffSetupCode, listEmployees, listOfficeUsers, setSectionPermission, setStaffSetupCode, updateEmployee, updateOfficeUser } from "@/lib/db";
import { getActingUser } from "@/lib/current-user";
import { isOwnerActingUser } from "@/lib/permissions";
import { isRealAuthConfigured } from "@/lib/auth";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { ACCESS_ROLES, SECTION_ACCESS_LEVELS, SECTION_KEYS, type AccessRole, type OfficeUserRole, type SectionAccessLevel, type SectionKey } from "@/lib/types";

/**
 * Owner/Admin-only staff access management (build 11, real-account
 * creation added build 12 — Activating Real Login). See
 * lib/permissions.ts isOwnerActingUser() and README "Permissions & Staff
 * Access". Every action here re-checks server-side, since the page that
 * renders these forms is itself only shown to an Owner/Admin acting user —
 * this is the real security boundary, not the hidden page alone.
 */

/** A random, human-typeable temporary password — shown once in the UI so
 * the Owner/Admin can relay it, then the staff member is expected to
 * change it after first login (see README "Activating Real Login"). Not
 * meant to be memorable, just typeable: base64url alphabet, no padding. */
function generateTempPassword(): string {
  return randomBytes(18).toString("base64url");
}

export interface CreateStaffAccountResult {
  officeUserId: string;
  fullName: string;
  email?: string;
  /** The shared staff setup code to pass along (real auth configured) — the
   * new person sets their own password at /login with it. Undefined when
   * no code has been set yet, so the UI can say so. */
  setupCode?: string;
}

/**
 * Creates the office_users row + the per-section grid from a submitted
 * form (one <select> per SECTION_KEYS, named `section__<key>`; rows are
 * only written for non-'none' values — a missing row already means
 * 'none', secure by default). Shared by "+ Add Staff Account" and the
 * "Give access" button on a crew member's page.
 */
async function createAccountWithGrid(
  formData: FormData,
  actorName: string,
  overrides: { full_name?: string; email?: string; access_role?: AccessRole } = {}
): Promise<{ id: string; full_name: string; email?: string } | null> {
  const full_name = overrides.full_name ?? String(formData.get("full_name") ?? "").trim();
  if (!full_name) return null;
  const email = overrides.email ?? (String(formData.get("email") ?? "").trim() || undefined);
  const role = (String(formData.get("role") ?? "estimator") as OfficeUserRole) || "estimator";
  const access_role = overrides.access_role ?? ((String(formData.get("access_role") ?? "office_staff") as AccessRole) || "office_staff");
  const created = await createOfficeUser({ full_name, email, role, access_role, active: true }, actorName);
  for (const key of SECTION_KEYS) {
    const level = String(formData.get(`section__${key}`) ?? "none") as SectionAccessLevel;
    if (SECTION_ACCESS_LEVELS.includes(level) && level !== "none") {
      await setSectionPermission(created.id, key, level, actorName);
    }
  }
  revalidatePath("/company-setup/staff-access");
  return { id: created.id, full_name, email };
}

export async function createStaffAccountAction(formData: FormData): Promise<CreateStaffAccountResult | void> {
  const actingUser = await getActingUser();
  if (!(await isOwnerActingUser(actingUser))) return;

  const created = await createAccountWithGrid(formData, actingUser.fullName);
  if (!created) return;
  const { full_name, email } = created;

  // Demo mode (unchanged from before build 12): redirect straight to the
  // new account's edit page, exactly as always. Real auth configured: the
  // person creates their OWN password at /login → "Set up your password"
  // using the shared staff setup code — no invite email, no temp password
  // to relay — so return what the Owner/Admin needs to tell them (see
  // AddStaffAccountForm.tsx). "Set New Password" on the account's page
  // remains available for resets.
  if (!isRealAuthConfigured()) {
    redirect(`/company-setup/staff-access/${created.id}`);
  }
  return { officeUserId: created.id, fullName: full_name, email, setupCode: (await getStaffSetupCode()) ?? undefined };
}

/** Owner/Admin sets (or clears) the shared staff setup code — see
 * lib/db.ts setStaffSetupCode and app/login/actions.ts setupPasswordAction. */
export async function setStaffSetupCodeAction(formData: FormData) {
  const actingUser = await getActingUser();
  if (!(await isOwnerActingUser(actingUser))) return;
  const code = String(formData.get("code") ?? "").trim();
  await setStaffSetupCode(code || null, actingUser.fullName);
  revalidatePath("/company-setup/staff-access");
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
  revalidatePath("/company-setup/staff-access");
}

export interface SetNewPasswordResult {
  newPassword?: string;
  error?: string;
}

/**
 * Creates a real Supabase Auth account for an EXISTING office_users row
 * that doesn't have one yet (build 12 — Activating Real Login) — the path
 * for the seeded office_users (Sarah Bennett / Emma Castillo / David
 * Okoye), all of which already carry a seed email but predate real auth
 * and so have `auth_user_id: null`. Same createUser()-with-temp-password
 * approach as "Add Staff Account"; requires the row to already have an
 * email on file.
 */
export async function createRealAccountForExistingUserAction(officeUserId: string): Promise<SetNewPasswordResult> {
  const actingUser = await getActingUser();
  if (!(await isOwnerActingUser(actingUser))) return { error: "Not authorized." };
  if (!isRealAuthConfigured()) return { error: "Real login isn't connected yet." };

  const staffMember = await getOfficeUser(officeUserId);
  if (!staffMember) return { error: "Staff account not found." };
  if (staffMember.auth_user_id) return { error: "This account already has a real login — use Set New Password instead." };
  if (!staffMember.email) return { error: "This account has no email on file yet — add one first." };

  try {
    const admin = getSupabaseAdminClient();
    if (!admin) return { error: "Supabase Admin API isn't configured (missing SUPABASE_SERVICE_ROLE_KEY)." };

    const newPassword = generateTempPassword();
    const { data, error } = await admin.auth.admin.createUser({
      email: staffMember.email,
      password: newPassword,
      email_confirm: true,
      user_metadata: { office_user_id: staffMember.id, full_name: staffMember.full_name },
    });
    if (error || !data.user) return { error: error?.message ?? "Could not create the real login account." };

    await updateOfficeUser(officeUserId, { auth_user_id: data.user.id }, actingUser.fullName);
    revalidatePath(`/company-setup/staff-access/${officeUserId}`);
    return { newPassword };
  } catch (err) {
    return { error: err instanceof Error ? `Could not reach Supabase: ${err.message}` : "Could not reach Supabase to create the real login account." };
  }
}

/**
 * Owner/Admin "Set New Password" (build 12 — Activating Real Login, step
 * 5) — for when a staff member is locked out. Generates a new random
 * temporary password and sets it directly via the Admin API's
 * update-user-by-id capability (`supabase.auth.admin.updateUserById`),
 * shown once in the UI the same way "Add Staff Account"'s initial password
 * is. Only functional when real auth is configured AND this office_users
 * row already has a real auth_user_id (i.e. "Add Staff Account" or a prior
 * call to this action created one) — otherwise there is no real account to
 * reset a password on.
 */
export async function setNewPasswordAction(officeUserId: string): Promise<SetNewPasswordResult> {
  const actingUser = await getActingUser();
  if (!(await isOwnerActingUser(actingUser))) return { error: "Not authorized." };
  if (!isRealAuthConfigured()) return { error: "Real login isn't connected yet." };

  const staffMember = await getOfficeUser(officeUserId);
  if (!staffMember?.auth_user_id) {
    return { error: "This account has no real login yet — it needs an email and a real login account created first (see \"Add Staff Account\")." };
  }

  try {
    const admin = getSupabaseAdminClient();
    if (!admin) return { error: "Supabase Admin API isn't configured (missing SUPABASE_SERVICE_ROLE_KEY)." };

    const newPassword = generateTempPassword();
    const { error } = await admin.auth.admin.updateUserById(staffMember.auth_user_id, { password: newPassword });
    if (error) return { error: error.message };

    revalidatePath(`/company-setup/staff-access/${officeUserId}`);
    return { newPassword };
  } catch (err) {
    return { error: err instanceof Error ? `Could not reach Supabase: ${err.message}` : "Could not reach Supabase to set a new password." };
  }
}

/**
 * "Give access" on a crew member's page: creates their login account (an
 * office_users row named after them) with the per-section grid chosen on
 * that page. Owner/Admin only, same as "+ Add Staff Account".
 */
export async function giveEmployeeAccessAction(employeeId: string, formData: FormData): Promise<CreateStaffAccountResult | void> {
  const actingUser = await getActingUser();
  if (!(await isOwnerActingUser(actingUser))) return;
  const employee = (await listEmployees()).find((e) => e.id === employeeId);
  if (!employee) return;
  const email = String(formData.get("email") ?? "").trim() || employee.email || undefined;
  const full_name = `${employee.first_name} ${employee.last_name}`.trim();
  const existing = (await listOfficeUsers()).find((u) => (email && u.email?.toLowerCase() === email.toLowerCase()) || u.full_name.toLowerCase() === full_name.toLowerCase());
  if (existing) {
    // Already has an account — just update the grid they asked for.
    for (const key of SECTION_KEYS) {
      const level = String(formData.get(`section__${key}`) ?? "none") as SectionAccessLevel;
      if (SECTION_ACCESS_LEVELS.includes(level)) await setSectionPermission(existing.id, key, level, actingUser.fullName);
    }
    if (email && !existing.email) await updateOfficeUser(existing.id, { email }, actingUser.fullName);
    revalidatePath(`/staff/${employeeId}`);
    revalidatePath("/company-setup/staff-access");
    revalidatePath(`/company-setup/staff-access/${existing.id}`);
    return { officeUserId: existing.id, fullName: existing.full_name, email: existing.email ?? email, setupCode: (await getStaffSetupCode()) ?? undefined };
  }
  const tier = String(formData.get("access_role") ?? "field_employee") as AccessRole;
  const created = await createAccountWithGrid(formData, actingUser.fullName, { full_name, email, access_role: ACCESS_ROLES.includes(tier) ? tier : "field_employee" });
  if (!created) return;
  if (email && !employee.email) await updateEmployee(employeeId, { email }, actingUser.fullName);
  revalidatePath(`/staff/${employeeId}`);
  return { officeUserId: created.id, fullName: full_name, email, setupCode: (await getStaffSetupCode()) ?? undefined };
}
