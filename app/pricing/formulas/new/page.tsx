import { Card, PageHeader, Button } from "@/components/ui";
import { WORK_TYPES } from "@/lib/types";
import { createPricingFormulaAction } from "../../actions";

export default function NewPricingFormulaPage() {
  return (
    <div className="max-w-xl">
      <PageHeader title="New Pricing Formula" subtitle="Labor rate + markup for a work type — add component line items after creating it." />
      <Card className="p-4">
        <form action={createPricingFormulaAction} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-500 uppercase mb-1">Name</label>
            <input name="name" required placeholder="e.g. Standard Hardwood Installation" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 uppercase mb-1">Work Type</label>
            <select name="work_type" required className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
              <option value="">Select a work type…</option>
              {WORK_TYPES.map((wt) => <option key={wt} value={wt}>{wt}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-500 uppercase mb-1">Labor Rate ($/sqft)</label>
              <input name="labor_rate_per_sqft" type="number" step="0.01" min="0" placeholder="e.g. 4.50" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 uppercase mb-1">Markup (%)</label>
              <input name="markup_percent" type="number" step="0.1" min="0" placeholder="e.g. 25" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 uppercase mb-1">Notes</label>
            <textarea name="notes" rows={3} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          </div>
          <Button type="submit">Create Formula</Button>
        </form>
      </Card>
    </div>
  );
}
