"use client";

import { useState } from "react";
import type { Employee, ProjectScheduleDay, SchedulePickupItem, WorkTypeRecord } from "@/lib/types";
import { COI_STATUSES, SCHEDULE_COLORS, SCHEDULE_JOB_STATUSES, SCHEDULE_MATERIALS_STATUSES } from "@/lib/types";
import { Card, Button } from "@/components/ui";
import { addPickupItemAction, deletePickupItemAction, saveScheduleEntryAction, togglePickupItemStatusAction } from "@/app/schedule/actions";
import { SCHEDULE_COLOR_FORM_LABELS } from "./badges";
import { CrewPicker, type CrewTimeOffEntry } from "./CrewPicker";

/**
 * The one place every schedule control lives, per the client spec: a
 * simple, large, single-column form — not a dense multi-column layout —
 * ending in one SAVE TO SCHEDULE button. Loading an existing entry (via
 * the picker on the Create/Edit page) pre-fills this same form; saving
 * updates the same underlying project_schedule_days/schedule_assignments
 * records in place (see saveScheduleEntryAction) rather than creating a
 * parallel/duplicate schedule record.
 */
export function ScheduleEditForm({
  date,
  jobOptions,
  employees,
  workTypes,
  selectedProjectId,
  selectedDay,
  selectedCrewEmployeeIds,
  timeOffEntries,
  pickupItems,
}: {
  date: string;
  jobOptions: { id: string; label: string }[];
  employees: Employee[];
  workTypes: WorkTypeRecord[];
  selectedProjectId?: string;
  selectedDay?: ProjectScheduleDay;
  selectedCrewEmployeeIds: string[];
  timeOffEntries: CrewTimeOffEntry[];
  pickupItems: SchedulePickupItem[];
}) {
  const isEditing = Boolean(selectedProjectId);
  // Lifted so the Crew picker's "⚠ On Vacation" / "⚠ Out Sick" warning
  // (see CrewPicker.tsx) re-computes live as this date changes — every
  // other field below stays an uncontrolled `defaultValue` input, still
  // submitted natively by this same <form action=...>.
  const [scheduleDate, setScheduleDate] = useState(date);

  return (
    <Card className="p-5">
      <h2 className="text-sm font-semibold text-slate-900 uppercase tracking-wide mb-1">
        {isEditing ? "Edit This Schedule Entry" : "Create a New Schedule Entry"}
      </h2>
      <p className="text-sm text-slate-500 mb-5">
        {isEditing
          ? "Loaded from the existing entry — change anything below and save."
          : "Pick a job and date, fill in the fields below, and save to add it to the schedule."}
      </p>

      <form action={saveScheduleEntryAction} className="space-y-5">
        <div>
          <label className="block text-sm font-semibold text-slate-800 mb-1.5">Date</label>
          <input
            type="date"
            name="schedule_date"
            value={scheduleDate}
            onChange={(ev) => setScheduleDate(ev.target.value)}
            required
            className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-slate-800 mb-1.5">Job</label>
          <select name="project_id" defaultValue={selectedProjectId ?? ""} required className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm">
            <option value="" disabled>
              — Select a job —
            </option>
            {jobOptions.map((j) => (
              <option key={j.id} value={j.id}>
                {j.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-semibold text-slate-800 mb-1.5">Schedule Type</label>
          <select
            name="schedule_color"
            defaultValue={selectedDay?.schedule_color ?? "Pink"}
            className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm"
          >
            {SCHEDULE_COLORS.map((c) => (
              <option key={c} value={c}>
                {SCHEDULE_COLOR_FORM_LABELS[c]}
              </option>
            ))}
            <option value="Complete">✅ Completed — job done, take it off the schedule</option>
          </select>
          <p className="text-xs text-slate-500 mt-1">A job stays on the schedule every day until it&apos;s marked Completed here.</p>
        </div>

        <div>
          <label className="block text-sm font-semibold text-slate-800 mb-1.5">Crew</label>
          <CrewPicker
            employees={employees}
            selectedEmployeeIds={selectedCrewEmployeeIds}
            date={scheduleDate}
            timeOffEntries={timeOffEntries}
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-slate-800 mb-1.5">Certificate of Insurance</label>
          <select
            name="coi_status"
            defaultValue={selectedDay?.coi_status ?? "Not Sent"}
            className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm"
          >
            {COI_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-semibold text-slate-800 mb-1.5">Materials</label>
          <select
            name="materials_status"
            defaultValue={selectedDay?.materials_status ?? "Not Ordered"}
            className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm"
          >
            {SCHEDULE_MATERIALS_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-semibold text-slate-800 mb-1.5">Work Type</label>
          <select
            name="work_type_id"
            defaultValue={selectedDay?.work_type_id ?? ""}
            className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm"
          >
            <option value="">— Not set —</option>
            {workTypes.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-semibold text-slate-800 mb-1.5">Job Status</label>
          <select
            name="job_status"
            defaultValue={selectedDay?.job_status ?? "Scheduled"}
            className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm"
          >
            {SCHEDULE_JOB_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <p className="text-xs text-slate-500 mt-1">Also updates the project&apos;s pipeline stage — same as before.</p>
        </div>

        <div>
          <label className="block text-sm font-semibold text-slate-800 mb-1.5">Job Notes</label>
          <textarea
            name="notes"
            rows={5}
            defaultValue={selectedDay?.notes ?? ""}
            placeholder="Work description / notes for this job on this day…"
            className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-slate-800 mb-1.5">Items to Order / Collect</label>
          <p className="text-xs text-slate-500 mb-2">
            Quick pickups for this specific job/day — e.g. &quot;3 buckets of glue&quot; or &quot;pick up dumpster key from super&quot;.
            Not the full Materials system — added/marked collected right away, separate from the Save button below.
          </p>
          {selectedProjectId ? (
            <>
              {pickupItems.length > 0 && (
                <ul className="space-y-1.5 mb-2">
                  {pickupItems.map((item) => (
                    <li key={item.id} className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
                      <span className={`flex-1 ${item.status === "Collected" ? "line-through text-slate-500" : "text-slate-800"}`}>
                        {item.description}
                      </span>
                      <form action={togglePickupItemStatusAction.bind(null, item.id, selectedProjectId)}>
                        <button
                          type="submit"
                          className={`text-xs font-medium rounded-full px-2.5 py-1 border whitespace-nowrap ${
                            item.status === "Collected"
                              ? "bg-emerald-100 text-emerald-800 border-emerald-300 hover:bg-emerald-200"
                              : "bg-amber-100 text-amber-800 border-amber-300 hover:bg-amber-200"
                          }`}
                        >
                          {item.status === "Collected" ? "✓ Collected" : "Mark Collected"}
                        </button>
                      </form>
                      <form action={deletePickupItemAction.bind(null, item.id, selectedProjectId)}>
                        <button type="submit" className="text-xs text-red-600 hover:underline whitespace-nowrap">
                          Remove
                        </button>
                      </form>
                    </li>
                  ))}
                </ul>
              )}
              <form action={addPickupItemAction.bind(null, selectedProjectId, scheduleDate)} className="flex gap-2">
                <input
                  type="text"
                  name="description"
                  placeholder='e.g. "3 buckets of glue"'
                  className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
                <Button type="submit" variant="secondary" className="text-sm py-2 px-4 shrink-0">
                  Add
                </Button>
              </form>
            </>
          ) : (
            <>
              <div className="flex gap-2 opacity-50 pointer-events-none">
                <input
                  type="text"
                  disabled
                  placeholder='e.g. "3 buckets of glue"'
                  className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
                <Button type="button" variant="secondary" disabled className="text-sm py-2 px-4 shrink-0">
                  Add
                </Button>
              </div>
              <p className="text-xs text-slate-500 mt-1">Select a job above and save this entry first, then reopen it here to add items.</p>
            </>
          )}
        </div>

        <Button type="submit" className="w-full justify-center text-base py-3">
          Save to Schedule
        </Button>
      </form>
    </Card>
  );
}
