"use client";

import { useState } from "react";
import { Button } from "@/components/ui";
import { splitInvoiceAction } from "@/app/suppliers/actions";
import type { JobOption } from "./AddSupplierInvoiceForm";

/**
 * Split one invoice across two or more jobs. The parts must add up to the
 * invoice total, so nothing is ever counted twice: the original line is
 * replaced by the parts, each carrying its share, the supplier, the date
 * and the same invoice file. The supplier total does not change.
 */
export function SplitInvoiceForm({ materialId, total, jobs }: { materialId: string; total: number; jobs: JobOption[] }) {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<{ job: string; amount: string }[]>([
    { job: "", amount: (total / 2).toFixed(2) },
    { job: "", amount: (total - Math.round((total / 2) * 100) / 100).toFixed(2) },
  ]);
  const allocated = rows.reduce((s, r) => s + (Number(r.amount) || 0), 0);
  const remaining = Math.round((total - allocated) * 100) / 100;
  const ok = Math.abs(remaining) < 0.005 && rows.every((r) => r.job && Number(r.amount) > 0);
  const input = "rounded-md border border-slate-300 bg-white px-2 py-1 text-xs";

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="text-xs text-sky-700 hover:underline">
        Split across jobs
      </button>
    );
  }

  return (
    <form action={splitInvoiceAction.bind(null, materialId)} className="mt-1 rounded-lg border border-sky-200 bg-sky-50 p-2 space-y-1.5 min-w-[320px]">
      <div className="text-[11px] font-semibold text-slate-700">Split ${total.toFixed(2)} across jobs</div>
      {rows.map((r, i) => (
        <div key={i} className="flex items-center gap-1.5">
          <select
            name={`job_${i}`}
            value={r.job}
            onChange={(e) => setRows((x) => x.map((row, j) => (j === i ? { ...row, job: e.target.value } : row)))}
            className={`${input} flex-1 min-w-0`}
            aria-label={`Job for part ${i + 1}`}
          >
            <option value="">Pick a job…</option>
            {jobs.map((j) => (
              <option key={j.id} value={j.id}>{j.label}</option>
            ))}
          </select>
          <input
            name={`amount_${i}`}
            type="number"
            step="0.01"
            min="0"
            value={r.amount}
            onChange={(e) => setRows((x) => x.map((row, j) => (j === i ? { ...row, amount: e.target.value } : row)))}
            className={`${input} w-24 text-right`}
            aria-label={`Amount for part ${i + 1}`}
          />
          {rows.length > 2 && (
            <button type="button" onClick={() => setRows((x) => x.filter((_, j) => j !== i))} className="text-slate-400 hover:text-rose-600 text-xs" aria-label="Remove this part">✕</button>
          )}
        </div>
      ))}
      <input type="hidden" name="parts" value={rows.length} />
      <div className="flex items-center justify-between gap-2 text-[11px]">
        <button type="button" onClick={() => setRows((x) => [...x, { job: "", amount: "" }])} className="text-sky-700 hover:underline">+ Another job</button>
        <span className={remaining === 0 ? "text-emerald-700" : "text-amber-800 font-medium"}>
          {remaining === 0 ? "Adds up" : remaining > 0 ? `$${remaining.toFixed(2)} left to allocate` : `$${Math.abs(remaining).toFixed(2)} over the total`}
        </span>
      </div>
      <div className="flex justify-end gap-2">
        <button type="button" onClick={() => setOpen(false)} className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs">Cancel</button>
        <Button type="submit" disabled={!ok} className="!py-1 !px-2.5 text-xs">Split</Button>
      </div>
    </form>
  );
}
