"use client";

import { useMemo, useState } from "react";
import type { Employee } from "@/lib/types";

/**
 * Crew selection for the Create/Edit Schedule form. With 45+ employees,
 * scrolling a flat checkbox list to find someone is too slow — so this
 * adds a type-to-filter search box, and always shows who's currently
 * selected as removable chips regardless of what's typed, so the office
 * employee never loses sight of who they've already picked.
 */
export function CrewPicker({ employees, selectedEmployeeIds }: { employees: Employee[]; selectedEmployeeIds: string[] }) {
  const [query, setQuery] = useState("");
  const [checked, setChecked] = useState<Set<string>>(() => new Set(selectedEmployeeIds));

  const selected = useMemo(
    () => employees.filter((e) => checked.has(e.id)).sort((a, b) => a.first_name.localeCompare(b.first_name)),
    [employees, checked]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return employees;
    return employees.filter((e) => `${e.first_name} ${e.last_name}`.toLowerCase().includes(q));
  }, [employees, query]);

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
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {selected.map((e) => (
            <button
              key={e.id}
              type="button"
              onClick={() => toggle(e.id)}
              className="inline-flex items-center gap-1 rounded-full bg-sky-100 text-sky-800 border border-sky-300 px-2.5 py-1 text-xs font-medium hover:bg-sky-200"
              title="Remove from crew"
            >
              {e.first_name} {e.last_name}
              <span aria-hidden>×</span>
            </button>
          ))}
        </div>
      )}

      <input
        type="text"
        value={query}
        onChange={(ev) => setQuery(ev.target.value)}
        placeholder="Type a name to find someone…"
        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm mb-2"
      />

      <div className="border border-slate-300 rounded-lg divide-y divide-slate-100 max-h-64 overflow-y-auto">
        {employees.length === 0 ? (
          <div className="px-3 py-2.5 text-sm text-slate-500">No active employees.</div>
        ) : filtered.length === 0 ? (
          <div className="px-3 py-2.5 text-sm text-slate-500">No one matches &quot;{query}&quot;.</div>
        ) : (
          filtered.map((e) => (
            <label key={e.id} className="flex items-center gap-2.5 px-3 py-2 text-sm text-slate-800 hover:bg-slate-50 cursor-pointer">
              <input
                type="checkbox"
                name="employee_ids"
                value={e.id}
                checked={checked.has(e.id)}
                onChange={() => toggle(e.id)}
                className="rounded border-slate-300"
              />
              {e.first_name} {e.last_name}
            </label>
          ))
        )}
      </div>
      <p className="text-xs text-slate-500 mt-1">Search and check everyone assigned to this job on this date.</p>
    </div>
  );
}
