import { cookies } from "next/headers";
import { COMPANY_ID } from "./seed-data";
import { getStore } from "./store";
import { getSupabaseClient } from "./supabaseClient";
import type { OfficeUser } from "./types";

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
}

export function ownerActingUser(): ActingUser {
  return { id: OWNER_ACTING_ID, fullName: getCurrentUser().fullName, role: "manager" };
}

/** All personas the dev selector can switch between. */
export async function listActingUserOptions(): Promise<ActingUser[]> {
  const officeUsers = await readOfficeUsers();
  const estimators: ActingUser[] = officeUsers.map((u) => ({ id: u.id, fullName: u.full_name, role: u.role }));
  return [...estimators, ownerActingUser()];
}

/**
 * Reads the dev "acting as" cookie (server components / server actions
 * only). Defaults to the owner/manager persona so reassign/release actions
 * are reachable out of the box in the demo.
 */
export async function getActingUser(): Promise<ActingUser> {
  const jar = await cookies();
  const id = jar.get(ACTING_USER_COOKIE)?.value;
  if (!id || id === OWNER_ACTING_ID) return ownerActingUser();
  const officeUsers = await readOfficeUsers();
  const match = officeUsers.find((u) => u.id === id);
  if (!match) return ownerActingUser();
  return { id: match.id, fullName: match.full_name, role: match.role };
}
