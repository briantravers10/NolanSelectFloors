"use client";

import { useActionState } from "react";
import { Button, AlertPill } from "@/components/ui";
import { createRealAccountForExistingUserAction, setNewPasswordAction, type SetNewPasswordResult } from "../actions";

/**
 * Owner/Admin real-login account management for one staff member (build
 * 12 — Activating Real Login, step 5). A client component (same reason as
 * AddStaffAccountForm.tsx) so it can show the one-time generated password
 * via `useActionState`, without navigating away. Only rendered when real
 * auth is configured — see [id]/page.tsx.
 *
 * Two states:
 *  - `hasRealAccount` false: "Create Real Login Account" (requires the row
 *    to already have an email — true for the seeded office_users, which
 *    predate real auth). This is the path for creating the FIRST real
 *    login (see README "Activating Real Login" test checklist).
 *  - `hasRealAccount` true: "Set New Password" — for a locked-out staff
 *    member, generates and sets a new temporary password directly via the
 *    Admin API.
 */
export function SetNewPasswordButton({ officeUserId, hasRealAccount, hasEmail }: { officeUserId: string; hasRealAccount: boolean; hasEmail: boolean }) {
  const action = hasRealAccount ? setNewPasswordAction.bind(null, officeUserId) : createRealAccountForExistingUserAction.bind(null, officeUserId);
  const [result, formAction, isPending] = useActionState<SetNewPasswordResult | undefined, FormData>(async () => action(), undefined);

  if (!hasRealAccount && !hasEmail) {
    return <p className="text-xs text-slate-500">Add an email to this account first, then a real login account can be created here.</p>;
  }

  const password = result?.newPassword;
  if (password) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
        <div className="text-xs text-amber-700 mb-1">
          {hasRealAccount ? "New temporary password" : "Temporary password"} (have them change it after signing in):
        </div>
        <code className="text-sm font-mono font-semibold text-amber-900 break-all">{password}</code>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <form action={formAction}>
        <Button type="submit" variant="secondary" disabled={isPending}>
          {isPending ? "Working…" : hasRealAccount ? "Set New Password" : "Create Real Login Account"}
        </Button>
      </form>
      {result?.error && <AlertPill tone="bad">{result.error}</AlertPill>}
    </div>
  );
}
