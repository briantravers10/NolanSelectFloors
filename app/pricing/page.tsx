import Link from "next/link";
import { listMaterialRateItems, listPricingFormulaComponents, listPricingFormulas } from "@/lib/db";
import { Card, EmptyState, LinkButton, PageHeader, StatusBadge } from "@/components/ui";
import { formatCurrencyPrecise } from "@/lib/calculations";
import { WORK_TYPES } from "@/lib/types";
import { requireSectionAccess } from "@/lib/permissions";
import { AccessDenied } from "@/components/AccessDenied";

export default async function PricingPage() {
  const access = await requireSectionAccess("pricing");
  if (access === "none") return <AccessDenied section="Pricing" />;

  const [formulas, components, materialRateItems] = await Promise.all([
    listPricingFormulas(),
    listPricingFormulaComponents(),
    listMaterialRateItems(),
  ]);
  const itemById = new Map(materialRateItems.map((i) => [i.id, i]));
  const formulasByWorkType = WORK_TYPES.map((wt) => ({
    workType: wt,
    formulas: formulas.filter((f) => f.work_type === wt),
  })).filter((g) => g.formulas.length > 0);

  return (
    <div>
      <PageHeader
        title="Pricing"
        subtitle="Standardized formulas for pricing bids and estimates."
        action={
          <div className="flex gap-2">
            <LinkButton href="/pricing/materials/new" variant="secondary">+ New Material Rate Item</LinkButton>
            <LinkButton href="/pricing/formulas/new">+ New Formula</LinkButton>
          </div>
        }
      />

      {formulasByWorkType.length === 0 ? (
        <Card className="p-4 mb-6"><EmptyState message="No pricing formulas yet — add one to get started." /></Card>
      ) : (
        <div className="space-y-6 mb-8">
          {formulasByWorkType.map((group) => (
            <div key={group.workType}>
              <h2 className="text-sm font-semibold text-slate-900 uppercase tracking-wide mb-2">{group.workType}</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {group.formulas.map((f) => {
                  const formulaComponents = components.filter((c) => c.formula_id === f.id);
                  return (
                    <Link key={f.id} href={`/pricing/${f.id}`}>
                      <Card className="p-4 h-full hover:border-sky-300 transition-colors">
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <div className="font-medium text-slate-900">{f.name}</div>
                          {!f.active && <StatusBadge status="Cancelled" />}
                        </div>
                        <div className="text-xs text-slate-500 mb-3">
                          Labor {f.labor_rate_per_sqft != null ? `${formatCurrencyPrecise(f.labor_rate_per_sqft)}/sqft` : "—"} · Markup {f.markup_percent != null ? `${f.markup_percent}%` : "—"}
                        </div>
                        {formulaComponents.length === 0 ? (
                          <div className="text-xs text-slate-400">No component line items yet.</div>
                        ) : (
                          <ul className="text-xs text-slate-600 space-y-0.5">
                            {formulaComponents.map((c) => {
                              const item = itemById.get(c.material_rate_item_id);
                              return (
                                <li key={c.id}>
                                  {item?.name ?? "Unknown material"} — {c.quantity_per_unit_area} {item?.unit ?? "unit"}/sqft
                                </li>
                              );
                            })}
                          </ul>
                        )}
                      </Card>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      <h2 className="text-sm font-semibold text-slate-900 uppercase tracking-wide mb-2">Material Rate Items</h2>
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-slate-500 uppercase tracking-wide border-b border-slate-200">
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3">Supplier</th>
                <th className="px-4 py-3">Unit</th>
                <th className="px-4 py-3 text-right">Unit Cost</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {materialRateItems.length === 0 && (
                <tr><td colSpan={6}><EmptyState message="No material rate items yet." /></td></tr>
              )}
              {materialRateItems.map((item) => (
                <tr key={item.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                  <td className="px-4 py-3 text-slate-900">{item.name}</td>
                  <td className="px-4 py-3 text-slate-500">{item.category}</td>
                  <td className="px-4 py-3 text-slate-500">{item.supplier ?? "—"}</td>
                  <td className="px-4 py-3 text-slate-500">{item.unit}</td>
                  <td className="px-4 py-3 text-right">{formatCurrencyPrecise(item.unit_cost)}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${item.active ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-600"}`}>
                      {item.active ? "Active" : "Inactive"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
