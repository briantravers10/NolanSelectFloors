"use client";

import { useMemo, useState } from "react";
import type { Employee, TimeOffType } from "@/lib/types";
import { isEmployeeOffOn, timeOffWarningLabel } from "@/lib/time-off";
import { employeeDisplayName, employeeSearchText } from "@/lib/employee-name";

/** The minimal shape CrewPicker needs from a TimeOffEntry — kept separate
 * from the full db type so this client component doesn't need to import
 * anything server-only. */
export interface CrewTimeOffEntry {
  employee_id: string;
  start_date: string;
  end_date: string;
  type: TimeOffType;
}

/**
 * Crew selection for the Create/Edit Schedule form. With 45+ employees,
 * scrolling a flat checkbox list to find someone is too slow — so this
 * adds a type-to-filter search box, and always shows who's currently
 * selected as removable chips regardless of what's typed, so the office
 * employee never loses sight of who they've already picked.
 *
 * If `date` + `timeOffEntries` are provided, anyone with a logged
 * Vacation/Sick/Personal/Unpaid entry covering that date gets a clear
 * "⚠ On Vacation" / "⚠ Out Sick" warning next to their name — same
 * "warn, don't block" philosophy as the existing double-booking warning
 * (see lib/calculations.ts findDoubleBookings + the Dashboard's Attention
 * Required list). The office employee can still check/keep them assigned.
 */
export function CrewPicker({
  employees,
  selectedEmployeeIds,
  date,
  timeOffEntries = [],
}: {
  employees: Employee[];
  selectedEmployeeIds: string[];
  date?: string;
  timeOffEntries?: CrewTimeOffEntry[];
}) {
  const [query, setQuery] = useState("");
  const [checked, setChecked] = useState<Set<string>>(() => new Set(selectedEmployeeIds));

  const selected = useMemo(
    () => employees.filter((e) => checked.has(e.id)).sort((a, b) => a.first_name.localeCompare(b.first_name)),
    [employees, checked]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return employees;
    return employees.filter((e) => employeeSearchText(e).includes(q));
  }, [employees, query]);

  function offWarning(employeeId: string): string | null {
    if (!date) return null;
    const entry = isEmployeeOffOn(timeOffEntries, employeeId, date);
    return entry ? timeOffWarningLabel(entry.type) : null;
  }

  function toggle(id: string) {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div>
      {/* What actually gets submitted: one hidden input per selected
          person, regardless of the search filter. The visible checkboxes
          are UI only — with a filter typed, the unfiltered ones aren't
          rendered, so relying on them dropped everyone you'd ticked before
          changing the search. */}
      {[...checked].map((id) => (
        <input key={id} type="hidden" name="employee_ids" value={id} />
      ))}
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {selected.map((e) => {
            const warning = offWarning(e.id);
            return (
              <button
                key={e.id}
                type="button"
                onClick={() => toggle(e.id)}
                className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium ${
                  warning ? "bg-amber-100 text-amber-900 border-amber-300 hover:bg-amber-200" : "bg-sky-100 text-sky-800 border-sky-300 hover:bg-sky-200"
                }`}
                title={warning ? `${warning} — remove from crew` : "Remove from crew"}
              >
                {employeeDisplayName(e)}
                {warning && <span className="font-semibold">{warning}</span>}
                <span aria-hidden>×</span>
              </button>
            );
          })}
        </div>
      )}

      <input
        type="text"
        value={query}
        onChange={(ev) => setQuery(ev.target.value)}
        placeholder="Type a name or nickname to find someone…"
        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm mb-2"
      />

      <div className="border border-slate-300 rounded-lg divide-y divide-slate-100 max-h-64 overflow-y-auto">
        {employees.length === 0 ? (
          <div className="px-3 py-2.5 text-sm text-slate-500">No active employees.</div>
        ) : filtered.length === 0 ? (
          <div className="px-3 py-2.5 text-sm text-slate-500">No one matches &quot;{query}&quot;.</div>
        ) : (
          filtered.map((e) => {
            const warning = offWarning(e.id);
            return (
              <label key={e.id} className="flex items-center gap-2.5 px-3 py-2 text-sm text-slate-800 hover:bg-slate-50 cursor-pointer">
                <input
                  type="checkbox"
                  value={e.id}
                  checked={checked.has(e.id)}
                  onChange={() => toggle(e.id)}
                  className="rounded border-slate-300"
                />
                {employeeDisplayName(e)}
                {warning && <span className="text-amber-700 font-semibold text-xs">{warning}</span>}
              </label>
            );
          })
        )}
      </div>
      <p className="text-xs text-slate-500 mt-1">Search and check everyone assigned to this job on this date.</p>
    </div>
  );
}
