import { listBuildings, listProjects } from "@/lib/db";
import { isFileStorageConfigured } from "@/lib/storage";
import { Card, PageHeader, Button } from "@/components/ui";
import { INVOICE_STATUSES } from "@/lib/types";
import { createInvoiceAction } from "../actions";

export default async function NewInvoicePage() {
  const [projects, buildings] = await Promise.all([listProjects(), listBuildings()]);
  const buildingById = new Map(buildings.map((b) => [b.id, b]));
  const fileStorageConfigured = isFileStorageConfigured();

  return (
    <div className="max-w-xl">
      <PageHeader title="New Invoice" subtitle="Manual entry — the same form the office uses today for every supplier invoice." />
      <Card className="p-4">
        <form action={createInvoiceAction} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-500 uppercase mb-1">Supplier</label>
            <input name="supplier" required placeholder="e.g. Metro Hardwood Supply" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-500 uppercase mb-1">Amount ($)</label>
              <input name="amount" type="number" step="0.01" min="0" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 uppercase mb-1">Status</label>
              <select name="status" defaultValue="Needed" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
                {INVOICE_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-500 uppercase mb-1">Invoice Date</label>
              <input name="invoice_date" type="date" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 uppercase mb-1">Due Date</label>
              <input name="due_date" type="date" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 uppercase mb-1">Related Project (optional)</label>
            <select name="related_project_id" defaultValue="" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
              <option value="">None</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>{p.name} — {buildingById.get(p.building_id)?.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 uppercase mb-1">Related Building (optional)</label>
            <select name="related_building_id" defaultValue="" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
              <option value="">None</option>
              {buildings.map((b) => (
                <option key={b.id} value={b.id}>{b.name} — {b.address}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 uppercase mb-1">Notes</label>
            <textarea name="notes" rows={3} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 uppercase mb-1">Attach File (optional)</label>
            {!fileStorageConfigured && (
              <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-2">
                File storage isn&apos;t configured yet — the invoice will still be saved, just without a file attached (see README).
              </p>
            )}
            <input name="file" type="file" className="w-full text-sm" />
          </div>
          <Button type="submit">Create Invoice</Button>
        </form>
      </Card>
    </div>
  );
}
