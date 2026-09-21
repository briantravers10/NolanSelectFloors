import Link from "next/link";
import { Card, Button, AlertPill } from "@/components/ui";
import { resetPasswordAction } from "@/app/login/actions";

const ERRORS: Record<string, string> = {
  invalid: "That code didn't work. Codes last one hour — request a new one from the sign-in page if it's expired.",
  weak: "Your new password needs to be at least 8 characters.",
  mismatch: "The two passwords didn't match — please re-enter them.",
  server: "Couldn't reset the password just now. Try again in a moment, or ask the owner to set one for you.",
};

/** Enter the emailed code and a new password. Reachable signed out. */
export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ email?: string; err?: string }> }) {
  const { email = "", err } = await searchParams;
  return (
    <div className="min-h-dvh flex items-center justify-center bg-slate-50 px-4">
      <Card className="w-full max-w-sm p-6">
        <div className="text-center mb-6">
          <div className="text-slate-900 font-semibold text-lg">Nolan Select Floors</div>
          <div className="text-xs text-slate-400 mt-0.5">Operations Console</div>
        </div>
        <form action={resetPasswordAction} className="space-y-3">
          <h2 className="text-sm font-semibold text-slate-900">Set a new password</h2>
          <p className="text-xs text-slate-500">
            If that email belongs to a staff account, a 6-digit code is on its way. Check spam if it hasn&apos;t arrived in a minute.
          </p>
          {err && <AlertPill tone="bad">{ERRORS[err] ?? ERRORS.server}</AlertPill>}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Email</label>
            <input name="email" type="email" required defaultValue={email} autoComplete="email" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Code from the email</label>
            <input name="code" type="text" inputMode="numeric" required autoComplete="one-time-code" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm tracking-widest" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">New password (8+ characters)</label>
            <input name="password" type="password" required minLength={8} autoComplete="new-password" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Confirm new password</label>
            <input name="confirm" type="password" required minLength={8} autoComplete="new-password" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          </div>
          <Button type="submit" className="w-full justify-center">
            Save password and sign in
          </Button>
          <p className="text-xs text-slate-400 text-center pt-1">
            <Link href="/login?mode=forgot" className="text-sky-600 hover:underline">Send a new code</Link>
            {" · "}
            <Link href="/login" className="text-sky-600 hover:underline">Back to sign in</Link>
          </p>
        </form>
      </Card>
    </div>
  );
}
