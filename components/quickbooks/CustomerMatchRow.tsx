"use client";

import { useState } from "react";
import type { QuickBooksCustomerCandidate } from "@/lib/types";
import { Button } from "@/components/ui";
import { createQuickBooksCustomerAction, linkQuickBooksCustomerAction } from "@/app/company-setup/quickbooks/actions";

/**
 * One management company's matching row — [Link] / [Not the Same] /
 * [Create New QuickBooks Customer]. Never auto-links a fuzzy match; "Not
 * the Same" only dismisses a candidate from THIS view (no persistence
 * needed — it isn't a decision that needs to be remembered, since nothing
 * was linked).
 */
export function CustomerMatchRow({
  clientCompanyId,
  clientCompanyName,
  connected,
  canManage,
  candidates,
}: {
  clientCompanyId: string;
  clientCompanyName: string;
  connected: boolean;
  canManage: boolean;
  candidates: QuickBooksCustomerCandidate[];
}) {
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [showCreate, setShowCreate] = useState(false);
  const visible = candidates.filter((c) => !dismissed.has(c.qb_customer_id));

  return (
    <div className="border border-slate-200 rounded-lg p-3">
      <div className="text-sm font-medium text-slate-900 mb-1.5">{clientCompanyName}</div>

      {connected && visible.length > 0 && (
        <div className="space-y-1.5 mb-2">
          {visible.map((c) => (
            <div key={c.qb_customer_id} className="flex items-center justify-between gap-2 text-sm bg-slate-50 rounded-lg px-2.5 py-1.5">
              <span className="text-slate-700">
                {c.qb_customer_name} <span className="text-xs text-slate-400">({Math.round(c.score * 100)}% match)</span>
              </span>
              <div className="flex items-center gap-2 shrink-0">
                <form
                  action={linkQuickBooksCustomerAction.bind(null, clientCompanyId)}
                  onSubmit={(e) => {
                    if (!canManage) e.preventDefault();
                  }}
                >
                  <input type="hidden" name="qb_customer_id" value={c.qb_customer_id} />
                  <input type="hidden" name="qb_customer_name" value={c.qb_customer_name} />
                  <button type="submit" disabled={!canManage} className="text-xs font-medium text-sky-600 hover:underline disabled:text-slate-300">
                    Link
                  </button>
                </form>
                <button
                  type="button"
                  onClick={() => setDismissed((prev) => new Set(prev).add(c.qb_customer_id))}
                  className="text-xs text-slate-500 hover:underline"
                >
                  Not the Same
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {connected && visible.length === 0 && candidates.length === 0 && (
        <p className="text-xs text-slate-400 mb-2">No similarly-named QuickBooks customers found.</p>
      )}

      {!showCreate ? (
        <Button variant="secondary" className="text-xs py-1" onClick={() => setShowCreate(true)} disabled={!canManage}>
          Create New QuickBooks Customer
        </Button>
      ) : (
        <form action={createQuickBooksCustomerAction.bind(null, clientCompanyId)} className="flex items-center gap-2">
          <input
            name="display_name"
            defaultValue={clientCompanyName}
            required
            className="flex-1 rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm"
          />
          <Button type="submit" className="text-xs py-1" disabled={!canManage}>Create</Button>
        </form>
      )}
      {!connected && <p className="text-[11px] text-slate-400 mt-1">This will show &quot;QuickBooks isn&apos;t connected&quot; until a real connection exists.</p>}
    </div>
  );
}
