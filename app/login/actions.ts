"use server";

import { redirect } from "next/navigation";
import { isRealAuthConfigured } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { getOfficeUserByEmail, getStaffSetupCode, updateOfficeUser } from "@/lib/db";
import { sendEmail } from "@/lib/email";

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

/**
 * First-time self-serve password setup (/login?mode=setup). A staff member
 * whose Owner/Admin has already added them (an office_users row with their
 * email, no real account yet) enters that email, the shared staff setup
 * code (Company Setup → Staff Access), and a password of their choosing.
 * On success the real Supabase Auth account is created with that password
 * and linked, then they're signed straight in.
 *
 * No invite email and no per-person password relay are needed — the code
 * is what stops a stranger who merely knows a staff email from claiming
 * the account. Every failure reason maps to a short ?err= code that
 * page.tsx turns into a plain-language message; "invalid" deliberately
 * covers both a wrong code and an unknown email so neither is confirmable.
 *
 * NOTE: redirect() works by throwing, so it must never sit inside the
 * try/catch around the Admin API call below or it would be swallowed.
 */
export async function setupPasswordAction(formData: FormData) {
  if (!isRealAuthConfigured()) {
    redirect("/login?mode=demo");
  }

  const email = String(formData.get("email") ?? "").trim();
  const code = String(formData.get("code") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");

  if (!email || !code || !password) redirect("/login?mode=setup&err=invalid");
  if (password.length < 8) redirect("/login?mode=setup&err=weak");
  if (password !== confirm) redirect("/login?mode=setup&err=mismatch");

  const expected = await getStaffSetupCode();
  const staff = await getOfficeUserByEmail(email);
  const codeOk = typeof expected === "string" && expected !== "" && code.toLowerCase() === expected.toLowerCase();
  if (!codeOk || !staff || !staff.active || !staff.email) redirect("/login?mode=setup&err=invalid");
  if (staff.auth_user_id) redirect("/login?mode=setup&err=exists");

  let createdAuthId: string | null = null;
  try {
    const admin = getSupabaseAdminClient();
    if (admin) {
      const { data, error } = await admin.auth.admin.createUser({
        email: staff.email,
        password,
        email_confirm: true,
        user_metadata: { office_user_id: staff.id, full_name: staff.full_name },
      });
      if (!error && data.user) createdAuthId = data.user.id;
    }
  } catch {
    createdAuthId = null;
  }
  if (!createdAuthId) redirect("/login?mode=setup&err=server");

  await updateOfficeUser(staff.id, { auth_user_id: createdAuthId }, staff.full_name);

  // Sign them straight in; if that somehow fails the account still exists,
  // so fall back to the normal sign-in form with a success note.
  const supabase = await createSupabaseServerClient();
  const signIn = supabase ? await supabase.auth.signInWithPassword({ email: staff.email, password }) : null;
  if (!signIn || signIn.error) redirect("/login?mode=ready");
  redirect("/dashboard");
}

/**
 * "Forgot password" — emails a 6-digit code to the staff member's address
 * on file. The code comes from Supabase's recovery-link generator (Admin
 * API) and is delivered through our own Resend domain, so no Supabase
 * email settings are needed. Always lands on the same "check your email"
 * page whether or not the address exists, so it can't be used to probe
 * for accounts.
 */
export async function forgotPasswordAction(formData: FormData) {
  if (!isRealAuthConfigured()) redirect("/login?mode=demo");
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!email) redirect("/login?mode=forgot&err=email");

  try {
    const staff = await getOfficeUserByEmail(email);
    const admin = getSupabaseAdminClient();
    if (staff?.active && staff.auth_user_id && staff.email && admin) {
      const { data, error } = await admin.auth.admin.generateLink({ type: "recovery", email: staff.email });
      const code = data?.properties?.email_otp;
      if (!error && code) {
        await sendEmail(
          staff.email,
          "Your Nolan Select Floors password reset code",
          `Hi ${staff.full_name.split(" ")[0]},\n\nYour password reset code is: ${code}\n\nEnter it on the reset page along with a new password. The code works for one hour. If you didn't ask for this, you can ignore this email.\n\n— Nolan Select Floors`
        );
      }
    }
  } catch {
    // Same outcome either way — never reveal whether the email exists.
  }
  redirect(`/reset-password?email=${encodeURIComponent(email)}`);
}

/** Second half of "forgot password": code + new password → signed in. */
export async function resetPasswordAction(formData: FormData) {
  if (!isRealAuthConfigured()) redirect("/login?mode=demo");
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const code = String(formData.get("code") ?? "").replace(/\s+/g, "");
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");
  const back = `/reset-password?email=${encodeURIComponent(email)}`;
  if (!email || !code) redirect(`${back}&err=invalid`);
  if (password.length < 8) redirect(`${back}&err=weak`);
  if (password !== confirm) redirect(`${back}&err=mismatch`);

  const supabase = await createSupabaseServerClient();
  if (!supabase) redirect(`${back}&err=server`);
  const verified = await supabase.auth.verifyOtp({ email, token: code, type: "recovery" });
  if (verified.error || !verified.data.session) redirect(`${back}&err=invalid`);
  const updated = await supabase.auth.updateUser({ password });
  if (updated.error) redirect(`${back}&err=server`);
  redirect("/dashboard?pw=changed");
}

/** Signed-in "Change password" (Account page). No email needed. */
export async function changePasswordAction(formData: FormData) {
  if (!isRealAuthConfigured()) redirect("/account?err=demo");
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");
  if (password.length < 8) redirect("/account?err=weak");
  if (password !== confirm) redirect("/account?err=mismatch");
  const supabase = await createSupabaseServerClient();
  if (!supabase) redirect("/account?err=server");
  const { error } = await supabase.auth.updateUser({ password });
  if (error) redirect("/account?err=server");
  redirect("/account?ok=1");
}
