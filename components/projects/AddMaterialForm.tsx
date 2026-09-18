"use client";

import { useState } from "react";
import { Button } from "@/components/ui";
import { addProjectMaterialAction } from "@/app/projects/actions";

/**
 * Materials line: item, units, price per unit (total works itself out),
 * supplier (pick a previous one or type a new one), date ordered /
 * collected, optional invoice file. Suppliers you've used before appear
 * in the dropdown so spend can be tracked per supplier in Reports.
 */
export function AddMaterialForm({ projectId, suppliers, storageConfigured }: { projectId: string; suppliers: string[]; storageConfigured: boolean }) {
  const [qty, setQty] = useState("1");
  const [price, setPrice] = useState("");
  const total = (Number(qty) || 0) * (Number(price) || 0);
  const input = "rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm w-full";

  return (
    <form action={addProjectMaterialAction.bind(null, projectId)} className="mb-4 rounded-lg border border-slate-200 bg-slate-50 p-3 space-y-2">
      <div className="grid grid-cols-2 sm:grid-cols-[2fr_1fr_1fr_1fr] gap-2">
        <div className="col-span-2 sm:col-span-1">
          <label className="block text-[11px] text-slate-500 uppercase mb-1">Item</label>
          <input name="description" required placeholder="e.g. 5 gal Bostik glue" className={input} />
        </div>
        <div>
          <label className="block text-[11px] text-slate-500 uppercase mb-1">Units</label>
          <input name="quantity" type="number" step="0.01" min="0" value={qty} onChange={(e) => setQty(e.target.value)} className={input} />
        </div>
        <div>
          <label className="block text-[11px] text-slate-500 uppercase mb-1">Price / unit</label>
          <input name="unit_price" type="number" step="0.01" min="0" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="0.00" className={input} />
        </div>
        <div>
          <label className="block text-[11px] text-slate-500 uppercase mb-1">Total</label>
          <div className="rounded-lg border border-slate-200 bg-slate-100 px-2 py-1.5 text-sm tabular-nums text-slate-800">${total.toFixed(2)}</div>
        </div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        <div>
          <label className="block text-[11px] text-slate-500 uppercase mb-1">Supplier <span className="normal-case text-slate-400">(optional)</span></label>
          <input name="supplier" list="material-suppliers" autoComplete="off" placeholder="Pick or type" className={input} />
          <datalist id="material-suppliers">
            {suppliers.map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
        </div>
        <div>
          <label className="block text-[11px] text-slate-500 uppercase mb-1">Date ordered / collected <span className="normal-case text-slate-400">(optional)</span></label>
          <input name="ordered_on" type="date" className={input} />
        </div>
        <div className="col-span-2 sm:col-span-1">
          <label className="block text-[11px] text-slate-500 uppercase mb-1">Invoice / receipt <span className="normal-case text-slate-400">(optional)</span></label>
          {storageConfigured ? (
            <input name="invoice" type="file" accept=".pdf,image/*" className="block w-full text-xs text-slate-600 file:mr-2 file:rounded-md file:border file:border-slate-300 file:bg-white file:px-2 file:py-1 file:text-xs" />
          ) : (
            <div className="text-xs text-slate-400 py-1.5">File storage not set up yet.</div>
          )}
        </div>
      </div>
      <div className="flex justify-end">
        <Button type="submit">Add material</Button>
      </div>
    </form>
  );
}
