import { Card, PageHeader, Button } from "@/components/ui";
import { MATERIAL_RATE_CATEGORIES } from "@/lib/types";
import { createMaterialRateItemAction } from "../../actions";

export default function NewMaterialRateItemPage() {
  return (
    <div className="max-w-xl">
      <PageHeader title="New Material Rate Item" subtitle="A reusable priced line item pricing formulas can reference." />
      <Card className="p-4">
        <form action={createMaterialRateItemAction} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-500 uppercase mb-1">Name</label>
            <input name="name" required placeholder="e.g. 3/4in Oak Hardwood" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-500 uppercase mb-1">Unit</label>
              <input name="unit" defaultValue="sqft" placeholder="sqft / linear ft / gallon / box / each" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 uppercase mb-1">Unit Cost ($)</label>
              <input name="unit_cost" type="number" step="0.01" min="0" required className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-500 uppercase mb-1">Category</label>
              <select name="category" defaultValue="Material" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
                {MATERIAL_RATE_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 uppercase mb-1">Supplier (optional)</label>
              <input name="supplier" placeholder="e.g. Metro Hardwood Supply" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 uppercase mb-1">Notes</label>
            <textarea name="notes" rows={3} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          </div>
          <Button type="submit">Create Material Rate Item</Button>
        </form>
      </Card>
    </div>
  );
}
