"use client";

import { useState, useTransition } from "react";
import { SECTION_ACCESS_LEVELS, SECTION_LABELS, type SectionAccessLevel, type SectionKey } from "@/lib/types";
import { updateSectionPermissionAction } from "../actions";

const LEVEL_LABEL: Record<SectionAccessLevel, string> = { none: "No Access", view: "View", edit: "Full Edit" };

/**
 * Per-section access row with an explicit Save button (was auto-submit on
 * change) — with nothing visible to confirm a save happened, a change
 * could look like it silently did nothing even when it did, or get missed
 * entirely. Now the picker is a normal controlled dropdown: picking a new
 * level shows a Save button until you click it, then a brief "Saved"
 * confirmation.
 */
export function SectionAccessRow({ officeUserId, sectionKey, level }: { officeUserId: string; sectionKey: SectionKey; level: SectionAccessLevel }) {
  const [value, setValue] = useState<SectionAccessLevel>(level);
  const [savedValue, setSavedValue] = useState<SectionAccessLevel>(level);
  const [justSaved, setJustSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  const dirty = value !== savedValue;

  function save() {
    const toSave = value;
    const fd = new FormData();
    fd.set("access_level", toSave);
    startTransition(async () => {
      await updateSectionPermissionAction(officeUserId, sectionKey, fd);
      setSavedValue(toSave);
      setJustSaved(true);
      setTimeout(() => setJustSaved(false), 2000);
    });
  }

  return (
    <div className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 px-3 py-2">
      <span className="text-sm text-slate-700">{SECTION_LABELS[sectionKey]}</span>
      <div className="flex items-center gap-2">
        <select
          value={value}
          onChange={(e) => setValue(e.target.value as SectionAccessLevel)}
          className={`rounded-md border px-2 py-1 text-xs font-medium ${
            value === "edit" ? "border-emerald-300 bg-emerald-50 text-emerald-700" : value === "view" ? "border-amber-300 bg-amber-50 text-amber-700" : "border-slate-300 bg-slate-50 text-slate-500"
          }`}
        >
          {SECTION_ACCESS_LEVELS.map((l) => (
            <option key={l} value={l}>
              {LEVEL_LABEL[l]}
            </option>
          ))}
        </select>
        {dirty ? (
          <button
            type="button"
            onClick={save}
            disabled={pending}
            className="rounded-md bg-sky-600 text-white px-2.5 py-1 text-xs font-medium hover:bg-sky-700 disabled:opacity-60 whitespace-nowrap"
          >
            {pending ? "Saving…" : "Save"}
          </button>
        ) : justSaved ? (
          <span className="text-xs text-emerald-600 font-medium whitespace-nowrap">Saved ✓</span>
        ) : null}
      </div>
    </div>
  );
}
