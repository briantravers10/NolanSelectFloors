import Link from "next/link";
import type { ScheduleJobRow } from "@/lib/schedule";
import { PhoneLink, EmailLink } from "@/components/ui";
import { QuickBooksDocumentList } from "@/components/quickbooks/QuickBooksDocumentList";
import { EditableNotes } from "./EditableNotes";
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
export function ScheduleDayRowCard({ row, editableNotes = false }: { row: ScheduleJobRow; editableNotes?: boolean }) {
  const blockClasses = SCHEDULE_COLOR_BLOCK_CLASSES[row.scheduleColor];

  return (
    <div className={`border-2 rounded-xl px-3 py-2 ${blockClasses}`}>
      <div className="grid grid-cols-1 md:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] gap-x-3 gap-y-1.5">
        {/* Left: who / where / crew / badges */}
        <div className="min-w-0 space-y-1">
          <div className="flex flex-nowrap items-start justify-between gap-x-2">
            <div className="min-w-0">
              <div className="text-[15px] font-semibold text-slate-900 leading-tight truncate">
                {row.buildingName ?? "Unknown Building"}
                {row.unitNumber ? ` — Unit ${row.unitNumber}` : ""}
                {row.address && <span className="text-slate-600 font-normal text-xs"> · {row.address}</span>}
              </div>
              {row.carriedFrom && (
                <div className="text-[10px] text-slate-600">Still open — carried over from {row.carriedFrom}. Set Schedule Type to Completed to take it off.</div>
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0 text-xs">
              <Link href={`/projects/${row.projectId}`} className="text-sky-700 hover:underline font-medium">
                View Project →
              </Link>
              <Link
                href={`/schedule/edit?project=${row.projectId}&date=${row.date}`}
                className="rounded-md bg-white/80 border border-slate-300 px-2 py-0.5 font-medium text-slate-700 hover:bg-white"
              >
                Edit
              </Link>
            </div>
          </div>

          <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-[13px]">
            <div className="min-w-0">
              <span className="text-[10px] font-semibold text-slate-600 uppercase tracking-wide mr-1">Company</span>
              <span className="text-slate-900">{row.clientName ?? "—"}</span>
            </div>
            <div className="min-w-0 flex flex-wrap items-center gap-x-1.5">
              <span className="text-[10px] font-semibold text-slate-600 uppercase tracking-wide">Contact</span>
              <span className="text-slate-900">{row.contactName ?? "—"}</span>
              <PhoneLink phone={row.contactPhone} className="text-[13px]" />
              {row.contactEmail && <EmailLink email={row.contactEmail} className="text-[13px]" />}
            </div>
          </div>

          <div className="text-[13px]">
            <span className="text-[10px] font-semibold text-slate-600 uppercase tracking-wide mr-1">Crew — {row.crewCount}</span>
            <span className="text-slate-900">
              {row.crewCount > 0 ? row.crewNames.join(" / ") : <span className="text-slate-500">No crew assigned yet</span>}
            </span>
          </div>

          <div className="flex flex-wrap gap-1.5 items-center">
            <span className={`inline-flex items-center rounded-md border px-1.5 py-0.5 text-[11px] font-medium ${
              row.coiStatus === "Approved" ? "bg-emerald-100 text-emerald-800 border-emerald-400" : COI_CLASSES[row.coiStatus]
            }`}>
              COI: {COI_DISPLAY_LABELS[row.coiStatus]}
            </span>
            <span className={`inline-flex items-center rounded-md border px-1.5 py-0.5 text-[11px] font-medium ${MATERIALS_CLASSES[row.materialsStatus]}`}>
              Materials: {MATERIALS_DISPLAY_LABELS[row.materialsStatus]}
            </span>
            {row.pickupItems.length > 0 && (
              <span className="text-[11px] text-slate-800">
                <span className="text-[10px] font-semibold text-slate-600 uppercase tracking-wide mr-1">Collect</span>
                {row.pickupItems.map((item, i) => (
                  <span key={item.id} className={item.status === "Collected" ? "line-through text-slate-500" : ""}>
                    {i > 0 && ", "}
                    {item.description}
                  </span>
                ))}
              </span>
            )}
          </div>
        </div>

        {/* Right: notes in their own box (editable in place on Create/Edit) */}
        {editableNotes ? (
          <EditableNotes projectId={row.projectId} date={row.date} notes={row.notes} />
        ) : (
          <div className="rounded-lg border border-slate-300 bg-white/60 px-2.5 py-1.5 min-h-[3rem]">
            <div className="text-[10px] font-semibold text-slate-600 uppercase tracking-wide">Notes</div>
            <div className="text-[13px] text-slate-900 whitespace-pre-wrap leading-snug">
              {row.notes ? row.notes : <span className="text-slate-500">None.</span>}
            </div>
          </div>
        )}
      </div>

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
