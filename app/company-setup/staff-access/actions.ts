"use server";

import { randomBytes } from "crypto";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createOfficeUser, getOfficeUser, setSectionPermission, updateOfficeUser } from "@/lib/db";
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
  /** Set only when a real Supabase Auth account was created for this
   * person — i.e. real auth is configured AND an email was provided. */
  tempPassword?: string;
  /** Set when real auth is configured, an email was given, but the
   * Supabase Admin API call itself failed (e.g. duplicate auth email) —
   * the office_users persona still exists and can be used with the dev
   * selector / edited to fix the email and retried. */
  authAccountError?: string;
}

export async function createStaffAccountAction(formData: FormData): Promise<CreateStaffAccountResult | void> {
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

  // Real account creation (build 12): when real auth is configured, also
  // create a real Supabase Auth user via the Admin API and link it onto
  // this office_users row's auth_user_id. Uses createUser() with a
  // generated temporary password + email_confirm:true rather than
  // inviteUserByEmail() — this app has no real email-sending configured
  // yet (no Resend/SMTP integration anywhere else in the codebase), so an
  // invite email would never arrive; the temp password is instead
  // returned once here for the Owner/Admin to relay directly.
  let tempPassword: string | undefined;
  let authAccountError: string | undefined;
  if (isRealAuthConfigured()) {
    if (!email) {
      authAccountError = "No email was given, so no real login account was created — add one and use \"Set New Password\" on this account's page to create it.";
    } else {
      const admin = getSupabaseAdminClient();
      if (!admin) {
        authAccountError = "Supabase Admin API isn't configured (missing SUPABASE_SERVICE_ROLE_KEY) — no real login account was created.";
      } else {
        const generated = generateTempPassword();
        const { data, error } = await admin.auth.admin.createUser({
          email,
          password: generated,
          email_confirm: true,
          user_metadata: { office_user_id: created.id, full_name },
        });
        if (error || !data.user) {
          authAccountError = error?.message ?? "Could not create the real login account.";
        } else {
          await updateOfficeUser(created.id, { auth_user_id: data.user.id }, actingUser.fullName);
          tempPassword = generated;
        }
      }
    }
  }

  revalidatePath("/company-setup/staff-access");

  // Demo mode (unchanged from before build 12): redirect straight to the
  // new account's edit page, exactly as always. Real auth configured: skip
  // the redirect so the temporary password (or account-creation error) can
  // actually be shown once — see AddStaffAccountForm.tsx.
  if (!isRealAuthConfigured()) {
    redirect(`/company-setup/staff-access/${created.id}`);
  }
  return { officeUserId: created.id, tempPassword, authAccountError };
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

  const admin = getSupabaseAdminClient();
  if (!admin) return { error: "Supabase Admin API isn't configured (missing SUPABASE_SERVICE_ROLE_KEY)." };

  const newPassword = generateTempPassword();
  const { error } = await admin.auth.admin.updateUserById(staffMember.auth_user_id, { password: newPassword });
  if (error) return { error: error.message };

  revalidatePath(`/company-setup/staff-access/${officeUserId}`);
  return { newPassword };
}
