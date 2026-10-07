import type { FinancialSummary } from "@/lib/financials";
import { Card } from "@/components/ui";
import { formatCurrency, formatPercent } from "@/lib/calculations";
import { EditEstimateValueButton } from "@/components/projects/EditEstimateValueButton";

/**
 * Financial Summary — Estimated/Contract Value, Invoiced, Paid,
 * Outstanding (from QuickBooks), Labor Cost (from lib/labor-cost.ts,
 * gated separately), Other Tracked Costs, Total Tracked Cost, Balance
 * (Estimate − Total Tracked Cost, always available), Gross Job Profit
 * (vs. actual INVOICED amount, QuickBooks only). Only computes/displays
 * the QuickBooks-derived fields when actually connected — otherwise
 * shows an honest "Not connected to QuickBooks" state rather than a
 * misleading "$0".
 */
export function FinancialSummaryCard({
  summary,
  canViewLaborCost,
  onEditEstimate,
}: {
  summary: FinancialSummary;
  canViewLaborCost: boolean;
  onEditEstimate?: (value: number) => Promise<void>;
}) {
  return (
    <Card className="p-4 space-y-3">
      <h2 className="text-sm font-semibold text-slate-900 uppercase tracking-wide">Financial Summary</h2>
      <div className="flex justify-between items-center text-sm">
        <span className="text-slate-500">Estimated / Contract Value</span>
        <div className="flex items-center gap-2">
          <span className="text-slate-800">{formatCurrency(summary.estimatedValue)}</span>
          {onEditEstimate && <EditEstimateValueButton action={onEditEstimate} currentValue={summary.estimatedValue} />}
        </div>
      </div>
      {summary.quickBooksConnected ? (
        <>
          <Row label={`Invoiced (${summary.invoiceCount} invoice${summary.invoiceCount === 1 ? "" : "s"})`} value={formatCurrency(summary.invoiced)} />
          <Row label="Paid" value={formatCurrency(summary.paid)} tone="good" />
          <Row label="Outstanding" value={formatCurrency(summary.outstanding)} tone={(summary.outstanding ?? 0) > 0 ? "bad" : "default"} />
        </>
      ) : (
        <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          Not connected to QuickBooks — Invoiced, Paid and Outstanding aren&apos;t available. See Settings → Integrations → QuickBooks.
        </div>
      )}
      {canViewLaborCost && <Row label="Labor Cost" value={formatCurrency(summary.laborCost)} />}
      {canViewLaborCost && <Row label="Other Tracked Costs" value={formatCurrency(summary.otherTrackedCost)} />}
      {canViewLaborCost && (
        <div className="border-t border-slate-200 pt-2">
          <Row label="Total Tracked Cost" value={formatCurrency(summary.totalTrackedCost)} bold />
        </div>
      )}
      {canViewLaborCost && (
        <div className="border-t border-slate-200 pt-2">
          <Row label="Balance (Estimate − Tracked Cost)" value={formatCurrency(summary.estimateBalance)} bold tone={summary.estimateBalance >= 0 ? "good" : "bad"} />
          <div className="flex justify-between text-sm mt-1">
            <span className="text-slate-500">Margin</span>
            <span className="font-semibold text-slate-800">{formatPercent(summary.estimateMarginPct)}</span>
          </div>
        </div>
      )}
      {canViewLaborCost && summary.quickBooksConnected && (
        <div className="border-t border-slate-200 pt-2">
          <Row label="Gross Job Profit" value={formatCurrency(summary.grossJobProfit)} bold tone={(summary.grossJobProfit ?? 0) >= 0 ? "good" : "bad"} />
          <div className="flex justify-between text-sm mt-1">
            <span className="text-slate-500">Gross Margin</span>
            <span className="font-semibold text-slate-800">{formatPercent(summary.grossMarginPct)}</span>
          </div>
        </div>
      )}
      <p className="text-[11px] text-slate-400 pt-1">
        Labor Cost and QuickBooks invoice amounts are separate figures, shown side by side — never computed from each other.
      </p>
    </Card>
  );
}

function Row({ label, value, bold, tone }: { label: string; value: string; bold?: boolean; tone?: "good" | "bad" | "default" }) {
  const toneClass = tone === "good" ? "text-emerald-600" : tone === "bad" ? "text-rose-600" : "text-slate-800";
  return (
    <div className="flex justify-between text-sm">
      <span className="text-slate-500">{label}</span>
      <span className={`${bold ? "font-semibold" : ""} ${toneClass}`}>{value}</span>
    </div>
  );
}
