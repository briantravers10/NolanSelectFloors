import { cookies } from "next/headers";
import { COMPANY_ID } from "./seed-data";
import { getStore } from "./store";
import { getSupabaseClient } from "./supabaseClient";
// Circular import with lib/auth.ts, intentional — see the doc comment on
// getActingUser() below. auth.ts's demo-mode branch calls this file's
// getActingUser() (aliased there); this file's real-auth branch calls
// auth.ts's isRealAuthConfigured()/getCurrentSession(). The two directions
// are mutually exclusive on the isRealAuthConfigured() check itself, so
// there's no runtime recursion — only a module-graph cycle, which
// Next.js/webpack's live ES module bindings handle correctly as long as
// (as here) the imported functions are only ever called inside another
// function's body, never at module-evaluation time.
import { isRealAuthConfigured, getCurrentSession } from "./auth";
import type { AccessRole, OfficeUser } from "./types";

// Note: this file intentionally does NOT import from lib/db.ts (which
// itself imports getCurrentCompanyId from here) to avoid a circular
// module dependency, so it duplicates the tiny Supabase-or-store read for
// office_users. lib/db.ts's listOfficeUsers() is the one pages should use.
async function readOfficeUsers(): Promise<OfficeUser[]> {
  const client = getSupabaseClient();
  if (client) {
    const { data, error } = await client.from("office_users").select("*").order("full_name");
    if (!error && data) return data as OfficeUser[];
  }
  return getStore().officeUsers;
}

// Placeholder auth context. There is no login flow yet — the whole app
// operates as this single company/user. When real auth (Supabase Auth +
// the `users` table + role-based access) is added, swap the body of these
// two functions to read the session instead, and every call site that
// already scopes by companyId will keep working unchanged.

export function getCurrentCompanyId(): string {
  return COMPANY_ID;
}

export function getCurrentUser() {
  return {
    id: "user-1",
    fullName: "Brian Travers",
    email: "travers.brian10@gmail.com",
    role: "company_owner" as const,
  };
}

// ---------------------------------------------------------------------
// Dev "acting as" user — a placeholder for real per-estimator auth.
// ---------------------------------------------------------------------
// There is no login yet, so bid claiming/reassigning needs *some* concrete
// person to act as. The TopBar's dev selector writes a cookie naming either
// an office_users.id (an estimator) or the sentinel "owner" (the existing
// single company_owner user, who stands in for the Manager/Owner role that
// can reassign/release bids). Every claim/reassign/release call reads this
// via getActingUser() below. Swapping this for a real session is the only
// change needed once auth exists — see README.
export const ACTING_USER_COOKIE = "nsf_acting_user";
export const OWNER_ACTING_ID = "owner";

export interface ActingUser {
  id: string; // office_users.id, or OWNER_ACTING_ID
  fullName: string;
  role: "estimator" | "manager";
  // Labor-cost / pay-rate visibility tier — see lib/types.ts ACCESS_ROLES
  // and README "Labor Cost Tracking — Access Control". Deliberately
  // separate from `role` above, which only governs bid-claim permissions.
  accessRole: AccessRole;
}

export function ownerActingUser(): ActingUser {
  return { id: OWNER_ACTING_ID, fullName: getCurrentUser().fullName, role: "manager", accessRole: "owner_admin" };
}

/** All personas the dev selector can switch between. */
export async function listActingUserOptions(): Promise<ActingUser[]> {
  const officeUsers = await readOfficeUsers();
  const estimators: ActingUser[] = officeUsers.map((u) => ({
    id: u.id,
    fullName: u.full_name,
    role: u.role,
    accessRole: u.access_role ?? "office_staff",
  }));
  return [...estimators, ownerActingUser()];
}

/** Sentinel ActingUser id for "a real Supabase Auth session exists, but no
 * office_users row's auth_user_id matches it" — see lib/auth.ts
 * getCurrentSession() and README "Activating Real Login". Deliberately
 * matches no real office_users.id and isn't OWNER_ACTING_ID, so every
 * permission check (lib/permissions.ts, canViewLaborCost/etc. below)
 * naturally resolves this to zero access instead of a special case. */
export const NO_MATCHING_ACCOUNT_ID = "no-matching-account";

function noMatchingAccountUser(): ActingUser {
  return { id: NO_MATCHING_ACCOUNT_ID, fullName: "No matching staff account", role: "estimator", accessRole: "field_employee" };
}

/**
 * The one function almost every page/action in this app calls for "who is
 * acting right now" (build 12 — Activating Real Login).
 *
 * When real auth isn't configured (`isRealAuthConfigured()` false — the
 * case everywhere today with no env vars / NSF_REAL_AUTH_ENABLED set),
 * this is 100% unchanged from before: it reads the dev "acting as" cookie
 * directly (server components / server actions only) and defaults to the
 * owner/manager persona so reassign/release actions are reachable out of
 * the box in the demo.
 *
 * When real auth IS configured, this instead goes through
 * lib/auth.ts#getCurrentSession() — which reads the real Supabase Auth
 * session and resolves it to the matching office_users row — and returns
 * a safe, fully-locked-out persona (noMatchingAccountUser(), NOT the
 * Owner default above) if no session or no matching account exists,
 * rather than ever silently granting Owner access. Note the circular
 * import with lib/auth.ts: this function is exactly what auth.ts's demo
 * fallback branch calls (see its comment) — the two directions are
 * mutually exclusive on the isRealAuthConfigured() check, so there's no
 * runtime recursion.
 */
export async function getActingUser(): Promise<ActingUser> {
  if (isRealAuthConfigured()) {
    const session = await getCurrentSession();
    return session ? session.user : noMatchingAccountUser();
  }

  const jar = await cookies();
  const id = jar.get(ACTING_USER_COOKIE)?.value;
  if (!id || id === OWNER_ACTING_ID) return ownerActingUser();
  const officeUsers = await readOfficeUsers();
  const match = officeUsers.find((u) => u.id === id);
  if (!match) return ownerActingUser();
  return { id: match.id, fullName: match.full_name, role: match.role, accessRole: match.access_role ?? "office_staff" };
}

// ---------------------------------------------------------------------
// PAY RATE / LABOR COST VISIBILITY GATE — UI-level only (no real auth
// yet, see README). Every page/component that renders a pay rate or a
// computed labor-cost dollar figure should check these before rendering.
// ---------------------------------------------------------------------

/** Owner/Admin (full) and Office Staff (view) can see pay rates / labor
 * costs; Field/Employee cannot. */
export function canViewLaborCost(user: Pick<ActingUser, "accessRole">): boolean {
  return user.accessRole === "owner_admin" || user.accessRole === "office_staff";
}

/** Only Owner/Admin can edit employee pay rates. */
export function canEditPayRates(user: Pick<ActingUser, "accessRole">): boolean {
  return user.accessRole === "owner_admin";
}

/** Annual vacation/sick allowance is sensitive-ish HR data — reuses the
 * exact same access-role gate as pay rates above (see README "Vacation &
 * Sick Day Tracker — Annual Allowance"). Named separately from
 * canViewLaborCost/canEditPayRates so the two concerns can diverge later
 * without a confusing shared name, even though they're identical today. */
export function canViewTimeOffAllowance(user: Pick<ActingUser, "accessRole">): boolean {
  return canViewLaborCost(user);
}
export function canEditTimeOffAllowance(user: Pick<ActingUser, "accessRole">): boolean {
  return canEditPayRates(user);
}

// ---------------------------------------------------------------------
// QUICKBOOKS PERMISSIONS — reuses the exact same access_role concept as
// pay-rate/labor-cost visibility above. See README "QuickBooks Online
// Integration — Permissions" for the full write-up.
//   owner_admin     — everything: view, create/link documents, sync, AND
//                      manage the connection itself (connect/disconnect).
//   office_staff    — view QuickBooks data, create/link estimates and
//                      invoices, run Sync Now — but NOT manage the
//                      connection (connect/disconnect/reconnect is
//                      Owner/Admin only, since it touches stored
//                      credentials).
//   field_employee  — no access at all, consistent with pay rates being
//                      hidden from this role.
// ---------------------------------------------------------------------

/** View linked QuickBooks documents, connection status, and the customer
 * matching screen. */
export function canViewQuickBooks(user: Pick<ActingUser, "accessRole">): boolean {
  return user.accessRole === "owner_admin" || user.accessRole === "office_staff";
}

/** "Prepare Estimate/Invoice" -> "Create in QuickBooks", and "Link
 * Existing QuickBooks Estimate/Invoice". */
export function canManageQuickBooksDocuments(user: Pick<ActingUser, "accessRole">): boolean {
  return canViewQuickBooks(user);
}

/** "Sync Now" and viewing/creating customer link mappings. */
export function canSyncQuickBooks(user: Pick<ActingUser, "accessRole">): boolean {
  return canViewQuickBooks(user);
}

/** Connect / Disconnect / Reconnect — touches stored credentials, so this
 * is Owner/Admin only, stricter than plain view/create access. */
export function canManageQuickBooksConnection(user: Pick<ActingUser, "accessRole">): boolean {
  return user.accessRole === "owner_admin";
}

/** Job financials / profitability (the Financial Summary section, which
 * combines gated labor cost with QuickBooks invoice amounts) — same tier
 * as labor cost, since it exposes cost figures alongside price figures. */
export function canViewJobFinancials(user: Pick<ActingUser, "accessRole">): boolean {
  return canViewLaborCost(user);
}

/** The admin-only Sync Log view (raw QuickBooks action history). */
export function canViewQuickBooksSyncLog(user: Pick<ActingUser, "accessRole">): boolean {
  return user.accessRole === "owner_admin";
}
