"use client";

import { useState } from "react";
import type { Employee, ProjectScheduleDay, WorkTypeRecord } from "@/lib/types";
import { COI_STATUSES, SCHEDULE_COLORS, SCHEDULE_JOB_STATUSES, SCHEDULE_MATERIALS_STATUSES } from "@/lib/types";
import { Card, Button } from "@/components/ui";
import { saveScheduleEntryAction } from "@/app/schedule/actions";
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
}: {
  date: string;
  jobOptions: { id: string; label: string }[];
  employees: Employee[];
  workTypes: WorkTypeRecord[];
  selectedProjectId?: string;
  selectedDay?: ProjectScheduleDay;
  selectedCrewEmployeeIds: string[];
  timeOffEntries: CrewTimeOffEntry[];
}) {
  const isEditing = Boolean(selectedProjectId);
  // Lifted so the Crew picker's "⚠ On Vacation" / "⚠ Out Sick" warning
  // (see CrewPicker.tsx) re-computes live as this date changes — every
  // other field below stays an uncontrolled `defaultValue` input, still
  // submitted natively by this same <form action=...>.
  const [scheduleDate, setScheduleDate] = useState(date);

  return (
    <Card className="p-6">
      <h2 className="text-sm font-semibold text-slate-900 uppercase tracking-wide mb-1">
        {isEditing ? "Edit This Schedule Entry" : "Create a New Schedule Entry"}
      </h2>
      <p className="text-sm text-slate-500 mb-5">
        {isEditing
          ? "Loaded from the existing entry — change anything below and save."
          : "Pick a job and date, fill in the fields below, and save to add it to the schedule."}
      </p>

      <form action={saveScheduleEntryAction} className="space-y-6 max-w-xl">
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
          </select>
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

        <Button type="submit" className="w-full justify-center text-base py-3">
          Save to Schedule
        </Button>
      </form>
    </Card>
  );
}
