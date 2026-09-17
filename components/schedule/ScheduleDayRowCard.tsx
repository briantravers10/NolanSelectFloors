import Link from "next/link";
import type { ScheduleJobRow } from "@/lib/schedule";
import { PhoneLink, EmailLink } from "@/components/ui";
import { QuickBooksDocumentList } from "@/components/quickbooks/QuickBooksDocumentList";
import {
  COI_CLASSES,
  COI_DISPLAY_LABELS,
  MATERIALS_CLASSES,
  MATERIALS_DISPLAY_LABELS,
  SCHEDULE_COLOR_BLOCK_CLASSES,
} from "./badges";

/**
 * VIEW SCHEDULE job block — read-only, per the client spec's hard split
 * between viewing and editing. No dropdowns, no inline selects, no
 * add/remove-crew controls. Every field is plain labeled text/badges, and
 * the schedule color tints the ENTIRE block's background, not a dot or a
 * select. The only interactive elements are navigation links (view the
 * project, jump to Create/Edit Schedule for this job/date, and the
 * tel:/mailto: contact links) — those aren't schedule-editing controls.
 */
export function ScheduleDayRowCard({ row }: { row: ScheduleJobRow }) {
  const blockClasses = SCHEDULE_COLOR_BLOCK_CLASSES[row.scheduleColor];

  return (
    <div className={`border-2 rounded-xl px-4 py-3 space-y-2 ${blockClasses}`}>
      {/* Header: building/unit + address + links */}
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-base font-semibold text-slate-900 leading-tight">
            {row.buildingName ?? "Unknown Building"}
            {row.unitNumber ? ` — Unit ${row.unitNumber}` : ""}
            {row.address && <span className="text-slate-600 font-normal text-sm"> · {row.address}</span>}
          </div>
          {row.carriedFrom && (
            <div className="text-[11px] text-slate-600 mt-0.5">
              Still open — carried over from {row.carriedFrom}. Set Schedule Type to Completed to take it off.
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0 text-xs">
          <Link href={`/projects/${row.projectId}`} className="text-sky-700 hover:underline font-medium">
            View Project →
          </Link>
          <Link
            href={`/schedule/edit?project=${row.projectId}&date=${row.date}`}
            className="rounded-md bg-white/80 border border-slate-300 px-2 py-1 font-medium text-slate-700 hover:bg-white"
          >
            Edit
          </Link>
        </div>
      </div>

      {/* Company · contact · crew on compact lines */}
      <div className="grid sm:grid-cols-2 gap-x-4 gap-y-1 text-sm">
        <div className="min-w-0">
          <span className="text-[10px] font-semibold text-slate-600 uppercase tracking-wide mr-1.5">Company</span>
          <span className="text-slate-900">{row.clientName ?? "—"}</span>
        </div>
        <div className="min-w-0 flex flex-wrap items-center gap-x-2">
          <span className="text-[10px] font-semibold text-slate-600 uppercase tracking-wide">Contact</span>
          <span className="text-slate-900">{row.contactName ?? "—"}</span>
          <PhoneLink phone={row.contactPhone} className="text-sm" />
          {row.contactEmail && <EmailLink email={row.contactEmail} className="text-sm" />}
        </div>
      </div>
      <div className="text-sm">
        <span className="text-[10px] font-semibold text-slate-600 uppercase tracking-wide mr-1.5">Crew — {row.crewCount}</span>
        <span className="text-slate-900">
          {row.crewCount > 0 ? row.crewNames.join(" / ") : <span className="text-slate-500">No crew assigned yet</span>}
        </span>
      </div>

      {/* Status badges */}
      <div className="flex flex-wrap gap-1.5">
        <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium ${
          row.coiStatus === "Approved" ? "bg-emerald-100 text-emerald-800 border-emerald-400" : COI_CLASSES[row.coiStatus]
        }`}>
          COI: {COI_DISPLAY_LABELS[row.coiStatus]}
        </span>
        <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium ${MATERIALS_CLASSES[row.materialsStatus]}`}>
          Materials: {MATERIALS_DISPLAY_LABELS[row.materialsStatus]}
        </span>
      </div>

      {/* Notes */}
      <div className="text-sm">
        <span className="text-[10px] font-semibold text-slate-600 uppercase tracking-wide mr-1.5">Notes</span>
        <span className="text-slate-900 whitespace-pre-wrap">{row.notes ? row.notes : <span className="text-slate-500">None.</span>}</span>
      </div>

      {/* Items to Order / Collect — read-only, only when non-empty */}
      {row.pickupItems.length > 0 && (
        <div className="text-sm">
          <span className="text-[10px] font-semibold text-slate-600 uppercase tracking-wide mr-1.5">Items to Collect</span>
          <span className="inline-flex flex-wrap gap-x-3 gap-y-0.5">
            {row.pickupItems.map((item) => (
              <span key={item.id} className={item.status === "Collected" ? "line-through text-slate-500" : "text-slate-900"}>
                {item.description}
                <span className={`ml-1 text-xs font-medium ${item.status === "Collected" ? "text-emerald-700" : "text-amber-700"}`}>
                  {item.status === "Collected" ? "✓" : "— needed"}
                </span>
              </span>
            ))}
          </span>
        </div>
      )}

      {/* QUICKBOOKS — read-only, inherited automatically via project_id.
          No settings/editing controls here; per the client's explicit
          instruction, only shown when there's something linked. */}
      {row.qbDocuments.length > 0 && (
        <div>
          <div className="text-[11px] font-semibold text-slate-600 uppercase tracking-wide mb-1">QuickBooks</div>
          <QuickBooksDocumentList documents={row.qbDocuments} compact />
        </div>
      )}
    </div>
  );
}
