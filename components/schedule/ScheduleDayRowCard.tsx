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
    <div className={`border-2 rounded-xl p-5 space-y-4 ${blockClasses}`}>
      {/* Header: building/unit + navigation links */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-lg font-semibold text-slate-900">
            {row.buildingName ?? "Unknown Building"}
            {row.unitNumber ? ` — Unit ${row.unitNumber}` : ""}
          </div>
          <div className="text-sm text-slate-700 mt-0.5">{row.address}</div>
        </div>
        <div className="flex items-center gap-3 shrink-0 text-sm">
          <Link href={`/projects/${row.projectId}`} className="text-sky-700 hover:underline font-medium">
            View Project →
          </Link>
          <Link
            href={`/schedule/edit?project=${row.projectId}&date=${row.date}`}
            className="rounded-lg bg-white/80 border border-slate-300 px-3 py-1.5 font-medium text-slate-700 hover:bg-white"
          >
            Edit This Entry
          </Link>
        </div>
      </div>

      {/* Management company / contact */}
      <div className="grid sm:grid-cols-2 gap-x-6 gap-y-3">
        <div>
          <div className="text-[11px] font-semibold text-slate-600 uppercase tracking-wide">Management Company</div>
          <div className="text-sm text-slate-900 mt-0.5">{row.clientName ?? "—"}</div>
        </div>
        <div>
          <div className="text-[11px] font-semibold text-slate-600 uppercase tracking-wide">Point of Contact</div>
          <div className="text-sm text-slate-900 mt-0.5">{row.contactName ?? "—"}</div>
          <div className="flex flex-wrap items-center gap-3 mt-0.5">
            <PhoneLink phone={row.contactPhone} className="text-sm" />
            {row.contactEmail && <EmailLink email={row.contactEmail} className="text-sm" />}
          </div>
        </div>
      </div>

      {/* Crew */}
      <div>
        <div className="text-[11px] font-semibold text-slate-600 uppercase tracking-wide">Crew — {row.crewCount}</div>
        <div className="text-sm text-slate-900 mt-0.5">
          {row.crewCount > 0 ? row.crewNames.join(" / ") : <span className="text-slate-500">No crew assigned yet</span>}
        </div>
      </div>

      {/* Status row: COI / Materials / Work type */}
      <div className="flex flex-wrap gap-2.5">
        <span className={`inline-flex items-center rounded-lg border px-3 py-1.5 text-sm font-medium ${
          row.coiStatus === "Approved" ? "bg-emerald-100 text-emerald-800 border-emerald-400" : COI_CLASSES[row.coiStatus]
        }`}>
          Certificate of Insurance: {COI_DISPLAY_LABELS[row.coiStatus]}
        </span>
        <span className={`inline-flex items-center rounded-lg border px-3 py-1.5 text-sm font-medium ${MATERIALS_CLASSES[row.materialsStatus]}`}>
          Materials: {MATERIALS_DISPLAY_LABELS[row.materialsStatus]}
        </span>
        <span className="inline-flex items-center rounded-lg border border-slate-300 bg-white/70 px-3 py-1.5 text-sm font-medium text-slate-800">
          Work Type: {row.workTypeName ?? "Not set"}
        </span>
      </div>

      {/* Notes — always visible, never collapsed */}
      <div>
        <div className="text-[11px] font-semibold text-slate-600 uppercase tracking-wide">Job Notes / Work Description</div>
        <div className="text-sm text-slate-900 mt-0.5 whitespace-pre-wrap">
          {row.notes ? row.notes : <span className="text-slate-500">No notes for this job/day.</span>}
        </div>
      </div>

      {/* Items to Order / Collect — read-only, only shown when non-empty.
          A lightweight supplementary list, deliberately small/quiet so it
          doesn't compete with the fields above; toggling status only
          happens from Create/Edit Schedule, per the View/Edit split. */}
      {row.pickupItems.length > 0 && (
        <div>
          <div className="text-[11px] font-semibold text-slate-600 uppercase tracking-wide">Items to Collect</div>
          <ul className="text-sm text-slate-800 mt-0.5 space-y-0.5">
            {row.pickupItems.map((item) => (
              <li key={item.id} className="flex items-center gap-1.5">
                <span className="text-slate-400">•</span>
                <span className={item.status === "Collected" ? "line-through text-slate-500" : ""}>{item.description}</span>
                <span
                  className={`text-xs font-medium ${
                    item.status === "Collected" ? "text-emerald-700" : "text-amber-700"
                  }`}
                >
                  {item.status === "Collected" ? "✓ Collected" : "— Needed"}
                </span>
              </li>
            ))}
          </ul>
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
