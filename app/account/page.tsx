import { Card, PageHeader, Button, AlertPill } from "@/components/ui";
import { getActingUser } from "@/lib/current-user";
import { isRealAuthConfigured } from "@/lib/auth";
import { changePasswordAction } from "@/app/login/actions";

const ERRORS: Record<string, string> = {
  weak: "Your new password needs to be at least 8 characters.",
  mismatch: "The two passwords didn't match — please re-enter them.",
  server: "Couldn't change the password just now. Try again in a moment.",
  demo: "Real login isn't connected, so there's no password to change.",
};

/** The signed-in person's own account: change password. */
export default async function AccountPage({ searchParams }: { searchParams: Promise<{ ok?: string; err?: string }> }) {
  const { ok, err } = await searchParams;
  const user = await getActingUser();
  const realAuth = isRealAuthConfigured();
  return (
    <div>
      <PageHeader title="My account" subtitle={`Signed in as ${user.fullName}`} />
      <Card className="p-5 max-w-md">
        <h2 className="text-sm font-semibold text-slate-900 uppercase tracking-wide mb-3">Change password</h2>
        {ok && <div className="mb-3"><AlertPill tone="warn">Password changed. Use the new one next time you sign in.</AlertPill></div>}
        {err && <div className="mb-3"><AlertPill tone="bad">{ERRORS[err] ?? ERRORS.server}</AlertPill></div>}
        {realAuth ? (
          <form action={changePasswordAction} className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">New password (8+ characters)</label>
              <input name="password" type="password" required minLength={8} autoComplete="new-password" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Confirm new password</label>
              <input name="confirm" type="password" required minLength={8} autoComplete="new-password" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            </div>
            <Button type="submit">Change password</Button>
          </form>
        ) : (
          <p className="text-sm text-slate-500">Real login isn&apos;t connected in this environment.</p>
        )}
        <p className="text-xs text-slate-500 mt-4">
          Locked out? Use &quot;Forgot your password?&quot; on the sign-in page to get a code by email, or ask an Owner/Admin to set a temporary password for you from Company Setup → Staff Access.
        </p>
      </Card>
    </div>
  );
}
