// Real-auth readiness abstraction (build 12 — Activating Real Login).
// Mirrors the exact "architected but not live" pattern used elsewhere in
// this app (lib/routing.ts, lib/google-calendar.ts, lib/quickbooks.ts
// before it went live) — but as of build 12, the real branch below is a
// live code path, not a sketch, wired to real Supabase Auth via
// lib/supabase/server.ts (@supabase/ssr). See README "Activating Real
// Login" for exactly what this does and the manual test checklist for
// verifying it once deployed (this sandboxed dev session has no network
// access to *.supabase.co, so it could only be verified by code review —
// see that section for what still needs a live smoke test).
//
// getCurrentSession() is the ONE function real pages/actions call instead
// of lib/current-user.ts's dev "acting as" cookie mechanism. Note the
// (intentional) circular import with lib/current-user.ts: when real auth
// ISN'T configured, this delegates to current-user.ts's getActingUser()
// (aliased below) for the demo fallback; when real auth IS configured,
// current-user.ts's getActingUser() delegates the other way, to this
// file's real-session branch. Each direction is only ever exercised on one
// side of the `isRealAuthConfigured()` branch, so there's no runtime
// recursion — see the comment on getActingUser() in current-user.ts.
import { createSupabaseServerClient } from "./supabase/server";
import { getSupabaseClient } from "./supabaseClient";
import { getOfficeUserByAuthId, hasAnyRealAuthAccount } from "./db";
import { getActingUser as getDevActingUser, getCurrentCompanyId, type ActingUser } from "./current-user";
import type { OfficeUser } from "./types";

export interface Session {
  /** true when this session came from a real Supabase Auth user; false
   * when it's the dev "acting as" fallback. */
  isRealAuth: boolean;
  companyId: string;
  user: ActingUser;
}

/**
 * Real Supabase Auth is "configured" when a real project is connected AND
 * that project has Auth enabled with at least one confirmed office_user
 * (auth_user_id set). We can't detect "Auth enabled" from env vars alone
 * (getSupabaseClient() only tells us a project is reachable), so this
 * additionally requires an explicit opt-in env var — set
 * NSF_REAL_AUTH_ENABLED=true once real Supabase Auth accounts have
 * actually been created via "Add Staff Account" (see README). This keeps
 * a freshly-connected-but-not-yet-migrated Supabase project from silently
 * breaking the dev selector for everyone.
 */
export function isRealAuthConfigured(): boolean {
  return getSupabaseClient() !== null && process.env.NSF_REAL_AUTH_ENABLED === "true";
}

function officeUserToActingUser(u: OfficeUser): ActingUser {
  return { id: u.id, fullName: u.full_name, role: u.role, accessRole: u.access_role };
}

/**
 * The one function every page/action would call for "who is logged in".
 * Falls back to the existing dev "acting as" cookie mechanism, completely
 * unchanged, when real auth isn't configured — this is the exact same
 * object shape/values current-user.ts's getActingUser() has always
 * produced for the demo case (see README "Activating Real Login").
 *
 * When real auth IS configured:
 *   1. Reads the Supabase session cookie via lib/supabase/server.ts's
 *      createSupabaseServerClient() (@supabase/ssr's createServerClient).
 *   2. Looks up the matching office_users row by auth_user_id
 *      (lib/db.ts#getOfficeUserByAuthId()).
 *   3. Returns null — never a default Owner persona, unlike the demo
 *      fallback above — when there's no Supabase Auth session, or a
 *      session exists but no office_users row matches it yet (a real
 *      account created without a proper office_users mapping; shouldn't
 *      normally happen since "Add Staff Account" always sets
 *      auth_user_id, but this is the honest "no matching staff account"
 *      state instead of silently defaulting to Owner or crashing).
 */
export async function getCurrentSession(): Promise<Session | null> {
  // Bootstrap window: until at least one office_users row has a real
  // account (auth_user_id set), treat real auth as not yet configured —
  // see lib/db.ts#hasAnyRealAuthAccount() and README "Activating Real
  // Login". Otherwise NSF_REAL_AUTH_ENABLED=true alone would lock
  // everyone out of Company Setup → Staff Access before the first real
  // account can ever be created.
  if (!isRealAuthConfigured() || !(await hasAnyRealAuthAccount())) {
    return { isRealAuth: false, companyId: getCurrentCompanyId(), user: await getDevActingUser() };
  }

  const supabase = await createSupabaseServerClient();
  if (!supabase) return null; // env vars vanished between the isRealAuthConfigured() check and here — treat as unauthenticated.

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const officeUser = await getOfficeUserByAuthId(user.id);
  if (!officeUser) return null; // real session, no matching staff account — see doc comment above.

  return { isRealAuth: true, companyId: officeUser.company_id, user: officeUserToActingUser(officeUser) };
}
