// Financial Summary — combines existing PROJECT COSTING (lib/calculations.ts,
// build 1: labor + materials + other vs. contract value) with QuickBooks
// invoice/payment figures (lib/quickbooks.ts). Deliberately kept as a
// composition layer rather than folding into computeProjectCosting()
// itself, so the existing Costing card (which has nothing to do with
// QuickBooks and must keep working identically with zero QB connection)
// is never touched by this feature. See README "QuickBooks Online
// Integration — Financial Summary".
//
// LABOR COST ≠ CUSTOMER PRICE: `laborCost` here is the exact same
// actual-hours figure from lib/labor-cost.ts, gated by
// canViewLaborCost/canViewJobFinancials — NEVER derived from or compared
// directly against `invoiced`/`paid` as if they were the same kind of
// number. They're shown side by side, never computed from each other.
import type { Project, ProjectMaterial, QuickBooksDocument } from "./types";
import { computeProjectCosting, round2 } from "./calculations";
import { paidAmountForDocument } from "./quickbooks";

export interface FinancialSummary {
  quickBooksConnected: boolean;
  estimatedValue: number;
  invoiced: number | null;
  paid: number | null;
  outstanding: number | null;
  laborCost: number;
  otherTrackedCost: number; // materials + project.other_cost, per lib/calculations.ts
  totalTrackedCost: number;
  grossJobProfit: number | null;
  grossMarginPct: number | null;
  invoiceCount: number;
  estimateCount: number;
}

/**
 * Computes the Financial Summary for a project. `quickBooksConnected`
 * controls whether Invoiced/Paid/Outstanding/Gross Job Profit are
 * meaningful figures at all — when false, those come back `null` so the
 * UI can render an honest "Not connected to QuickBooks" state instead of a
 * misleading "$0" (per the client's explicit instruction).
 */
export function computeFinancialSummary(
  project: Pick<Project, "id" | "project_value" | "other_cost">,
  assignments: Parameters<typeof computeProjectCosting>[1],
  projectMaterials: ProjectMaterial[],
  qbDocuments: QuickBooksDocument[],
  quickBooksConnected: boolean
): FinancialSummary {
  const costing = computeProjectCosting(project, assignments, projectMaterials, project.id);
  const invoices = qbDocuments.filter((d) => d.entity_type === "Invoice");
  const estimates = qbDocuments.filter((d) => d.entity_type === "Estimate");
  const invoiced = quickBooksConnected ? round2(invoices.reduce((s, d) => s + d.amount, 0)) : null;
  const paid = quickBooksConnected ? round2(invoices.reduce((s, d) => s + paidAmountForDocument(d), 0)) : null;
  const outstanding = invoiced !== null && paid !== null ? round2(invoiced - paid) : null;
  const grossJobProfit = invoiced !== null ? round2(invoiced - costing.totalCost) : null;
  const grossMarginPct = invoiced !== null && invoiced > 0 && grossJobProfit !== null ? round2((grossJobProfit / invoiced) * 100) : null;

  return {
    quickBooksConnected,
    estimatedValue: costing.projectValue,
    invoiced,
    paid,
    outstanding,
    laborCost: costing.laborCost,
    otherTrackedCost: round2(costing.materialCost + costing.otherCost),
    totalTrackedCost: costing.totalCost,
    grossJobProfit,
    grossMarginPct,
    invoiceCount: invoices.length,
    estimateCount: estimates.length,
  };
}
