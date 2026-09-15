import { notFound } from "next/navigation";
import { listMaterialRateItems, listPricingFormulaComponents, listPricingFormulas } from "@/lib/db";
import { Card, PageHeader, Button, StatusBadge, EmptyState } from "@/components/ui";
import { EstimateCalculator } from "@/components/EstimateCalculator";
import { formatCurrencyPrecise } from "@/lib/calculations";
import { addFormulaComponentAction, removeFormulaComponentAction } from "../actions";

export default async function PricingFormulaDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [formulas, components, materialRateItems] = await Promise.all([
    listPricingFormulas(),
    listPricingFormulaComponents(),
    listMaterialRateItems(),
  ]);
  const formula = formulas.find((f) => f.id === id);
  if (!formula) notFound();
  const formulaComponents = components.filter((c) => c.formula_id === id);
  const itemById = new Map(materialRateItems.map((i) => [i.id, i]));
  const usedItemIds = new Set(formulaComponents.map((c) => c.material_rate_item_id));
  const availableItems = materialRateItems.filter((i) => i.active && !usedItemIds.has(i.id));

  return (
    <div className="max-w-4xl">
      <PageHeader
        title={formula.name}
        subtitle={`${formula.work_type} · Labor ${formula.labor_rate_per_sqft != null ? `${formatCurrencyPrecise(formula.labor_rate_per_sqft)}/sqft` : "—"} · Markup ${formula.markup_percent != null ? `${formula.markup_percent}%` : "—"}`}
        action={!formula.active ? <StatusBadge status="Cancelled" /> : undefined}
      />

      {formula.notes && <p className="text-sm text-slate-600 mb-5 italic">{formula.notes}</p>}

      <Card className="p-4 mb-5">
        <h2 className="text-sm font-semibold text-slate-900 uppercase tracking-wide mb-3">Component Line Items</h2>
        {formulaComponents.length === 0 ? (
          <EmptyState message="No component line items yet — add one below." />
        ) : (
          <div className="overflow-x-auto mb-4">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-slate-500 uppercase border-b border-slate-200">
                  <th className="py-1.5">Material</th>
                  <th className="py-1.5">Qty per sqft</th>
                  <th className="py-1.5">Unit Cost</th>
                  <th className="py-1.5">Notes</th>
                  <th className="py-1.5" />
                </tr>
              </thead>
              <tbody>
                {formulaComponents.map((c) => {
                  const item = itemById.get(c.material_rate_item_id);
                  return (
                    <tr key={c.id} className="border-b border-slate-100 last:border-0">
                      <td className="py-1.5">{item?.name ?? "Unknown material"} <span className="text-xs text-slate-400">({item?.unit})</span></td>
                      <td className="py-1.5">{c.quantity_per_unit_area}</td>
                      <td className="py-1.5">{item ? formatCurrencyPrecise(item.unit_cost) : "—"}</td>
                      <td className="py-1.5 text-slate-500">{c.notes ?? "—"}</td>
                      <td className="py-1.5 text-right">
                        <form action={removeFormulaComponentAction.bind(null, formula.id, c.id)}>
                          <button type="submit" className="text-xs text-rose-600 hover:underline">Remove</button>
                        </form>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <form action={addFormulaComponentAction.bind(null, formula.id)} className="flex flex-wrap gap-2 items-end border-t border-slate-100 pt-3">
          <div>
            <label className="block text-[11px] text-slate-500 uppercase mb-1">Material Rate Item</label>
            <select name="material_rate_item_id" required className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm min-w-[220px]">
              <option value="">Select…</option>
              {availableItems.map((i) => (
                <option key={i.id} value={i.id}>{i.name} ({i.unit} — {formatCurrencyPrecise(i.unit_cost)})</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[11px] text-slate-500 uppercase mb-1">Qty per sqft</label>
            <input name="quantity_per_unit_area" type="number" step="0.0001" min="0" defaultValue={1} required className="w-28 rounded-lg border border-slate-300 px-2 py-1.5 text-sm" />
          </div>
          <div>
            <label className="block text-[11px] text-slate-500 uppercase mb-1">Notes</label>
            <input name="notes" placeholder="e.g. 5% waste factor" className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm" />
          </div>
          <Button type="submit">Add Line Item</Button>
        </form>
      </Card>

      <Card className="p-4">
        <h2 className="text-sm font-semibold text-slate-900 uppercase tracking-wide mb-3">Preview Calculator</h2>
        <EstimateCalculator formulas={[formula]} components={formulaComponents} materialRateItems={materialRateItems} />
      </Card>
    </div>
  );
}
