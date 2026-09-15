"use client";

// Shared "Estimate Calculator" widget used on both the Job Request detail
// page and the Project detail page's costing section. Pure client-side
// math via lib/pricing.ts's computePricingBreakdown (same formulas/rate
// items already fetched server-side and passed in as props) — nothing
// here talks to the database except the optional save action.
import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { computePricingBreakdown } from "@/lib/pricing";
import { formatCurrencyPrecise } from "@/lib/calculations";
import type { MaterialRateItem, PricingFormula, PricingFormulaComponent } from "@/lib/types";
import { Button } from "./ui";

export function EstimateCalculator({
  formulas,
  components,
  materialRateItems,
  onSave,
  saveLabel,
  currentValue,
  currentValueLabel,
}: {
  formulas: PricingFormula[];
  components: PricingFormulaComponent[];
  materialRateItems: MaterialRateItem[];
  onSave?: (value: number) => Promise<void>;
  saveLabel?: string;
  currentValue?: number;
  currentValueLabel?: string;
}) {
  const router = useRouter();
  const [formulaId, setFormulaId] = useState(formulas[0]?.id ?? "");
  const [sqft, setSqft] = useState<string>("");
  const [isPending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);

  const formula = formulas.find((f) => f.id === formulaId);
  const breakdown = useMemo(() => {
    const totalSqft = Number(sqft);
    if (!formula || !totalSqft || totalSqft <= 0) return null;
    return computePricingBreakdown(formula, components, materialRateItems, totalSqft);
  }, [formula, sqft, components, materialRateItems]);

  if (formulas.length === 0) {
    return (
      <p className="text-sm text-slate-500">
        No pricing formulas set up yet — add one on the{" "}
        <Link href="/pricing" className="text-sky-600 hover:underline">Pricing</Link> page.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {currentValue != null && (
        <div className="text-xs text-slate-500">
          {currentValueLabel ?? "Current saved value"}: <span className="font-medium text-slate-700">{formatCurrencyPrecise(currentValue)}</span>
        </div>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <div>
          <label className="block text-[11px] text-slate-500 uppercase mb-1">Pricing Formula</label>
          <select
            value={formulaId}
            onChange={(e) => {
              setFormulaId(e.target.value);
              setSaved(false);
            }}
            className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
          >
            {formulas.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name} ({f.work_type})
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-[11px] text-slate-500 uppercase mb-1">Square Footage</label>
          <input
            type="number"
            min={0}
            step="1"
            value={sqft}
            onChange={(e) => {
              setSqft(e.target.value);
              setSaved(false);
            }}
            placeholder="e.g. 650"
            className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
          />
        </div>
      </div>

      {breakdown && (
        <div className="border border-slate-200 rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-slate-500 uppercase border-b border-slate-200 bg-slate-50">
                  <th className="px-3 py-2">Line Item</th>
                  <th className="px-3 py-2 text-right">Qty</th>
                  <th className="px-3 py-2 text-right">Unit Cost</th>
                  <th className="px-3 py-2 text-right">Line Total</th>
                </tr>
              </thead>
              <tbody>
                {breakdown.lineItems.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-3 py-3 text-slate-400 text-center">
                      This formula has no component line items yet.
                    </td>
                  </tr>
                )}
                {breakdown.lineItems.map((li) => (
                  <tr key={li.componentId} className="border-b border-slate-100 last:border-0">
                    <td className="px-3 py-1.5">{li.name}</td>
                    <td className="px-3 py-1.5 text-right whitespace-nowrap">{li.quantity} {li.unit}</td>
                    <td className="px-3 py-1.5 text-right whitespace-nowrap">{formatCurrencyPrecise(li.unitCost)}</td>
                    <td className="px-3 py-1.5 text-right whitespace-nowrap">{formatCurrencyPrecise(li.lineTotal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="p-3 text-sm space-y-1 bg-slate-50">
            <div className="flex justify-between"><span className="text-slate-500">Material Cost</span><span>{formatCurrencyPrecise(breakdown.materialCost)}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">Labor Cost ({formula?.labor_rate_per_sqft ?? 0}/sqft)</span><span>{formatCurrencyPrecise(breakdown.laborCost)}</span></div>
            <div className="flex justify-between font-medium border-t border-slate-200 pt-1"><span>Subtotal</span><span>{formatCurrencyPrecise(breakdown.subtotal)}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">Markup ({breakdown.markupPercent}%)</span><span>{formatCurrencyPrecise(breakdown.markupAmount)}</span></div>
            <div className="flex justify-between font-semibold text-emerald-700 border-t border-slate-200 pt-1"><span>Suggested Price</span><span>{formatCurrencyPrecise(breakdown.suggestedPrice)}</span></div>
          </div>
          {onSave && (
            <div className="p-3 border-t border-slate-200 flex items-center gap-2">
              <Button
                type="button"
                variant="secondary"
                disabled={isPending}
                onClick={() => {
                  startTransition(async () => {
                    await onSave(breakdown.suggestedPrice);
                    setSaved(true);
                    router.refresh();
                  });
                }}
              >
                {isPending ? "Saving…" : saveLabel ?? "Save Suggested Price"}
              </Button>
              {saved && <span className="text-xs text-emerald-600">Saved.</span>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
