"use client";

import { useState } from "react";
import { Button } from "@/components/ui";
import { createQuickJobAction } from "@/app/schedule/actions";

/**
 * "Quick Job" — for the one-day turnarounds that don't need a job request,
 * a bid, or a full project write-up. Pick the building, add the unit and a
 * line of what's being done, and it becomes a project in "Scheduled" and
 * loads straight into the schedule form for crew/color.
 */
export function QuickJobForm({
  date,
  buildingOptions,
}: {
  date: string;
  buildingOptions: { id: string; label: string }[];
}) {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <Button type="button" onClick={() => setOpen(true)} className="whitespace-nowrap">
        + Quick Job
      </Button>
    );
  }

  return (
    <form action={createQuickJobAction} className="rounded-xl border border-sky-200 bg-sky-50 p-3 grid grid-cols-1 sm:grid-cols-[2fr_1fr_3fr_auto_auto] gap-2 items-end w-full">
      <input type="hidden" name="schedule_date" value={date} />
      <div>
        <label className="block text-[11px] font-semibold text-slate-600 uppercase mb-1">Building</label>
        <select name="building_id" required defaultValue="" className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-sm">
          <option value="" disabled>— Pick a building —</option>
          {buildingOptions.map((b) => (
            <option key={b.id} value={b.id}>{b.label}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-[11px] font-semibold text-slate-600 uppercase mb-1">Unit</label>
        <input name="unit_number" placeholder="e.g. 4B" className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-sm" />
      </div>
      <div>
        <label className="block text-[11px] font-semibold text-slate-600 uppercase mb-1">What&apos;s the job?</label>
        <input name="description" required placeholder="e.g. Sand & refinish living room" className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-sm" />
      </div>
      <Button type="submit">Create &amp; Schedule</Button>
      <button type="button" onClick={() => setOpen(false)} className="text-sm text-slate-500 hover:text-slate-800 px-2 py-2">
        Cancel
      </button>
    </form>
  );
}
