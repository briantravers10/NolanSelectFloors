"use client";

import Link from "next/link";
import type { ScheduleJobRow } from "@/lib/schedule";
import { PhoneLink, EmailLink } from "@/components/ui";
import { formatJobNumber } from "@/lib/calculations";
import { QuickBooksDocumentList } from "@/components/quickbooks/QuickBooksDocumentList";
import { EditableNotes } from "./EditableNotes";
import { isWeekend } from "@/lib/dates";
import { notWorkingWeekendDayAction, workWeekendDayAction } from "@/app/schedule/actions";
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
  const off = Boolean(row.weekendOff);
  const cancelled = row.jobStatus === "Cancelled";
  const weekendOn = !off && isWeekend(row.date) && editableNotes;

  return (
    <div className={`border-2 rounded-xl px-3 py-2 ${off ? "border-dashed border-slate-300 bg-slate-100 opacity-60 grayscale" : cancelled ? "border-dashed border-rose-300 bg-rose-50" : blockClasses}`}>
      {row.isMeeting && !off && (
        <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2 rounded-md bg-amber-200/80 border border-amber-400 px-2 py-1 text-xs font-semibold text-amber-950">
          <span>📅 Meeting{row.meetingTime ? ` at ${row.meetingTime}` : ""}{row.jobStatus === "Complete" ? " — done" : ""}</span>
          <Link href={`/meetings?date=${row.date}`} className="font-medium underline decoration-dotted">All meetings that day</Link>
        </div>
      )}
      {cancelled && (
        <div className="mb-1.5 rounded-md bg-white/70 border border-rose-300 px-2 py-1 text-xs font-semibold text-rose-800">
          ❌ Cancelled for this day — crew freed up, no labor cost. Kept for history.
        </div>
      )}
      {off && (
        <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5 rounded-md bg-white/70 border border-slate-300 px-2 py-1">
          <span className="text-xs font-semibold text-slate-700">Weekend — not working. Carried from {row.carriedFrom}; picks up again Monday.</span>
          {editableNotes && (
            <form action={workWeekendDayAction.bind(null, row.projectId, row.date)}>
              <label className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-800 cursor-pointer">
                <input type="checkbox" onChange={(e) => e.currentTarget.form?.requestSubmit()} className="rounded border-slate-400" />
                Working this {new Date(row.date + "T00:00:00").toLocaleDateString("en-US", { weekday: "long" })}
              </label>
            </form>
          )}
        </div>
      )}
      {weekendOn && (
        <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5 rounded-md bg-white/70 border border-emerald-300 px-2 py-1">
          <span className="text-xs font-semibold text-emerald-800">Working this {new Date(row.date + "T00:00:00").toLocaleDateString("en-US", { weekday: "long" })} — crew and labor cost count for today.</span>
          <form action={notWorkingWeekendDayAction.bind(null, row.projectId, row.date)}>
            <button type="submit" className="text-xs text-slate-600 hover:text-rose-700 underline">Not working after all</button>
          </form>
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] gap-x-3 gap-y-1.5">
        {/* Left: who / where / crew / badges */}
        <div className="min-w-0 space-y-1">
          <div className="flex flex-nowrap items-start justify-between gap-x-2">
            <div className="min-w-0">
              <div className="text-[15px] font-semibold text-slate-900 leading-tight truncate">
                <span className="font-mono text-xs text-slate-500 font-normal">{formatJobNumber(row.project.job_number)}</span>{" "}
                {row.buildingName ?? "Unknown Building"}
                {row.unitNumber ? ` — Unit ${row.unitNumber}` : ""}
                {row.address && <span className="text-slate-600 font-normal text-xs"> · {row.address}</span>}
              </div>
              {row.carriedFrom && (
                <div className="text-[10px] text-slate-600">Still open — carried over from {row.carriedFrom}. Set Schedule Type to Completed to take it off.</div>
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0 text-xs">
              {row.hasOutboundInvoice && (
                <a
                  href={`/projects/${row.projectId}/invoice`}
                  target="_blank"
                  rel="noreferrer"
                  title="Open the invoice sent for this job"
                  className="rounded-md bg-emerald-50 border border-emerald-300 px-2 py-0.5 font-medium text-emerald-800 hover:bg-emerald-100"
                >
                  Invoice 📎
                </a>
              )}
              <Link href={`/projects/${row.projectId}`} className="text-sky-700 hover:underline font-medium">
                View Project →
              </Link>
              <Link
                href={`/schedule/edit?project=${row.projectId}&date=${row.date}`}
                scroll={false}
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
            {row.project.coi_file_reference ? (
              <a
                href={`/projects/${row.projectId}/coi`}
                target="_blank"
                rel="noreferrer"
                title={`Open the COI${row.project.coi_file_name ? ` (${row.project.coi_file_name})` : ""}`}
                className={`inline-flex items-center rounded-md border px-1.5 py-0.5 text-[11px] font-medium underline decoration-dotted hover:brightness-95 ${
                  row.coiStatus === "Approved" ? "bg-emerald-100 text-emerald-800 border-emerald-400" : COI_CLASSES[row.coiStatus]
                }`}
              >
                COI: {COI_DISPLAY_LABELS[row.coiStatus]} 📎
              </a>
            ) : (
              <span className={`inline-flex items-center rounded-md border px-1.5 py-0.5 text-[11px] font-medium ${
                row.coiStatus === "Approved" ? "bg-emerald-100 text-emerald-800 border-emerald-400" : COI_CLASSES[row.coiStatus]
              }`}>
                COI: {COI_DISPLAY_LABELS[row.coiStatus]}
              </span>
            )}
            <span className={`inline-flex items-center rounded-md border px-1.5 py-0.5 text-[11px] font-medium ${MATERIALS_CLASSES[row.materialsStatus]}`}>
              Materials: {MATERIALS_DISPLAY_LABELS[row.materialsStatus]}
            </span>
          </div>
          {row.pickupItems.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 rounded-md border border-yellow-400 bg-yellow-200 px-2 py-1">
              <span className="text-[10px] font-bold text-yellow-900 uppercase tracking-wide">Collect / Order</span>
              {row.pickupItems.map((item) => (
                <span
                  key={item.id}
                  className={`rounded px-1.5 py-0.5 text-[12px] font-medium ${item.status === "Collected" ? "bg-white/60 text-slate-500 line-through" : "bg-white text-yellow-950 border border-yellow-500"}`}
                >
                  {item.description}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Right: notes in their own box (editable in place on Create/Edit) */}
        {editableNotes && !off ? (
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
