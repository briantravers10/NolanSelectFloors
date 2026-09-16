import Link from "next/link";
import { Card, Button, AlertPill } from "@/components/ui";
import { isRealAuthConfigured } from "@/lib/auth";
import { loginAction, setupPasswordAction } from "./actions";

/**
 * Real email+password login page (build 12 — Activating Real Login), plus
 * first-time self-serve password setup (?mode=setup).
 *
 * DEMO MODE (real auth not configured — no Supabase project connected, or
 * NSF_REAL_AUTH_ENABLED not set to "true"): unchanged from before —
 * submitting never fakes a successful sign-in; shows the honest "not
 * connected yet" message and hands off to the existing dev "acting as"
 * selector, which remains how this demo operates.
 *
 * REAL AUTH configured: the sign-in form calls `supabase.auth
 * .signInWithPassword()` via loginAction and redirects to /dashboard on
 * success; `?mode=error` shows one generic "Invalid email or password"
 * message that never reveals whether the email exists. `?mode=setup` shows
 * the first-time form (email + shared setup code + chosen password) handled
 * by setupPasswordAction — see app/login/actions.ts for the ?err= codes.
 */
const SETUP_ERRORS: Record<string, string> = {
  invalid: "That email and setup code don't match an active staff account. Check both with the owner and try again.",
  exists: "This account already has a password — use Sign in instead.",
  weak: "Your password needs to be at least 8 characters.",
  mismatch: "The two passwords didn't match — please re-enter them.",
  server: "Couldn't set up your account just now. Please try again in a moment, or ask the owner to set a password for you.",
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ mode?: string; err?: string }> }) {
  const { mode, err } = await searchParams;
  const realAuthConfigured = isRealAuthConfigured();
  const showDemoMessage = mode === "demo" && !realAuthConfigured;
  const showLoginError = mode === "error" && realAuthConfigured;
  const showSetup = mode === "setup" && realAuthConfigured;
  const showReady = mode === "ready" && realAuthConfigured;
  const setupError = showSetup && err ? (SETUP_ERRORS[err] ?? SETUP_ERRORS.server) : null;

  return (
    <div className="min-h-dvh flex items-center justify-center bg-slate-50 px-4">
      <Card className="w-full max-w-sm p-6">
        <div className="text-center mb-6">
          <div className="text-slate-900 font-semibold text-lg">Nolan Select Floors</div>
          <div className="text-xs text-slate-400 mt-0.5">Operations Console</div>
        </div>

        {showDemoMessage ? (
          <div className="space-y-4">
            <AlertPill tone="warn">
              Real login isn&apos;t connected yet — using demo mode. Once a Supabase project with Auth is connected, this form will sign real
              staff accounts in (see README &quot;Activating Real Login&quot;).
            </AlertPill>
            <Link href="/dashboard" className="block">
              <Button type="button" className="w-full justify-center">
                Continue in demo mode →
              </Button>
            </Link>
            <p className="text-xs text-slate-500 text-center">
              You&apos;ll pick who you&apos;re acting as from the &quot;Acting as&quot; selector in the top bar.
            </p>
          </div>
        ) : showSetup ? (
          <form action={setupPasswordAction} className="space-y-3">
            <h2 className="text-sm font-semibold text-slate-900">Set up your password</h2>
            <p className="text-xs text-slate-500">
              First time here? Enter your work email, the setup code the owner gave you, and choose a password.
            </p>
            {setupError && <AlertPill tone="bad">{setupError}</AlertPill>}
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Email</label>
              <input name="email" type="email" required autoComplete="email" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Setup code</label>
              <input name="code" type="text" required autoComplete="off" autoCapitalize="characters" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Choose a password (8+ characters)</label>
              <input name="password" type="password" required minLength={8} autoComplete="new-password" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Confirm password</label>
              <input name="confirm" type="password" required minLength={8} autoComplete="new-password" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            </div>
            <Button type="submit" className="w-full justify-center">
              Set password and sign in
            </Button>
            <p className="text-xs text-slate-400 text-center pt-1">
              Already set up?{" "}
              <Link href="/login" className="text-sky-600 hover:underline">
                Sign in
              </Link>
            </p>
          </form>
        ) : (
          <form action={loginAction} className="space-y-3">
            {showLoginError && <AlertPill tone="bad">Invalid email or password.</AlertPill>}
            {showReady && <AlertPill tone="warn">Your password is set — sign in below.</AlertPill>}
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Email</label>
              <input name="email" type="email" required autoComplete="email" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Password</label>
              <input name="password" type="password" required autoComplete="current-password" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            </div>
            <Button type="submit" className="w-full justify-center">
              Sign in
            </Button>
            {realAuthConfigured ? (
              <p className="text-xs text-slate-500 text-center pt-1">
                First time here?{" "}
                <Link href="/login?mode=setup" className="text-sky-600 font-medium hover:underline">
                  Set up your password
                </Link>
              </p>
            ) : (
              <p className="text-xs text-slate-400 text-center pt-1">
                No account yet? Staff accounts are created by your Owner/Admin from Company Setup → Staff Access.
              </p>
            )}
          </form>
        )}
      </Card>
    </div>
  );
}
