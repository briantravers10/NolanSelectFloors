"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { Button, AlertPill } from "@/components/ui";
import { StaffAccessGridFields } from "@/app/company-setup/staff-access/StaffAccessGridFields";
import { giveEmployeeAccessAction, type CreateStaffAccountResult } from "@/app/company-setup/staff-access/actions";

/**
 * "Give access" on a crew member's page — creates their login with a
 * per-section None / View / Full Edit grid, then shows what to tell them.
 */
export function GiveAccessForm({ employeeId, defaultEmail, firstName }: { employeeId: string; defaultEmail?: string; firstName: string }) {
  const [open, setOpen] = useState(false);
  const [result, formAction, isPending] = useActionState<CreateStaffAccountResult | void, FormData>(
    async (_prev, formData) => giveEmployeeAccessAction(employeeId, formData),
    undefined
  );

  if (result?.officeUserId) {
    return (
      <div className="space-y-2">
        <AlertPill tone="warn">{result.fullName} now has app access{result.email ? ` (${result.email})` : ""}.</AlertPill>
        {result.email ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 space-y-1">
            <div className="font-semibold">Tell {firstName} how to get in:</div>
            <ol className="list-decimal pl-5 space-y-0.5">
              <li>Open the app and tap <span className="font-medium">&quot;Set up your password&quot;</span> on the login page.</li>
              <li>
                Enter their email and the setup code{" "}
                {result.setupCode ? <code className="font-mono font-semibold">{result.setupCode}</code> : <span className="font-medium">(no setup code is set yet — set one under Company Setup → Staff Access)</span>}.
              </li>
              <li>Choose their own password.</li>
            </ol>
          </div>
        ) : (
          <AlertPill tone="bad">No email was given, so they can&apos;t log in yet — add one from their access page.</AlertPill>
        )}
        <Link href={`/company-setup/staff-access/${result.officeUserId}`} className="text-sky-600 text-sm font-medium hover:underline">Edit their access →</Link>
      </div>
    );
  }

  if (!open) {
    return (
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-slate-500">No app login yet. Give access to let {firstName} see their schedule and dashboard (money hidden unless you allow it).</p>
        <Button type="button" onClick={() => setOpen(true)} className="whitespace-nowrap">Give access</Button>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Email (their username)</label>
          <input name="email" type="email" required defaultValue={defaultEmail ?? ""} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Money visibility</label>
          <select name="access_role" defaultValue="field_employee" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
            <option value="field_employee">Field / crew — no pay rates or costs</option>
            <option value="office_staff">Office staff — sees costs</option>
          </select>
        </div>
      </div>
      <div>
        <h3 className="text-xs font-semibold text-slate-700 uppercase tracking-wide mb-2">What can they open? (read-only or edit, per section)</h3>
        <StaffAccessGridFields current={{ dashboard: "view", schedule: "view" }} />
      </div>
      <div className="flex items-center justify-between">
        <button type="button" onClick={() => setOpen(false)} className="text-xs text-slate-500 hover:underline">Cancel</button>
        <Button type="submit" disabled={isPending}>{isPending ? "Setting up…" : "Give access"}</Button>
      </div>
    </form>
  );
}
