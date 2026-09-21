"use client";

import { useState } from "react";
import { Button } from "@/components/ui";
import { fileInboundAction } from "@/app/inbox/actions";

export interface InboxJobOption {
  id: string;
  buildingId: string;
  label: string;
}

/**
 * Filing form on an unfiled email. Drawing → needs a job. Invoice →
 * supplier, amount, date, and an OPTIONAL job: leave it blank for stock or
 * tools and it still counts under the supplier. One record either way.
 */
export function FileInboundForm({
  emailId,
  initialKind,
  jobs,
  defaultProjectId,
  suppliers,
  defaultSupplier,
  defaultDate,
  submitLabel = "File",
}: {
  emailId: string;
  initialKind: "drawing" | "invoice";
  jobs: InboxJobOption[];
  defaultProjectId: string;
  suppliers: string[];
  defaultSupplier: string;
  defaultDate: string;
  submitLabel?: string;
}) {
  const [kind, setKind] = useState<"drawing" | "invoice">(initialKind);
  const input = "rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm w-full";

  return (
    <form action={fileInboundAction.bind(null, emailId)} className="flex flex-col gap-2 min-w-[300px]">
      <select name="kind" value={kind} onChange={(e) => setKind(e.target.value as "drawing" | "invoice")} className={input}>
        <option value="drawing">File as Drawing</option>
        <option value="invoice">File as Invoice</option>
      </select>

      {kind === "invoice" && (
        <>
          <div>
            <label className="block text-[11px] text-slate-500 uppercase mb-0.5">Supplier</label>
            <input name="supplier" required list={`suppliers-${emailId}`} autoComplete="off" defaultValue={defaultSupplier} placeholder="Pick or type" className={input} />
            <datalist id={`suppliers-${emailId}`}>
              {suppliers.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[11px] text-slate-500 uppercase mb-0.5">Amount</label>
              <input name="amount" type="number" step="0.01" min="0" placeholder="0.00" className={input} />
            </div>
            <div>
              <label className="block text-[11px] text-slate-500 uppercase mb-0.5">Invoice date</label>
              <input name="invoice_date" type="date" defaultValue={defaultDate} className={input} />
            </div>
          </div>
        </>
      )}

      <div>
        <label className="block text-[11px] text-slate-500 uppercase mb-0.5">
          Job {kind === "invoice" && <span className="normal-case text-slate-400">(optional)</span>}
        </label>
        <select name="project_id" required={kind === "drawing"} defaultValue={defaultProjectId} className={input}>
          <option value="" disabled={kind === "drawing"}>{kind === "drawing" ? "— Which job? —" : "No job — supplier only"}</option>
          {jobs.map((j) => (
            <option key={j.id} value={j.id}>{j.label}</option>
          ))}
        </select>
        {kind === "invoice" && (
          <div className="text-[11px] text-slate-500 mt-1">Counted once: under the supplier always, and under the job only if you pick one. You can link it later from Suppliers.</div>
        )}
      </div>
      <Button type="submit">{submitLabel}</Button>
    </form>
  );
}
