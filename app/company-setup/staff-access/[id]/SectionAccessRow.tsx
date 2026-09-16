"use client";

import { useRef } from "react";
import { SECTION_ACCESS_LEVELS, SECTION_LABELS, type SectionAccessLevel, type SectionKey } from "@/lib/types";
import { updateSectionPermissionAction } from "../actions";

const LEVEL_LABEL: Record<SectionAccessLevel, string> = { none: "No Access", view: "View", edit: "Full Edit" };

/** Auto-submitting per-section access row — same pattern as
 * components/ActingUserSelector.tsx's hidden-form auto-submit. */
export function SectionAccessRow({ officeUserId, sectionKey, level }: { officeUserId: string; sectionKey: SectionKey; level: SectionAccessLevel }) {
  const formRef = useRef<HTMLFormElement>(null);
  const action = updateSectionPermissionAction.bind(null, officeUserId, sectionKey);
  return (
    <form ref={formRef} action={action} className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 px-3 py-2">
      <span className="text-sm text-slate-700">{SECTION_LABELS[sectionKey]}</span>
      <select
        name="access_level"
        defaultValue={level}
        onChange={() => formRef.current?.requestSubmit()}
        className={`rounded-md border px-2 py-1 text-xs font-medium ${
          level === "edit" ? "border-emerald-300 bg-emerald-50 text-emerald-700" : level === "view" ? "border-amber-300 bg-amber-50 text-amber-700" : "border-slate-300 bg-slate-50 text-slate-500"
        }`}
      >
        {SECTION_ACCESS_LEVELS.map((l) => (
          <option key={l} value={l}>
            {LEVEL_LABEL[l]}
          </option>
        ))}
      </select>
    </form>
  );
}
