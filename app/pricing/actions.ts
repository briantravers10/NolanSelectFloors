"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import {
  addPricingFormulaComponent,
  createMaterialRateItem,
  createPricingFormula,
  removePricingFormulaComponent,
} from "@/lib/db";
import type { MaterialRateCategory, WorkType } from "@/lib/types";
import { canEdit } from "@/lib/permissions";

export async function createMaterialRateItemAction(formData: FormData) {
  if (!(await canEdit("pricing"))) return;
  const name = String(formData.get("name") ?? "").trim();
  const unit = String(formData.get("unit") ?? "sqft").trim() || "sqft";
  const unit_cost = Number(formData.get("unit_cost") ?? 0);
  const supplier = String(formData.get("supplier") ?? "").trim() || undefined;
  const category = String(formData.get("category") ?? "Material") as MaterialRateCategory;
  const notes = String(formData.get("notes") ?? "").trim() || undefined;
  if (!name) return;
  await createMaterialRateItem({ name, unit, unit_cost, supplier, category, notes });
  revalidatePath("/pricing");
  redirect("/pricing");
}

export async function createPricingFormulaAction(formData: FormData) {
  if (!(await canEdit("pricing"))) return;
  const name = String(formData.get("name") ?? "").trim();
  const work_type = String(formData.get("work_type") ?? "") as WorkType;
  const laborRateRaw = String(formData.get("labor_rate_per_sqft") ?? "").trim();
  const markupRaw = String(formData.get("markup_percent") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim() || undefined;
  if (!name || !work_type) return;
  const formula = await createPricingFormula({
    name,
    work_type,
    labor_rate_per_sqft: laborRateRaw ? Number(laborRateRaw) : undefined,
    markup_percent: markupRaw ? Number(markupRaw) : undefined,
    notes,
  });
  revalidatePath("/pricing");
  redirect(`/pricing/${formula.id}`);
}

export async function addFormulaComponentAction(formulaId: string, formData: FormData) {
  if (!(await canEdit("pricing"))) return;
  const material_rate_item_id = String(formData.get("material_rate_item_id") ?? "");
  const quantity_per_unit_area = Number(formData.get("quantity_per_unit_area") ?? 1);
  const notes = String(formData.get("notes") ?? "").trim() || undefined;
  if (!material_rate_item_id) return;
  await addPricingFormulaComponent({ formula_id: formulaId, material_rate_item_id, quantity_per_unit_area, notes });
  revalidatePath(`/pricing/${formulaId}`);
  revalidatePath("/pricing");
}

export async function removeFormulaComponentAction(formulaId: string, componentId: string) {
  if (!(await canEdit("pricing"))) return;
  await removePricingFormulaComponent(componentId);
  revalidatePath(`/pricing/${formulaId}`);
  revalidatePath("/pricing");
}
