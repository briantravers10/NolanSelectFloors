"use client";

import { useRef } from "react";
import { SECTION_ACCESS_LEVELS, SECTION_KEYS, SECTION_LABELS, type SectionAccessLevel } from "@/lib/types";

const LEVEL_LABEL: Record<SectionAccessLevel, string> = { none: "No Access", view: "View", edit: "Full Edit" };

/**
 * One None/View/Edit <select> per SECTION_KEYS, named `section__<key>` —
 * used by the "+ Add Staff Account" form (app/company-setup/staff-access
 * /page.tsx) to set the initial grid at creation time. The per-account
 * edit page (./[id]/page.tsx) uses its own per-row form instead, since
 * each row there saves independently via its own server action.
 *
 * A "Set all sections to" row lets the Owner/Admin apply one level across
 * every section in one click (e.g. "Full Edit" for a trusted office
 * manager) instead of clicking through each of them — the individual
 * selects stay uncontrolled native form fields (submitted normally as
 * part of the surrounding form), this just writes to all of them via refs.
 */
export function StaffAccessGridFields({ current }: { current?: Partial<Record<string, SectionAccessLevel>> }) {
  const selectRefs = useRef<Partial<Record<string, HTMLSelectElement | null>>>({});

  function setAll(level: SectionAccessLevel) {
    for (const key of SECTION_KEYS) {
      const el = selectRefs.current[key];
      if (el) el.value = level;
    }
  }

  return (
    <div>
      <div className="flex items-center gap-2 mb-2 text-xs">
        <span className="text-slate-500">Set all sections to:</span>
        {SECTION_ACCESS_LEVELS.map((level) => (
          <button
            key={level}
            type="button"
            onClick={() => setAll(level)}
            className="rounded-full border border-slate-300 px-2.5 py-1 font-medium text-slate-600 hover:bg-slate-100"
          >
            {LEVEL_LABEL[level]}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
        {SECTION_KEYS.map((key) => (
          <div key={key} className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 px-3 py-2">
            <span className="text-sm text-slate-700">{SECTION_LABELS[key]}</span>
            <select
              name={`section__${key}`}
              defaultValue={current?.[key] ?? "none"}
              ref={(el) => {
                selectRefs.current[key] = el;
              }}
              className="rounded-md border border-slate-300 px-2 py-1 text-xs"
            >
              {SECTION_ACCESS_LEVELS.map((level) => (
                <option key={level} value={level}>
                  {LEVEL_LABEL[level]}
                </option>
              ))}
            </select>
          </div>
        ))}
      </div>
    </div>
  );
}
