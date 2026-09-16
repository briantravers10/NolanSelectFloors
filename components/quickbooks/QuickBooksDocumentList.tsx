import type { QuickBooksDocument } from "@/lib/types";
import { buildQuickBooksDeepLink } from "@/lib/quickbooks";
import { formatCurrencyPrecise } from "@/lib/calculations";

const STATUS_CLASSES: Record<string, string> = {
  Pending: "bg-amber-100 text-amber-700",
  Accepted: "bg-emerald-100 text-emerald-700",
  Closed: "bg-slate-200 text-slate-600",
  Rejected: "bg-rose-100 text-rose-700",
  Unsent: "bg-slate-200 text-slate-600",
  Open: "bg-sky-100 text-sky-700",
  "Partially Paid": "bg-amber-100 text-amber-700",
  Paid: "bg-emerald-100 text-emerald-700",
  Overdue: "bg-rose-100 text-rose-700",
  Voided: "bg-slate-200 text-slate-600",
};

/**
 * Read-only list of QuickBooks Estimates/Invoices linked to a job — used on
 * the Project page, View Schedule (read-only, inherited via project_id —
 * see lib/schedule.ts), and Completed Job Summary. Each document links out
 * via the best available QBO deep link (see lib/quickbooks.ts
 * buildQuickBooksDeepLink() and its research citation) — the document
 * NUMBER is always shown prominently alongside it regardless, since that
 * link format isn't part of Intuit's versioned/guaranteed API surface.
 */
export function QuickBooksDocumentList({ documents, compact = false }: { documents: QuickBooksDocument[]; compact?: boolean }) {
  if (documents.length === 0) {
    return <div className={`text-slate-500 ${compact ? "text-xs" : "text-sm"}`}>No QuickBooks documents linked to this job.</div>;
  }
  const estimates = documents.filter((d) => d.entity_type === "Estimate");
  const invoices = documents.filter((d) => d.entity_type === "Invoice");

  return (
    <div className={compact ? "space-y-1.5" : "space-y-3"}>
      {estimates.length > 0 && (
        <DocGroup title="Estimates" documents={estimates} compact={compact} />
      )}
      {invoices.length > 0 && (
        <DocGroup title="Invoices" documents={invoices} compact={compact} />
      )}
    </div>
  );
}

function DocGroup({ title, documents, compact }: { title: string; documents: QuickBooksDocument[]; compact: boolean }) {
  return (
    <div>
      {!compact && <div className="text-[11px] font-semibold text-slate-600 uppercase tracking-wide mb-1">{title}</div>}
      <div className="space-y-1">
        {documents.map((d) => (
          <a
            key={d.id}
            href={buildQuickBooksDeepLink(d.entity_type, d.qb_entity_id)}
            target="_blank"
            rel="noopener noreferrer"
            className={`flex items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 px-2.5 py-1.5 ${compact ? "text-xs" : "text-sm"}`}
            title="Opens QuickBooks Online — sign-in may be required. This link format isn't part of Intuit's guaranteed API surface; the document number above is the reliable identifier for manual lookup."
          >
            <span className="font-medium text-slate-900">
              {compact ? `${d.entity_type} ` : ""}
              {d.document_number ?? `#${d.qb_entity_id}`}
            </span>
            <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${STATUS_CLASSES[d.status] ?? "bg-slate-200 text-slate-600"}`}>{d.status}</span>
            <span className="text-slate-700 shrink-0">{formatCurrencyPrecise(d.amount)}</span>
          </a>
        ))}
      </div>
    </div>
  );
}
