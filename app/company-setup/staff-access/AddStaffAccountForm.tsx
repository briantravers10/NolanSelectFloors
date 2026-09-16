"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Button, AlertPill } from "@/components/ui";
import { ACCESS_ROLES, OFFICE_USER_ROLES } from "@/lib/types";
import { StaffAccessGridFields } from "./StaffAccessGridFields";
import { createStaffAccountAction, type CreateStaffAccountResult } from "./actions";

/**
 * Client wrapper around "+ Add Staff Account" (build 12 — Activating Real
 * Login). Needs to be a client component (unlike the rest of this
 * server-rendered page) so it can hold the one-time temporary password
 * `createStaffAccountAction` returns via `useActionState`, instead of
 * immediately redirecting away from it — the redirect-on-submit demo-mode
 * behavior is unchanged (that branch of the action still calls
 * `redirect()` itself, which this component never sees).
 */
export function AddStaffAccountForm() {
  const [result, formAction, isPending] = useActionState<CreateStaffAccountResult | void, FormData>(
    async (_prev, formData) => createStaffAccountAction(formData),
    undefined
  );

  if (result?.tempPassword) {
    return (
      <div className="space-y-3">
        <AlertPill tone="warn">Real login account created — this temporary password is shown once, right now.</AlertPill>
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
          <div className="text-xs text-amber-700 mb-1">Temporary password (have them change it after first login):</div>
          <code className="text-sm font-mono font-semibold text-amber-900 break-all">{result.tempPassword}</code>
        </div>
        <Link href={`/company-setup/staff-access/${result.officeUserId}`} className="text-sky-600 text-sm font-medium hover:underline">
          Continue to edit access →
        </Link>
      </div>
    );
  }

  if (result?.officeUserId) {
    // Real auth configured, but no real login account was created (no
    // email given, or the Admin API call failed) — the office_users
    // persona itself was still created successfully.
    return (
      <div className="space-y-3">
        <AlertPill tone="bad">{result.authAccountError ?? "Staff account created, but no real login account was created."}</AlertPill>
        <Link href={`/company-setup/staff-access/${result.officeUserId}`} className="text-sky-600 text-sm font-medium hover:underline">
          Continue to edit access →
        </Link>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Full name</label>
          <input name="full_name" required className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Email</label>
          <input name="email" type="email" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Bid-claim role</label>
          <select name="role" defaultValue="estimator" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
            {OFFICE_USER_ROLES.map((r) => (
              <option key={r} value={r}>
                {r === "estimator" ? "Estimator" : "Manager"}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Access-role tier (legacy — pay rates/QuickBooks connection)</label>
          <select name="access_role" defaultValue="office_staff" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
            {ACCESS_ROLES.map((r) => (
              <option key={r} value={r}>
                {r === "owner_admin" ? "Owner/Admin" : r === "office_staff" ? "Office Staff" : "Field/Employee"}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <h3 className="text-xs font-semibold text-slate-700 uppercase tracking-wide mb-2">Section access</h3>
        <StaffAccessGridFields />
      </div>

      <div className="flex justify-end">
        <Button type="submit" disabled={isPending}>
          {isPending ? "Adding…" : "Add Staff Account"}
        </Button>
      </div>
    </form>
  );
}
