// Pricing & estimating formula calculation logic — the single reusable
// function every "Estimate Calculator" UI (Job Request detail, Project
// detail, /pricing formula preview) calls. Pure function over plain
// arrays, same convention as lib/calculations.ts, so it behaves
// identically whether the rows came from Supabase or the seed store.
import type { MaterialRateItem, PricingFormula, PricingFormulaComponent } from "./types";
import { round2 } from "./calculations";

export interface PricingLineItem {
  componentId: string;
  materialRateItemId: string;
  name: string;
  unit: string;
  unitCost: number;
  quantityPerUnitArea: number;
  quantity: number;
  lineTotal: number;
}

export interface PricingBreakdown {
  formula: PricingFormula;
  totalSqft: number;
  lineItems: PricingLineItem[];
  materialCost: number;
  laborCost: number;
  subtotal: number;
  markupPercent: number;
  markupAmount: number;
  suggestedPrice: number;
}

/**
 * Computes a full itemized pricing breakdown for a pricing formula applied
 * to a given square footage:
 *   - for each component: quantity = quantity_per_unit_area * totalSqft,
 *     line cost = quantity * material_rate_item.unit_cost
 *   - materialCost = sum of all component line costs
 *   - laborCost = labor_rate_per_sqft * totalSqft
 *   - subtotal = materialCost + laborCost
 *   - suggestedPrice = subtotal * (1 + markup_percent / 100)
 */
export function computePricingBreakdown(
  formula: PricingFormula,
  components: PricingFormulaComponent[],
  materialRateItems: MaterialRateItem[],
  totalSqft: number
): PricingBreakdown {
  const sqft = Number.isFinite(totalSqft) && totalSqft > 0 ? totalSqft : 0;
  const itemById = new Map(materialRateItems.map((i) => [i.id, i]));

  const lineItems: PricingLineItem[] = components
    .filter((c) => c.formula_id === formula.id)
    .map((c) => {
      const item = itemById.get(c.material_rate_item_id);
      const quantity = round2(c.quantity_per_unit_area * sqft);
      const unitCost = item?.unit_cost ?? 0;
      return {
        componentId: c.id,
        materialRateItemId: c.material_rate_item_id,
        name: item?.name ?? "Unknown material",
        unit: item?.unit ?? "unit",
        unitCost,
        quantityPerUnitArea: c.quantity_per_unit_area,
        quantity,
        lineTotal: round2(quantity * unitCost),
      };
    });

  const materialCost = round2(lineItems.reduce((sum, li) => sum + li.lineTotal, 0));
  const laborRate = formula.labor_rate_per_sqft ?? 0;
  const laborCost = round2(laborRate * sqft);
  const subtotal = round2(materialCost + laborCost);
  const markupPercent = formula.markup_percent ?? 0;
  const suggestedPrice = round2(subtotal * (1 + markupPercent / 100));
  const markupAmount = round2(suggestedPrice - subtotal);

  return {
    formula,
    totalSqft: sqft,
    lineItems,
    materialCost,
    laborCost,
    subtotal,
    markupPercent,
    markupAmount,
    suggestedPrice,
  };
}
