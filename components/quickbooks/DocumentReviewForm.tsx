"use client";

import { useState } from "react";
import type { QuickBooksLineItem, QuickBooksEntityType } from "@/lib/types";
import { Button } from "@/components/ui";
import { formatCurrencyPrecise, round2 } from "@/lib/calculations";

/**
 * "Prepare Estimate/Invoice" review screen — customer, job, editable line
 * items (description/qty/rate/amount), total. Nothing is created in
 * QuickBooks until "Create {Estimate/Invoice} in QuickBooks" below is
 * pressed, which submits to the real (disconnected-safe) service layer via
 * a server action. This is never a "Send" action — QuickBooks itself is
 * the only place a human sends a document to a customer.
 */
export function DocumentReviewForm({
  entityType,
  customerName,
  jobName,
  initialLineItems,
  action,
  errorMessage,
}: {
  entityType: QuickBooksEntityType;
  customerName: string;
  jobName: string;
  initialLineItems: QuickBooksLineItem[];
  action: (formData: FormData) => void;
  errorMessage?: string;
}) {
  const [lineItems, setLineItems] = useState<QuickBooksLineItem[]>(initialLineItems);

  function updateLine(idx: number, patch: Partial<QuickBooksLineItem>) {
    setLineItems((prev) =>
      prev.map((line, i) => {
        if (i !== idx) return line;
        const next = { ...line, ...patch };
        next.amount = round2(next.quantity * next.rate);
        return next;
      })
    );
  }

  function addLine() {
    setLineItems((prev) => [...prev, { description: "", quantity: 1, rate: 0, amount: 0 }]);
  }

  function removeLine(idx: number) {
    setLineItems((prev) => prev.filter((_, i) => i !== idx));
  }

  const total = round2(lineItems.reduce((s, l) => s + l.amount, 0));

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="line_items" value={JSON.stringify(lineItems)} />

      {errorMessage && <p className="text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">{errorMessage}</p>}

      <div className="grid sm:grid-cols-2 gap-3 text-sm">
        <div><div className="text-xs text-slate-500 uppercase">Customer</div><div>{customerName}</div></div>
        <div><div className="text-xs text-slate-500 uppercase">Job</div><div>{jobName}</div></div>
      </div>

      <div>
        <div className="text-xs text-slate-500 uppercase mb-1.5">Line Items</div>
        <div className="space-y-2">
          {lineItems.map((line, idx) => (
            <div key={idx} className="grid grid-cols-12 gap-2 items-center">
              <input
                value={line.description}
                onChange={(e) => updateLine(idx, { description: e.target.value })}
                placeholder="Description"
                className="col-span-5 rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
              />
              <input
                type="number"
                step="0.01"
                value={line.quantity}
                onChange={(e) => updateLine(idx, { quantity: Number(e.target.value) || 0 })}
                className="col-span-2 rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
              />
              <input
                type="number"
                step="0.01"
                value={line.rate}
                onChange={(e) => updateLine(idx, { rate: Number(e.target.value) || 0 })}
                className="col-span-2 rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
              />
              <div className="col-span-2 text-sm text-right pr-1">{formatCurrencyPrecise(line.amount)}</div>
              <button type="button" onClick={() => removeLine(idx)} className="col-span-1 text-rose-500 text-xs hover:underline">✕</button>
            </div>
          ))}
        </div>
        <button type="button" onClick={addLine} className="text-xs text-sky-600 hover:underline mt-2">+ Add line item</button>
      </div>

      <div className="flex justify-end text-sm font-semibold text-slate-900 border-t border-slate-200 pt-2">
        Total: {formatCurrencyPrecise(total)}
      </div>

      <Button type="submit">Create {entityType} in QuickBooks</Button>
    </form>
  );
}
