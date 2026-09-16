import Link from "next/link";
import { Card, Button, AlertPill } from "@/components/ui";
import { isRealAuthConfigured } from "@/lib/auth";
import { loginAction } from "./actions";

/**
 * Real email+password login page (build 11) — built now, honest about not
 * being wired up yet, exactly mirroring the QuickBooks/Google Calendar
 * "architected but not live" pattern (see README "Activating Real Login").
 * Submitting never fakes a successful sign-in: with no real Supabase Auth
 * project connected (always true in this environment), it shows a clear
 * message and hands off to the existing dev "acting as" selector, which
 * remains how this demo operates until a real project exists.
 */
export default async function LoginPage({ searchParams }: { searchParams: Promise<{ mode?: string }> }) {
  const { mode } = await searchParams;
  const showDemoMessage = mode === "demo" && !isRealAuthConfigured();

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
        ) : (
          <form action={loginAction} className="space-y-3">
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
            <p className="text-xs text-slate-400 text-center pt-1">
              No account yet? Staff accounts are created by your Owner/Admin from Company Setup → Staff Access.
            </p>
          </form>
        )}
      </Card>
    </div>
  );
}
