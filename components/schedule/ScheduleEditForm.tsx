"use client";

import { useState } from "react";
import type { Employee, ProjectScheduleDay, SchedulePickupItem } from "@/lib/types";
import { COI_STATUSES, SCHEDULE_COLORS, SCHEDULE_MATERIALS_STATUSES } from "@/lib/types";
import { Card, Button } from "@/components/ui";
import { addPickupItemAction, deletePickupItemAction, removeFromScheduleAction, saveScheduleEntryAction, togglePickupItemStatusAction } from "@/app/schedule/actions";
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
  selectedProjectId,
  selectedDay,
  selectedCrewEmployeeIds,
  timeOffEntries,
  pickupItems,
  selectedUnitNumber,
}: {
  date: string;
  jobOptions: { id: string; label: string }[];
  employees: Employee[];
  selectedProjectId?: string;
  selectedDay?: ProjectScheduleDay;
  selectedCrewEmployeeIds: string[];
  timeOffEntries: CrewTimeOffEntry[];
  pickupItems: SchedulePickupItem[];
  selectedUnitNumber?: string;
}) {
  const isEditing = Boolean(selectedProjectId);
  // Lifted so the Crew picker's "⚠ On Vacation" / "⚠ Out Sick" warning
  // (see CrewPicker.tsx) re-computes live as this date changes — every
  // other field below stays an uncontrolled `defaultValue` input, still
  // submitted natively by this same <form action=...>.
  const [scheduleDate, setScheduleDate] = useState(date);
  const [isMeeting, setIsMeeting] = useState(Boolean(selectedDay?.is_meeting));

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
        <Button type="submit" className="w-full justify-center">
          Save to Schedule
        </Button>
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
          {isEditing ? (
            <>
              {/* Locked while editing: everything below is saved onto THIS
                  job. A disabled select is not submitted, so the id rides
                  in a hidden input; the server also checks the two agree. */}
              <input type="hidden" name="project_id" value={selectedProjectId} />
              <input type="hidden" name="edit_project_id" value={selectedProjectId} />
              <select value={selectedProjectId} disabled aria-label="Job (locked while editing)" className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700">
                {jobOptions.map((j) => (
                  <option key={j.id} value={j.id}>
                    {j.label}
                  </option>
                ))}
              </select>
              <p className="text-xs text-slate-500 mt-1">To put a different job on this day, use &ldquo;+ New entry instead&rdquo; above the list.</p>
            </>
          ) : (
            <select name="project_id" defaultValue="" required className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm">
              <option value="" disabled>
                — Select a job —
              </option>
              {jobOptions.map((j) => (
                <option key={j.id} value={j.id}>
                  {j.label}
                </option>
              ))}
            </select>
          )}
        </div>

        {isEditing && (
          <div>
            <label className="block text-sm font-semibold text-slate-800 mb-1.5">Unit / Apt</label>
            <input
              name="unit_number"
              defaultValue={selectedUnitNumber ?? ""}
              placeholder="e.g. 4B — leave blank for whole building / common area"
              className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm"
            />
          </div>
        )}

        <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2.5">
          <label className="flex items-center gap-2 text-sm font-semibold text-amber-950 cursor-pointer">
            <input type="checkbox" name="is_meeting" value="1" checked={isMeeting} onChange={(ev) => setIsMeeting(ev.target.checked)} className="rounded border-amber-500" />
            This is a meeting, not a job
          </label>
          {isMeeting && (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <label className="text-xs font-medium text-amber-900">Time</label>
              <input type="time" name="meeting_time" defaultValue={selectedDay?.meeting_time ?? ""} className="rounded-lg border border-amber-300 bg-white px-2.5 py-1.5 text-sm" />
              <span className="text-[11px] text-amber-900">Shown Yellow on the schedule, listed under Meetings, and added to the agenda. Marking it complete later won&apos;t put it on &ldquo;invoices to send&rdquo;.</span>
            </div>
          )}
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
            <option value="Cancelled">❌ Cancelled — keep in history, remove crew &amp; labor cost</option>
          </select>
          <p className="text-xs text-slate-500 mt-1">A job stays on the schedule every day until it&apos;s marked Completed here. Cancelled keeps the entry but frees up its crew for the day.</p>
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

        {/* Work Type and Job Status were dropped from the form at the
            client's request (status lives in Schedule Type). Keep whatever
            work type an older entry had so saving doesn't clear it. */}
        {selectedDay?.work_type_id && <input type="hidden" name="work_type_id" value={selectedDay.work_type_id} />}

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

        <Button type="submit" className="w-full justify-center text-base py-3">
          Save to Schedule
        </Button>
      </form>

      {/* Outside the main form on purpose: these have their own Add /
          Mark Collected / Remove forms, and a form inside a form isn't
          allowed in HTML — the browser silently dropped the inner ones,
          which is why "Add" used to do nothing. */}
      <div className="mt-5 pt-4 border-t border-slate-200">
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

      </div>

      {isEditing && selectedProjectId && <RemoveFromSchedule projectId={selectedProjectId} date={scheduleDate} />}
    </Card>
  );
}

/**
 * Two-step remove, outside the main form so it can't be hit by accident
 * while saving. "This day" drops just this date's entry — note the job
 * will still carry over from an earlier day if it has one. "Every day"
 * clears all of the job's schedule entries; the project itself stays.
 */
function RemoveFromSchedule({ projectId, date }: { projectId: string; date: string }) {
  const [confirming, setConfirming] = useState(false);
  if (!confirming) {
    return (
      <div className="mt-4 pt-3 border-t border-slate-200 text-right">
        <button type="button" onClick={() => setConfirming(true)} className="text-xs text-rose-600 hover:text-rose-800 underline">
          Remove from schedule
        </button>
      </div>
    );
  }
  return (
    <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm">
      <p className="text-rose-900 font-medium mb-1">Remove this job from the schedule?</p>
      <p className="text-xs text-rose-800 mb-3">
        The project and its history are kept — this only clears schedule entries and crew. If the job was on the schedule on
        earlier days, &quot;this day&quot; alone won&apos;t stop it carrying over; use &quot;every day&quot; for that.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <form action={removeFromScheduleAction.bind(null, projectId, date, "day")}>
          <button type="submit" className="rounded-lg border border-rose-300 bg-white text-rose-700 px-3 py-1.5 text-xs font-medium hover:bg-rose-100">
            Remove this day only
          </button>
        </form>
        <form action={removeFromScheduleAction.bind(null, projectId, date, "all")}>
          <button type="submit" className="rounded-lg bg-rose-600 text-white px-3 py-1.5 text-xs font-medium hover:bg-rose-700">
            Remove from every day
          </button>
        </form>
        <button type="button" onClick={() => setConfirming(false)} className="text-xs text-slate-600 hover:text-slate-900">
          Cancel
        </button>
      </div>
    </div>
  );
}
