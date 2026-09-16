"use server";

import { redirect } from "next/navigation";
import { isRealAuthConfigured } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Real Supabase Auth sign-in (build 12 — Activating Real Login).
 *
 * DEMO MODE (real auth not configured — the case with no Supabase project
 * connected, or NSF_REAL_AUTH_ENABLED not set): unchanged from before —
 * never fakes success, always lands on the honest "not connected yet"
 * message and hands off to the existing dev "acting as" selector.
 *
 * REAL AUTH configured: calls `supabase.auth.signInWithPassword()`
 * server-side. On success, the @supabase/ssr server client has already
 * written the session cookie via its `setAll` callback, so redirecting to
 * /dashboard is enough — proxy.ts / lib/auth.ts#getCurrentSession() pick
 * the session up from there. On failure, redirects back to /login?mode=error
 * so page.tsx can show a single generic message ("Invalid email or
 * password") — this deliberately never reveals whether the email exists,
 * matching Supabase's own invalid_credentials error being intentionally
 * non-specific. (The form action isn't wired through useActionState, so a
 * redirect + searchParams flag is how this stays a plain server action,
 * consistent with the existing ?mode=demo pattern below.)
 */
export async function loginAction(formData: FormData) {
  if (!isRealAuthConfigured()) {
    redirect("/login?mode=demo");
  }

  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!email || !password) {
    redirect("/login?mode=error");
  }

  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    redirect("/login?mode=error");
  }

  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    redirect("/login?mode=error");
  }

  redirect("/dashboard");
}

/**
 * Real "Sign Out" — calls `supabase.auth.signOut()`, which clears the
 * session cookie via the server client's `setAll` callback, then sends the
 * person back to /login. Only functional (and only reachable from the UI —
 * see components/TopBar.tsx) when real auth is configured; there is no
 * real session to sign out of otherwise.
 */
export async function signOutAction() {
  if (!isRealAuthConfigured()) {
    redirect("/login");
  }
  const supabase = await createSupabaseServerClient();
  if (supabase) {
    await supabase.auth.signOut();
  }
  redirect("/login");
}
