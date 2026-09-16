"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui";
import { TIME_OFF_TYPES } from "@/lib/types";
import type { TimeOffType } from "@/lib/types";
import { daysInYear } from "@/lib/time-off";

/**
 * Vacation & Sick Day Tracker — "+ Add Time Off" form with a live,
 * non-blocking allowance warning (per README "Vacation & Sick Day Tracker
 * — Annual Allowance"): as the office employee picks dates/type, this
 * shows "This would put NAME over their allowed X days (already used Y
 * of Z)" if the new entry would push year-to-date usage past the
 * employee's allowance. It never blocks the save — same "warn, don't
 * block" pattern used everywhere else in this app (double-booking, no
 * driver assigned, etc.). There's no email/push notification system yet,
 * so this inline warning (plus the standing badge on the Staff profile
 * and list) IS the notification for now.
 */
export function AddTimeOffForm({
  action,
  employeeFirstName,
  vacationUsed,
  vacationAllowed,
  sickUsed,
  sickAllowed,
}: {
  action: (formData: FormData) => void;
  employeeFirstName: string;
  vacationUsed: number;
  vacationAllowed: number | null;
  sickUsed: number;
  sickAllowed: number | null;
}) {
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [type, setType] = useState<TimeOffType>("Vacation");

  const warning = useMemo(() => {
    if (!startDate || (type !== "Vacation" && type !== "Sick")) return null;
    const allowed = type === "Vacation" ? vacationAllowed : sickAllowed;
    if (allowed == null) return null; // allowance not tracked for this employee — nothing to warn about
    const used = type === "Vacation" ? vacationUsed : sickUsed;
    const end = endDate || startDate;
    const year = new Date(startDate + "T00:00:00").getFullYear();
    const newDays = daysInYear(startDate, end, year);
    if (newDays <= 0) return null;
    const projected = used + newDays;
    if (projected > allowed) {
      return `⚠ This would put ${employeeFirstName} over their allowed ${type.toLowerCase()} days (already used ${used} of ${allowed})`;
    }
    return null;
  }, [startDate, endDate, type, vacationAllowed, sickAllowed, vacationUsed, sickUsed, employeeFirstName]);

  return (
    <form action={action} className="grid grid-cols-2 gap-2 mb-2 pb-4 border-b border-slate-200">
      <div>
        <label className="block text-[11px] text-slate-500 uppercase mb-1">Start Date</label>
        <input
          type="date"
          name="start_date"
          required
          value={startDate}
          onChange={(ev) => setStartDate(ev.target.value)}
          className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm"
        />
      </div>
      <div>
        <label className="block text-[11px] text-slate-500 uppercase mb-1">End Date</label>
        <input
          type="date"
          name="end_date"
          placeholder="Same as start"
          value={endDate}
          onChange={(ev) => setEndDate(ev.target.value)}
          className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm"
        />
      </div>
      <div>
        <label className="block text-[11px] text-slate-500 uppercase mb-1">Type</label>
        <select
          name="type"
          value={type}
          onChange={(ev) => setType(ev.target.value as TimeOffType)}
          className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm"
        >
          {TIME_OFF_TYPES.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-[11px] text-slate-500 uppercase mb-1">Notes (optional)</label>
        <input type="text" name="notes" className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm" />
      </div>
      {warning && (
        <div className="col-span-2 rounded-lg border border-amber-300 bg-amber-50 text-amber-900 text-xs px-2.5 py-2">
          {warning}. Saving is still allowed — there&apos;s no HR balance enforcement, just this heads-up.
        </div>
      )}
      <div className="col-span-2">
        <Button type="submit" variant="secondary" className="text-xs py-1.5 w-full justify-center">+ Add Time Off</Button>
      </div>
    </form>
  );
}
