"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Button, AlertPill } from "@/components/ui";
import { ACCESS_ROLES, OFFICE_USER_ROLES } from "@/lib/types";
import { StaffAccessGridFields } from "./StaffAccessGridFields";
import { createStaffAccountAction, type CreateStaffAccountResult } from "./actions";

/**
 * Client wrapper around "+ Add Staff Account". Needs to be a client
 * component (unlike the rest of this server-rendered page) so it can show
 * the "what to tell them" instructions `createStaffAccountAction` returns
 * via `useActionState` when real auth is configured, instead of
 * immediately redirecting away — the redirect-on-submit demo-mode behavior
 * is unchanged (that branch of the action still calls `redirect()` itself,
 * which this component never sees).
 */
export function AddStaffAccountForm() {
  const [result, formAction, isPending] = useActionState<CreateStaffAccountResult | void, FormData>(
    async (_prev, formData) => createStaffAccountAction(formData),
    undefined
  );

  if (result?.officeUserId) {
    return (
      <div className="space-y-3">
        <AlertPill tone="warn">
          {result.fullName} has been added{result.email ? ` (${result.email})` : ""}.
        </AlertPill>
        {result.email ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 space-y-1">
            <div className="font-semibold">Tell them how to get in:</div>
            <ol className="list-decimal pl-5 space-y-0.5">
              <li>Open the app and tap <span className="font-medium">&quot;Set up your password&quot;</span> on the login page.</li>
              <li>
                Enter their email and the setup code{" "}
                {result.setupCode ? <code className="font-mono font-semibold">{result.setupCode}</code> : <span className="font-medium">(no setup code is set yet — set one above first)</span>}.
              </li>
              <li>Choose their own password.</li>
            </ol>
          </div>
        ) : (
          <AlertPill tone="bad">No email was given, so they can&apos;t log in yet — add one from their access page.</AlertPill>
        )}
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
          <label className="block text-xs font-medium text-slate-600 mb-1">Email (their username)</label>
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
