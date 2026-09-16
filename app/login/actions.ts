"use server";

import { redirect } from "next/navigation";
import { isRealAuthConfigured } from "@/lib/auth";

/**
 * Honest-stub login submit (build 11) — mirrors the exact pattern used for
 * QuickBooks/Google Calendar "Connect" buttons: never fakes success. Real
 * Supabase Auth isn't connected in this environment, so this always lands
 * on the "not connected yet" message rather than pretending to sign in.
 * See lib/auth.ts and README "Activating Real Login".
 */
export async function loginAction(formData: FormData) {
  void formData; // email/password aren't checked against anything real yet
  if (isRealAuthConfigured()) {
    // Real implementation would go here once a Supabase project with Auth
    // is connected — intentionally unreachable today.
    redirect("/dashboard");
  }
  redirect("/login?mode=demo");
}
