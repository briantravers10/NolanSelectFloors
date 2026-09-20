"use client";

import { useState } from "react";
import { Button } from "@/components/ui";
import { addSupplierInvoiceAction } from "@/app/suppliers/actions";

export interface JobOption {
  id: string;
  label: string;
}

/**
 * Add an invoice from the Suppliers page. Supplier is required; the job is
 * optional — leave it blank for stock, tools, or anything not for one
 * job. Either way it is one record, so it is never costed twice.
 */
export function AddSupplierInvoiceForm({ suppliers, jobs, storageConfigured, defaultSupplier }: { suppliers: string[]; jobs: JobOption[]; storageConfigured: boolean; defaultSupplier?: string }) {
  const [open, setOpen] = useState(false);
  const input = "rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm w-full";

  if (!open) {
    return (
      <Button type="button" onClick={() => setOpen(true)}>
        + Add invoice
      </Button>
    );
  }

  return (
    <form action={addSupplierInvoiceAction} className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3 w-full">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="col-span-2 sm:col-span-1">
          <label className="block text-[11px] text-slate-500 uppercase mb-1">Supplier</label>
          <input name="supplier" required list="supplier-names" autoComplete="off" defaultValue={defaultSupplier ?? ""} placeholder="Pick or type" className={input} />
          <datalist id="supplier-names">
            {suppliers.map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
        </div>
        <div>
          <label className="block text-[11px] text-slate-500 uppercase mb-1">Amount</label>
          <input name="amount" type="number" step="0.01" min="0" required placeholder="0.00" className={input} />
        </div>
        <div>
          <label className="block text-[11px] text-slate-500 uppercase mb-1">Invoice date</label>
          <input name="invoice_date" type="date" className={input} />
        </div>
        <div className="col-span-2 sm:col-span-1">
          <label className="block text-[11px] text-slate-500 uppercase mb-1">Invoice # or what for <span className="normal-case text-slate-400">(optional)</span></label>
          <input name="description" placeholder="e.g. Invoice 44598" className={input} />
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-[11px] text-slate-500 uppercase mb-1">Job <span className="normal-case text-slate-400">(optional)</span></label>
          <select name="project_id" defaultValue="" className={input}>
            <option value="">No job — supplier only</option>
            {jobs.map((j) => (
              <option key={j.id} value={j.id}>{j.label}</option>
            ))}
          </select>
          <div className="text-[11px] text-slate-500 mt-1">Leave blank for stock or tools. It still counts under the supplier, and you can link it to a job later.</div>
        </div>
        <div>
          <label className="block text-[11px] text-slate-500 uppercase mb-1">Invoice file <span className="normal-case text-slate-400">(optional)</span></label>
          {storageConfigured ? (
            <input name="invoice" type="file" accept=".pdf,image/*" className="block w-full text-xs text-slate-600 file:mr-2 file:rounded-md file:border file:border-slate-300 file:bg-white file:px-2 file:py-1 file:text-xs" />
          ) : (
            <div className="text-xs text-slate-400 py-1.5">File storage not set up yet.</div>
          )}
        </div>
      </div>
      <div className="flex justify-end gap-2">
        <button type="button" onClick={() => setOpen(false)} className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50">
          Cancel
        </button>
        <Button type="submit">Save invoice</Button>
      </div>
    </form>
  );
}
