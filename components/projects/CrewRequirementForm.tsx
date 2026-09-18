"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui";
import { STAFF_CAPABILITIES } from "@/lib/types";
import { employeeDisplayName } from "@/lib/employee-name";
import { addCrewRequirementAction } from "@/app/projects/actions";

export interface CrewPick {
  id: string;
  first_name: string;
  last_name: string;
  nickname?: string;
  capabilities: string[];
  dayRate: number | null; // null when the viewer can't see rates
}

/**
 * Estimating a job's labor: pick a role and how many, tick the actual
 * people you'd send (their day rates come along), say how many days, and
 * the estimate updates live: sum of chosen day rates × days.
 */
export function CrewRequirementForm({ projectId, employees, canViewRates }: { projectId: string; employees: CrewPick[]; canViewRates: boolean }) {
  const [role, setRole] = useState<string>(STAFF_CAPABILITIES[0]);
  const [qty, setQty] = useState(2);
  const [days, setDays] = useState(1);
  const [picked, setPicked] = useState<string[]>([]);
  const [showAll, setShowAll] = useState(false);

  const candidates = useMemo(() => {
    const withRole = employees.filter((e) => e.capabilities.includes(role));
    return showAll || withRole.length === 0 ? employees : withRole;
  }, [employees, role, showAll]);

  const pickedEmployees = picked.map((id) => employees.find((e) => e.id === id)).filter((e): e is CrewPick => Boolean(e));
  const perDay = pickedEmployees.reduce((s, e) => s + (e.dayRate ?? 0), 0);
  const total = perDay * (Number(days) || 0);

  function toggle(id: string) {
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : p.length < qty ? [...p, id] : p));
  }

  return (
    <form action={addCrewRequirementAction.bind(null, projectId)} className="space-y-3 mb-4 rounded-lg border border-slate-200 bg-slate-50 p-3">
      <div className="flex flex-wrap items-end gap-2">
        <div>
          <label className="block text-[11px] text-slate-500 uppercase mb-1">Role</label>
          <select name="role" value={role} onChange={(e) => { setRole(e.target.value); setPicked([]); }} className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm">
            {STAFF_CAPABILITIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-[11px] text-slate-500 uppercase mb-1">How many</label>
          <input name="quantity" type="number" min={1} value={qty} onChange={(e) => { const n = Math.max(1, Number(e.target.value) || 1); setQty(n); setPicked((p) => p.slice(0, n)); }} className="w-16 rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm" />
        </div>
        <div>
          <label className="block text-[11px] text-slate-500 uppercase mb-1">Days</label>
          <input name="estimated_days" type="number" min={0.5} step={0.5} value={days} onChange={(e) => setDays(Number(e.target.value) || 0)} className="w-20 rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm" />
        </div>
        <div>
          <label className="block text-[11px] text-slate-500 uppercase mb-1">Specific date (optional)</label>
          <input name="schedule_date" type="date" className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm" />
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-1">
          <div className="text-[11px] text-slate-500 uppercase">
            Pick up to {qty} {role}{qty === 1 ? "" : "s"} <span className="normal-case text-slate-400">({picked.length} picked)</span>
          </div>
          <label className="text-[11px] text-slate-500 flex items-center gap-1">
            <input type="checkbox" checked={showAll} onChange={(e) => setShowAll(e.target.checked)} className="rounded border-slate-300" /> show everyone
          </label>
        </div>
        {picked.map((id) => (
          <input key={id} type="hidden" name="employee_ids" value={id} />
        ))}
        <div className="max-h-44 overflow-y-auto rounded-lg border border-slate-200 bg-white divide-y divide-slate-100">
          {candidates.length === 0 && <div className="px-3 py-2 text-xs text-slate-500">No staff on file yet.</div>}
          {candidates.map((e) => {
            const on = picked.includes(e.id);
            const full = !on && picked.length >= qty;
            return (
              <label key={e.id} className={`flex items-center justify-between gap-2 px-3 py-1.5 text-sm ${full ? "opacity-50" : "hover:bg-slate-50 cursor-pointer"}`}>
                <span className="flex items-center gap-2">
                  <input type="checkbox" checked={on} disabled={full} onChange={() => toggle(e.id)} className="rounded border-slate-300" />
                  {employeeDisplayName(e)}
                </span>
                {canViewRates && <span className="text-xs text-slate-500 tabular-nums">{e.dayRate != null ? `$${e.dayRate.toFixed(2)}/day` : "no rate"}</span>}
              </label>
            );
          })}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        {canViewRates ? (
          <div className="text-sm text-slate-700">
            <span className="text-slate-500">Estimate:</span> ${perDay.toFixed(2)}/day × {days || 0} {days === 1 ? "day" : "days"} ={" "}
            <span className="font-semibold text-slate-900">${total.toFixed(2)}</span>
            {picked.length < qty && <span className="ml-2 text-xs text-amber-700">pick {qty - picked.length} more for a full estimate</span>}
          </div>
        ) : (
          <span />
        )}
        <Button type="submit">Add to estimate</Button>
      </div>
    </form>
  );
}
