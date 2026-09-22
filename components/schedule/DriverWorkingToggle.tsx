"use client";

import { setDriverWorkingAction } from "@/app/schedule/actions";

/** Tick box for the "Drivers Working Today" list — same instant-submit
 * pattern as AgendaDoneToggle. Marking a driver Working retrieves their
 * current day rate and adds them to that date's payroll without putting
 * them on any job's crew list; unchecking removes it. */
export function DriverWorkingToggle({ employeeId, date, working }: { employeeId: string; date: string; working: boolean }) {
  return (
    <form action={setDriverWorkingAction.bind(null, employeeId, date, !working)}>
      <label className="inline-flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={working}
          onChange={(ev) => ev.currentTarget.form?.requestSubmit()}
          className="rounded border-slate-400 w-4 h-4 cursor-pointer"
          title={working ? "Not working today after all" : "Mark working today"}
        />
        <span className="text-sm text-slate-800">Working</span>
      </label>
    </form>
  );
}
