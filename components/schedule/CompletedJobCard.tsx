"use client";

import { useState } from "react";
import type { CompletedJobSummary } from "@/lib/schedule";
import type { FinancialSummary } from "@/lib/financials";
import { Button, PhoneLink, StatusBadge } from "@/components/ui";
import { formatCurrency, formatJobNumber } from "@/lib/calculations";
import { formatDateShort } from "@/lib/dates";
import { saveCompletionNotesAction } from "@/app/schedule/actions";
import { QuickBooksDocumentList } from "@/components/quickbooks/QuickBooksDocumentList";
import { FinancialSummaryCard } from "@/components/quickbooks/FinancialSummaryCard";

export function CompletedJobCard({
  summary,
  financials,
  canViewLaborCost,
  canViewFinancials,
}: {
  summary: CompletedJobSummary;
  financials: FinancialSummary;
  canViewLaborCost: boolean;
  canViewFinancials: boolean;
}) {
  const [open, setOpen] = useState(false);
  const { project, building, client, contactName, contactPhone } = summary;

  return (
    <div className="border border-slate-200 rounded-xl bg-white overflow-hidden">
      <button type="button" onClick={() => setOpen((v) => !v)} className="w-full text-left px-4 py-3 flex flex-wrap items-center gap-3 hover:bg-slate-50">
        <div className="min-w-0 flex-1">
          <div className="font-medium text-sm text-slate-900 flex items-center gap-2">
            <span className="font-mono text-xs text-slate-500">{formatJobNumber(project.job_number)}</span>
            {building?.name}{project.unit_number ? ` — Unit ${project.unit_number}` : ""}
          </div>
          <div className="text-xs text-slate-500">{building?.address} · {client?.name}</div>
        </div>
        <div className="text-xs text-slate-500">{formatDateShort(summary.startDate)} – {formatDateShort(summary.completionDate)}</div>
        <div className="text-xs text-slate-500">{summary.totalDays} day{summary.totalDays === 1 ? "" : "s"} · {summary.totalCrew} crew · {summary.totalManHours} man-hrs</div>
        <StatusBadge status="Completed" />
      </button>

      {open && (
        <div className="border-t border-slate-100 px-4 py-4 space-y-4 bg-slate-50/60">
          <div className="grid sm:grid-cols-2 gap-4 text-sm">
            <div>
              <div className="text-[11px] font-medium text-slate-500 uppercase mb-1">Job Info</div>
              <div className="text-slate-800">{building?.name}{project.unit_number ? ` — Unit ${project.unit_number}` : ""}</div>
              <div className="text-slate-500">{building?.address}</div>
              <div className="text-slate-500">{client?.name}</div>
              {contactName && (
                <div className="text-slate-500 flex items-center gap-1.5 mt-1">
                  <span>{contactName}</span>
                  <PhoneLink phone={contactPhone} />
                </div>
              )}
            </div>
            <div>
              <div className="text-[11px] font-medium text-slate-500 uppercase mb-1">Timeline &amp; Status</div>
              <div className="text-slate-800">Start: {formatDateShort(summary.startDate)}</div>
              <div className="text-slate-800">Completed: {formatDateShort(summary.completionDate)}</div>
              <div className="text-slate-800">Total days worked: {summary.totalDays}</div>
              <div className="text-slate-500 mt-1">COI: {summary.coiStatus ?? "—"} · Materials: {summary.materialsStatus ?? "—"}</div>
            </div>
          </div>

          <div>
            <div className="text-[11px] font-medium text-slate-500 uppercase mb-1">Labor Cost by Employee</div>
            {summary.labor.length === 0 ? (
              <div className="text-sm text-slate-400">No crew recorded.</div>
            ) : (
              <div className="space-y-1">
                {summary.labor.map((l) => (
                  <div key={l.employee_id} className="flex items-center justify-between text-sm border-b border-slate-100 py-1">
                    <span className="text-slate-800">{l.employeeName}</span>
                    <span className="text-slate-500">
                      {l.daysWorked} day{l.daysWorked === 1 ? "" : "s"} · {l.totalHours} hrs
                      {l.source === "planned-fallback" ? " (from plan)" : ""}
                      {canViewLaborCost && l.laborCost !== undefined ? ` · ${formatCurrency(l.laborCost)}` : ""}
                    </span>
                  </div>
                ))}
              </div>
            )}
            <div className="text-sm font-medium text-slate-900 mt-2">
              Total: {summary.totalCrew} crew · {summary.totalManHours} man-hours
              {canViewLaborCost && ` · Total Labor Cost: ${formatCurrency(summary.totalLaborCost)}`}
            </div>
            {canViewLaborCost && (
              <div className="text-[11px] text-slate-400 mt-1">
                Rows marked &quot;from plan&quot; had no hours confirmed on End of Day Review, so their scheduled day-rate cost is used instead.
              </div>
            )}
          </div>

          <div>
            <div className="text-[11px] font-medium text-slate-500 uppercase mb-1">QuickBooks</div>
            <QuickBooksDocumentList documents={summary.qbDocuments} />
          </div>

          {canViewFinancials && <FinancialSummaryCard summary={financials} canViewLaborCost={canViewLaborCost} />}

          {summary.notes.length > 0 && (
            <div>
              <div className="text-[11px] font-medium text-slate-500 uppercase mb-1">Accumulated Notes</div>
              <ul className="text-sm text-slate-700 list-disc list-inside space-y-0.5">
                {summary.notes.map((n, i) => <li key={i}>{n}</li>)}
              </ul>
            </div>
          )}

          <form action={saveCompletionNotesAction.bind(null, project.id)} className="space-y-1">
            <div className="text-[11px] font-medium text-slate-500 uppercase">Completion Notes (editable)</div>
            <textarea
              name="completion_notes"
              rows={2}
              defaultValue={summary.completionNotes ?? ""}
              placeholder="Add a closing note about this job…"
              className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm"
            />
            <Button type="submit" variant="secondary" className="text-xs py-1">Save Completion Notes</Button>
          </form>
        </div>
      )}
    </div>
  );
}
