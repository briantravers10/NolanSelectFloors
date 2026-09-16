// Real-auth readiness abstraction (build 11) — mirrors the exact
// "architected but not live" pattern used elsewhere in this app
// (lib/routing.ts, lib/google-calendar.ts, lib/quickbooks.ts before it went
// live): the boundary is correct and clearly marked now, so activating it
// later is a small, well-defined follow-up, not a rewrite. See README
// "Activating Real Login" for exactly what changes once a real Supabase
// project with Auth enabled is connected.
//
// getCurrentSession() is the ONE thing every page/action should eventually
// call instead of lib/current-user.ts's dev "acting as" cookie mechanism.
// Today it always falls back to that dev mechanism, because
// isRealAuthConfigured() is always false in this environment (no real
// Supabase project exists to test against — see README). Nothing in this
// codebase calls getCurrentSession() yet; lib/current-user.ts's
// getActingUser()/getCurrentCompanyId() remain the live call sites
// everywhere until the swap described below happens.
import { getSupabaseClient } from "./supabaseClient";
import { getActingUser, getCurrentCompanyId, type ActingUser } from "./current-user";

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

/**
 * The one function every page/action would call for "who is logged in".
 * Falls back to the existing dev "acting as" cookie mechanism unchanged
 * when real auth isn't configured (current, live behavior everywhere in
 * this codebase today). When real auth IS configured, this would instead:
 *   1. Read the Supabase session cookie (via @supabase/ssr's
 *      createServerClient, using the request's cookies()).
 *   2. Look up the matching office_users row by auth_user_id.
 *   3. Return null (unauthenticated) instead of ever defaulting to the
 *      Owner persona, unlike the demo fallback below.
 * See README "Activating Real Login" for the exact steps — this function
 * is the single place that follow-up work touches.
 */
export async function getCurrentSession(): Promise<Session | null> {
  if (!isRealAuthConfigured()) {
    return { isRealAuth: false, companyId: getCurrentCompanyId(), user: await getActingUser() };
  }
  // Real implementation goes here once a Supabase project with Auth
  // enabled exists — intentionally unreachable today. Sketch:
  //
  //   const cookieStore = await cookies();
  //   const supabase = createServerClient(url, anonKey, { cookies: cookieStore });
  //   const { data: { user } } = await supabase.auth.getUser();
  //   if (!user) return null;
  //   const officeUser = (await listOfficeUsers()).find((u) => u.auth_user_id === user.id);
  //   if (!officeUser) return null;
  //   return { isRealAuth: true, companyId: officeUser.company_id, user: toActingUser(officeUser) };
  return null;
}
