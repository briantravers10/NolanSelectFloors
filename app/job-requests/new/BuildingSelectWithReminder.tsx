"use client";

// Building picker for the New Job Request form. Once a building (and so a
// management company) is selected, fetches and shows the "last worked
// with" reminder (see lib/last-worked.ts) inline, without a page
// navigation — the rest of the form (description, contact, etc.) stays
// exactly as typed.
import { useEffect, useState, useTransition } from "react";
import { getLastWorkedForBuildingAction } from "../actions";

export function BuildingSelectWithReminder({
  buildings,
  defaultBuildingId,
}: {
  buildings: { id: string; label: string }[];
  defaultBuildingId?: string;
}) {
  const [buildingId, setBuildingId] = useState(defaultBuildingId ?? "");
  const [reminder, setReminder] = useState<{ label: string; hasPrior: boolean } | null>(null);
  const [, startTransition] = useTransition();

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

  function handleChange(nextBuildingId: string) {
    setBuildingId(nextBuildingId);
    if (!nextBuildingId) setReminder(null);
  }

  return (
    <div>
      <label className="block text-xs font-medium text-slate-500 uppercase mb-1">Building</label>
      <select
        name="building_id"
        value={buildingId}
        onChange={(e) => handleChange(e.target.value)}
        required
        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
      >
        <option value="">Select a building…</option>
        {buildings.map((b) => (
          <option key={b.id} value={b.id}>
            {b.label}
          </option>
        ))}
      </select>
      {reminder && (
        <p className={`mt-1.5 text-xs ${reminder.hasPrior ? "text-sky-700 font-medium" : "text-slate-400"}`}>
          {reminder.label}
        </p>
      )}
    </div>
  );
}
