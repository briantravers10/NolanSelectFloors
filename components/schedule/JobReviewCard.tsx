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
 *   • Who worked + hours each, prefilled from the schedule's crew (8 hrs),
 *     with anyone extra addable. Saving writes actual_labor_entries — the
 *     real basis for labor cost. The estimate column is a quick guide:
 *     hourly = hours × rate, daily = daily rate × hours ÷ 8. Final costing
 *     (lib/labor-cost.ts) splits a daily rate across every job that person
 *     did that day, so the two can differ slightly when someone works two
 *     jobs in one day.
 */
type PayInfo = { pay_type: "daily" | "hourly"; daily_rate?: number; hourly_rate?: number };

function estimate(hours: number, pay?: PayInfo): number | null {
  if (!pay) return null;
  if (pay.pay_type === "hourly") return pay.hourly_rate ? Math.round(hours * pay.hourly_rate * 100) / 100 : null;
  return pay.daily_rate ? Math.round(((pay.daily_rate * hours) / 8) * 100) / 100 : null;
}

export function JobReviewCard({
  row,
  employees,
  entries,
  canViewCost,
}: {
  row: ScheduleJobRow;
  employees: Employee[];
  entries: ActualLaborEntry[]; // this project + date
  canViewCost: boolean;
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
  const [hours, setHours] = useState<Record<string, string>>(() => {
    const h: Record<string, string> = {};
    for (const id of initialIds) h[id] = String(entryByEmployee.get(id)?.hours ?? 8);
    return h;
  });
  const [addId, setAddId] = useState("");

  const isComplete = row.jobStatus === "Complete";
  const lines = ids.map((id) => {
    const emp = employeeById.get(id);
    const hrs = Number(hours[id] ?? 0) || 0;
    const est = emp ? estimate(hrs, emp) : null;
    return { id, emp, hrs, est };
  });
  const total = lines.reduce((s, l) => s + (l.est ?? 0), 0);
  const notListed = employees.filter((e) => !ids.includes(e.id));

  return (
    <div className={`border-2 rounded-xl px-3 py-2.5 ${isComplete ? "border-emerald-400 bg-emerald-50" : SCHEDULE_COLOR_BLOCK_CLASSES[row.scheduleColor]}`}>
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
            defaultValue={isComplete ? "Complete" : "In Progress"}
            onChange={(e) => e.currentTarget.form?.requestSubmit()}
            className={`rounded-lg border px-2 py-1 text-sm font-medium ${isComplete ? "border-emerald-400 bg-white text-emerald-800" : "border-slate-300 bg-white text-slate-800"}`}
          >
            <option value="In Progress">Still going — carries to next day</option>
            <option value="Complete">✅ Completed today — off the schedule</option>
          </select>
        </form>
      </div>

      <form action={saveJobHoursAction.bind(null, row.projectId, row.date)}>
        {ids.map((id) => (
          <input key={id} type="hidden" name="employee_ids" value={id} />
        ))}
        <table className="w-full text-sm">
          <thead>
            <tr className="text-[10px] font-semibold text-slate-600 uppercase tracking-wide">
              <th className="text-left py-0.5">Who worked</th>
              <th className="text-left py-0.5 w-24">Hours</th>
              {canViewCost && <th className="text-right py-0.5 w-28">Est. labor</th>}
              <th className="w-8" />
            </tr>
          </thead>
          <tbody>
            {lines.length === 0 && (
              <tr>
                <td colSpan={4} className="py-1 text-slate-500 text-xs">Nobody listed yet — add who worked below.</td>
              </tr>
            )}
            {lines.map((l) => (
              <tr key={l.id} className="border-t border-black/5">
                <td className="py-1 pr-2 text-slate-900">
                  {l.emp ? employeeDisplayName(l.emp) : l.id}
                  {entryByEmployee.has(l.id) && <span className="ml-1.5 text-[10px] text-emerald-700">logged</span>}
                </td>
                <td className="py-1">
                  <input
                    type="number"
                    name={`hours__${l.id}`}
                    step="0.25"
                    min="0"
                    value={hours[l.id] ?? ""}
                    onChange={(e) => setHours((h) => ({ ...h, [l.id]: e.target.value }))}
                    className="w-20 rounded-md border border-slate-300 bg-white px-2 py-1 text-sm"
                  />
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
                <td className="py-1 text-xs text-slate-600" colSpan={2}>Estimated labor for this job today</td>
                <td className="py-1 text-right font-semibold text-slate-900 tabular-nums">${total.toFixed(2)}</td>
                <td />
              </tr>
            </tfoot>
          )}
        </table>

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
    </div>
  );
}
