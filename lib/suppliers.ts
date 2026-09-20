// Supplier spend, built from the ONE spend record the app has: a
// project_materials line (a material added on a job, a priced schedule
// pickup, or an invoice filed from email). A line with project_id null is
// a supplier-only invoice — it counts under the supplier and in the
// company total, but in no job. Because every figure here comes from the
// same rows the job pages use, nothing is ever counted twice.
import type { ProjectMaterial } from "./types";
import { round2 } from "./calculations";

export const NO_SUPPLIER = "No supplier";

export interface SupplierRow {
  name: string;
  total: number;
  linked: number;
  unlinked: number;
  unlinkedCount: number;
  count: number;
  lastDate: string | null;
}

export function supplierKey(m: Pick<ProjectMaterial, "supplier">): string {
  return m.supplier?.trim() || NO_SUPPLIER;
}

export function materialDate(m: Pick<ProjectMaterial, "ordered_at" | "delivered_at" | "created_at">): string {
  return (m.ordered_at ?? m.delivered_at ?? m.created_at).slice(0, 10);
}

/** One row per supplier, biggest spend first. */
export function summarizeSuppliers(materials: ProjectMaterial[]): SupplierRow[] {
  const by = new Map<string, SupplierRow>();
  for (const m of materials) {
    const key = supplierKey(m);
    const row = by.get(key) ?? { name: key, total: 0, linked: 0, unlinked: 0, unlinkedCount: 0, count: 0, lastDate: null };
    row.total = round2(row.total + m.cost);
    row.count += 1;
    if (m.project_id) row.linked = round2(row.linked + m.cost);
    else {
      row.unlinked = round2(row.unlinked + m.cost);
      row.unlinkedCount += 1;
    }
    const d = materialDate(m);
    if (!row.lastDate || d > row.lastDate) row.lastDate = d;
    by.set(key, row);
  }
  return [...by.values()].sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));
}

export interface SupplierTotals {
  total: number;
  linked: number;
  unlinked: number;
  unlinkedCount: number;
  count: number;
}

export function totalSuppliers(rows: SupplierRow[]): SupplierTotals {
  return rows.reduce<SupplierTotals>(
    (t, r) => ({
      total: round2(t.total + r.total),
      linked: round2(t.linked + r.linked),
      unlinked: round2(t.unlinked + r.unlinked),
      unlinkedCount: t.unlinkedCount + r.unlinkedCount,
      count: t.count + r.count,
    }),
    { total: 0, linked: 0, unlinked: 0, unlinkedCount: 0, count: 0 }
  );
}

/** URL-safe supplier name for /suppliers/[name]. */
export function supplierSlug(name: string): string {
  return encodeURIComponent(name);
}
