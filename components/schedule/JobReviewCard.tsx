"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { ScheduleJobRow } from "@/lib/schedule";
import type { ActualLaborEntry, Employee } from "@/lib/types";
import { employeeDisplayName } from "@/lib/employee-name";
import { SCHEDULE_COLOR_BLOCK_CLASSES } from "./badges";
import { saveJobHoursAction, setReviewJobStatusAction } from "@/app/schedule/actions";

/**
 * END OF DAY REVIEW — one card per job on the day:
 *   • Status dropdown: still going / completed today (drives the schedule
 *     carry-over and the project's stage, same as Schedule Type).
 *   • Who worked + hours each, prefilled from the schedule's crew (8 hrs,
 *     or 8 split across their jobs when someone is double-booked), with
 *     anyone extra addable. Saving writes actual_labor_entries — the real
 *     basis for labor cost. The estimate column is a quick guide:
 *     hourly = hours × rate, daily = daily rate × hours ÷ 8, never more
 *     than one day rate. Final costing (lib/labor-cost.ts) splits a daily
 *     rate across every job that person did that day — a person is paid
 *     one day rate per day no matter how many jobs they were on; the hours
 *     here only decide how that cost is shared between the jobs.
 */
type PayInfo = { pay_type: "daily" | "hourly"; daily_rate?: number; hourly_rate?: number };

function estimate(hours: number, pay?: PayInfo): number | null {
  if (!pay) return null;
  if (pay.pay_type === "hourly") return pay.hourly_rate ? Math.round(hours * pay.hourly_rate * 100) / 100 : null;
  // Day-rate people never earn more than one day rate in a day.
  return pay.daily_rate ? Math.min(pay.daily_rate, Math.round(((pay.daily_rate * hours) / 8) * 100) / 100) : null;
}

export function JobReviewCard({
  row,
  employees,
  entries,
  canViewCost,
  jobsToday,
}: {
  row: ScheduleJobRow;
  employees: Employee[];
  entries: ActualLaborEntry[]; // this project + date
  canViewCost: boolean;
  /** How many jobs each person is on this day (across the whole schedule). */
  jobsToday?: Record<string, number>;
}) {
  const employeeById = useMemo(() => new Map(employees.map((e) => [e.id, e])), [employees]);
  const entryByEmployee = useMemo(() => new Map(entries.map((e) => [e.employee_id, e])), [entries]);

  // Initial roster: scheduled crew ∪ anyone with logged hours already.
  const initialIds = useMemo(() => {
    const ids = new Set<string>(row.crew.map((c) => c.employeeId));
    for (const e of entries) ids.add(e.employee_id);
    return [...ids];
  }, [row.crew, entries]);

  const [ids, setIds] = useState<string[]>(initialIds);
  const jobCount = (id: string) => Math.max(1, jobsToday?.[id] ?? 1);
  const [hours, setHours] = useState<Record<string, string>>(() => {
    const h: Record<string, string> = {};
    // Double-booked people start with their 8 hours split across their jobs
    // so the day rate is shared, not doubled.
    for (const id of initialIds) h[id] = String(entryByEmployee.get(id)?.hours ?? 8 / jobCount(id));
    return h;
  });
  const [addId, setAddId] = useState("");
  // Last-minute absences: marking someone sick / on vacation / unpaid
  // leave here logs the time off, takes them off this day's crew and
  // zeroes their hours — no need to go to the Staff page.
  const [absence, setAbsence] = useState<Record<string, string>>({});

  const isComplete = row.jobStatus === "Complete";
  const isCancelled = row.jobStatus === "Cancelled";
  const lines = ids.map((id) => {
    const emp = employeeById.get(id);
    const hrs = absence[id] ? 0 : Number(hours[id] ?? 0) || 0;
    const est = emp ? estimate(hrs, emp) : null;
    return { id, emp, hrs, est };
  });
  const total = lines.reduce((s, l) => s + (l.est ?? 0), 0);
  const notListed = employees.filter((e) => !ids.includes(e.id));
  const doubleBooked = lines.filter((l) => jobCount(l.id) > 1);

  return (
    <div className={`border-2 rounded-xl px-3 py-2.5 ${isCancelled ? "border-rose-300 bg-rose-50" : isComplete ? "border-emerald-400 bg-emerald-50" : SCHEDULE_COLOR_BLOCK_CLASSES[row.scheduleColor]}`}>
      <div className="flex flex-wrap items-start justify-between gap-2 mb-2">
        <div className="min-w-0">
          <div className="text-[15px] font-semibold text-slate-900 leading-tight">
            {row.buildingName ?? "Unknown Building"}
            {row.unitNumber ? ` — Unit ${row.unitNumber}` : ""}
            <Link href={`/projects/${row.projectId}`} className="ml-2 text-xs font-medium text-sky-700 hover:underline">
              View Project →
            </Link>
          </div>
          <div className="text-xs text-slate-600">{row.clientName ?? "—"}{row.notes ? ` · ${row.notes}` : ""}</div>
        </div>
        <form action={setReviewJobStatusAction.bind(null, row.projectId, row.date)} className="flex items-center gap-1.5">
          <label className="text-[10px] font-semibold text-slate-600 uppercase tracking-wide">Status</label>
          <select
            name="job_status"
            defaultValue={isCancelled ? "Cancelled" : isComplete ? "Complete" : "In Progress"}
            onChange={(e) => {
              if (e.currentTarget.value === "Cancelled" && !window.confirm("Cancel this job for today? Everyone assigned is taken off it and their labor cost for this job is removed. The job stays in history.")) {
                e.currentTarget.value = isComplete ? "Complete" : "In Progress";
                return;
              }
              e.currentTarget.form?.requestSubmit();
            }}
            className={`rounded-lg border px-2 py-1 text-sm font-medium ${isCancelled ? "border-rose-400 bg-white text-rose-800" : isComplete ? "border-emerald-400 bg-white text-emerald-800" : "border-slate-300 bg-white text-slate-800"}`}
          >
            <option value="In Progress">Still going — carries to next day</option>
            <option value="Complete">✅ Completed today — off the schedule</option>
            <option value="Cancelled">❌ Cancelled — crew freed up, no labor cost</option>
          </select>
        </form>
      </div>

      {isCancelled ? (
        <div className="rounded-md bg-white/70 border border-rose-200 px-2 py-1.5 text-xs text-rose-900">
          Cancelled for {row.date}. Anyone who was assigned has been taken off this job and no labor is costed to it.
          If they were sent to another job, add them there on the{" "}
          <Link href={`/schedule/edit?date=${row.date}`} className="font-medium underline">schedule</Link>; if they went home, leave them off.
          Switch the status back to Still going if it&apos;s on again.
        </div>
      ) : (
      <form action={saveJobHoursAction.bind(null, row.projectId, row.date)}>
        {ids.map((id) => (
          <input key={id} type="hidden" name="employee_ids" value={id} />
        ))}
        {row.crew.map((c) => (
          <input key={`s-${c.employeeId}`} type="hidden" name="scheduled_ids" value={c.employeeId} />
        ))}
        <table className="w-full text-sm">
          <thead>
            <tr className="text-[10px] font-semibold text-slate-600 uppercase tracking-wide">
              <th className="text-left py-0.5">Who worked</th>
              <th className="text-left py-0.5 w-24">Hours</th>
              <th className="text-left py-0.5 w-32">Absent?</th>
              {canViewCost && <th className="text-right py-0.5 w-28">Est. labor</th>}
              <th className="w-8" />
            </tr>
          </thead>
          <tbody>
            {lines.length === 0 && (
              <tr>
                <td colSpan={5} className="py-1 text-slate-500 text-xs">Nobody listed yet — add who worked below.</td>
              </tr>
            )}
            {lines.map((l) => (
              <tr key={l.id} className="border-t border-black/5">
                <td className="py-1 pr-2 text-slate-900">
                  {l.emp ? employeeDisplayName(l.emp) : l.id}
                  {entryByEmployee.has(l.id) && <span className="ml-1.5 text-[10px] text-emerald-700">logged</span>}
                  {jobCount(l.id) > 1 && (
                    <span className="ml-1.5 text-[10px] font-medium text-amber-700" title="Paid one day rate for the day; hours only split it between jobs">
                      on {jobCount(l.id)} jobs today
                    </span>
                  )}
                </td>
                <td className="py-1">
                  <input
                    type="number"
                    name={`hours__${l.id}`}
                    step="0.25"
                    min="0"
                    value={absence[l.id] ? "0" : hours[l.id] ?? ""}
                    disabled={Boolean(absence[l.id])}
                    onChange={(e) => setHours((h) => ({ ...h, [l.id]: e.target.value }))}
                    className="w-20 rounded-md border border-slate-300 bg-white px-2 py-1 text-sm disabled:bg-slate-100 disabled:text-slate-400"
                  />
                </td>
                <td className="py-1">
                  <select
                    name={`absence__${l.id}`}
                    value={absence[l.id] ?? ""}
                    onChange={(e) => setAbsence((a) => ({ ...a, [l.id]: e.target.value }))}
                    aria-label={`Absence for ${l.emp ? employeeDisplayName(l.emp) : l.id}`}
                    className={`rounded-md border px-1.5 py-1 text-xs ${absence[l.id] ? "border-rose-300 bg-rose-50 text-rose-900 font-medium" : "border-slate-300 bg-white text-slate-700"}`}
                  >
                    <option value="">Worked</option>
                    <option value="Sick">Sick</option>
                    <option value="Vacation">Vacation</option>
                    <option value="Unpaid">Unpaid leave</option>
                    <option value="Personal">Personal day</option>
                  </select>
                </td>
                {canViewCost && (
                  <td className="py-1 text-right text-slate-800 tabular-nums">{l.est === null ? <span className="text-slate-400">no rate</span> : `$${l.est.toFixed(2)}`}</td>
                )}
                <td className="py-1 text-right">
                  <button
                    type="button"
                    onClick={() => setIds((x) => x.filter((i) => i !== l.id))}
                    className="text-slate-400 hover:text-rose-600"
                    aria-label="Remove from this job"
                    title="Didn't work this job today"
                  >
                    ✕
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
          {canViewCost && lines.length > 0 && (
            <tfoot>
              <tr className="border-t border-black/10">
                <td className="py-1 text-xs text-slate-600" colSpan={3}>Estimated labor for this job today</td>
                <td className="py-1 text-right font-semibold text-slate-900 tabular-nums">${total.toFixed(2)}</td>
                <td />
              </tr>
            </tfoot>
          )}
        </table>
        {doubleBooked.length > 0 && (
          <p className="mt-1.5 text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded-md px-2 py-1">
            {doubleBooked.map((l) => (l.emp ? employeeDisplayName(l.emp) : l.id)).join(", ")} {doubleBooked.length === 1 ? "is" : "are"} on more than one job today.
            They&apos;re paid one day rate for the day no matter what — the hours here only decide how much of it this job carries.
          </p>
        )}

        <div className="mt-2 flex flex-wrap items-center gap-2">
          <select value={addId} onChange={(e) => setAddId(e.target.value)} className="rounded-md border border-slate-300 bg-white px-2 py-1 text-sm max-w-[240px]">
            <option value="">+ Add someone who worked…</option>
            {notListed.map((e) => (
              <option key={e.id} value={e.id}>{employeeDisplayName(e)}</option>
            ))}
          </select>
          <button
            type="button"
            disabled={!addId}
            onClick={() => {
              if (!addId) return;
              setIds((x) => [...x, addId]);
              setHours((h) => ({ ...h, [addId]: "8" }));
              setAddId("");
            }}
            className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs font-medium hover:bg-slate-50 disabled:opacity-50"
          >
            Add
          </button>
          <button type="submit" className="ml-auto rounded-lg bg-sky-600 text-white px-3 py-1.5 text-sm font-medium hover:bg-sky-700">
            Save hours
          </button>
        </div>
      </form>
      )}
    </div>
  );
}
