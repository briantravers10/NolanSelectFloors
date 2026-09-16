import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Server-only Supabase Admin API client (build 12 — Activating Real
 * Login). Built with SUPABASE_SERVICE_ROLE_KEY, which bypasses Row Level
 * Security and can call `supabase.auth.admin.*` — never import this into
 * any client component or anything reachable from the browser.
 *
 * The `server-only` import above makes any accidental client-side import
 * of this module a build-time error rather than a leaked secret.
 *
 * Used ONLY for:
 *  - app/company-setup/staff-access/actions.ts "Add Staff Account" ->
 *    supabase.auth.admin.createUser()
 *  - the per-account "Set New Password" action ->
 *    supabase.auth.admin.updateUserById()
 *
 * Returns null when SUPABASE_SERVICE_ROLE_KEY (or the project URL) isn't
 * set, same "absent env vars => not configured" convention as
 * lib/supabaseClient.ts and lib/supabase/server.ts.
 */
let cached: SupabaseClient | null | undefined;

export function getSupabaseAdminClient(): SupabaseClient | null {
  if (cached !== undefined) return cached;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    cached = null;
    return cached;
  }
  cached = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return cached;
}
