"use client";

// Building picker for the New Job Request form. Once a building (and so a
// management company) is selected, fetches and shows the "last worked
// with" reminder (see lib/last-worked.ts) inline, without a page
// navigation — the rest of the form (description, contact, etc.) stays
// exactly as typed.
import { useEffect, useMemo, useState, useTransition } from "react";
import { getLastWorkedForBuildingAction } from "../actions";

export function BuildingSelectWithReminder({
  buildings,
  defaultBuildingId,
}: {
  buildings: { id: string; label: string }[];
  defaultBuildingId?: string;
}) {
  const initial = buildings.find((b) => b.id === defaultBuildingId);
  const [buildingId, setBuildingId] = useState(defaultBuildingId ?? "");
  const [query, setQuery] = useState(initial?.label ?? "");
  const [open, setOpen] = useState(false);
  const [reminder, setReminder] = useState<{ label: string; hasPrior: boolean } | null>(null);
  const [, startTransition] = useTransition();

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (q ? buildings.filter((b) => b.label.toLowerCase().includes(q)) : buildings).slice(0, 50);
  }, [buildings, query]);

  useEffect(() => {
    if (!buildingId) return;
    let cancelled = false;
    startTransition(async () => {
      const result = await getLastWorkedForBuildingAction(buildingId);
      if (!cancelled) setReminder(result ? { label: result.label, hasPrior: result.hasPrior } : null);
    });
    return () => {
      cancelled = true;
    };
  }, [buildingId]);

  function handleChange(nextBuildingId: string, label: string) {
    setBuildingId(nextBuildingId);
    setQuery(label);
    setOpen(false);
    if (!nextBuildingId) setReminder(null);
  }

  return (
    <div className="relative">
      <label className="block text-xs font-medium text-slate-500 uppercase mb-1">Building</label>
      <input type="hidden" name="building_id" value={buildingId} required />
      <input
        type="text"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setBuildingId("");
          setReminder(null);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder="Type to search buildings…"
        autoComplete="off"
        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
      />
      {open && (
        <div className="absolute z-20 mt-1 w-full max-h-56 overflow-auto rounded-lg border border-slate-200 bg-white shadow-lg">
          {matches.length === 0 ? (
            <div className="px-2.5 py-1.5 text-sm text-slate-400">No buildings match.</div>
          ) : (
            matches.map((b) => (
              <button
                key={b.id}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => handleChange(b.id, b.label)}
                className={`block w-full text-left px-2.5 py-1.5 text-sm hover:bg-sky-50 ${b.id === buildingId ? "bg-sky-50 font-medium" : ""}`}
              >
                {b.label}
              </button>
            ))
          )}
        </div>
      )}
      {reminder && (
        <p className={`mt-1.5 text-xs ${reminder.hasPrior ? "text-sky-700 font-medium" : "text-slate-400"}`}>
          {reminder.label}
        </p>
      )}
    </div>
  );
}
