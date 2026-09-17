"use client";

import { useState } from "react";
import { setScheduleNotesAction } from "@/app/schedule/actions";

/**
 * The Notes box on a schedule tile, editable in place on Create/Edit
 * Schedule: click, type, and it saves when you click away or press
 * Ctrl/Cmd+Enter (Escape cancels). View Schedule keeps the read-only box.
 */
export function EditableNotes({ projectId, date, notes }: { projectId: string; date: string; notes?: string }) {
  const [value, setValue] = useState(notes ?? "");
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState(notes ?? "");

  async function save() {
    if (value === lastSaved) return;
    setSaving(true);
    const fd = new FormData();
    fd.set("notes", value);
    await setScheduleNotesAction(projectId, date, fd);
    setLastSaved(value);
    setSaving(false);
  }

  return (
    <div className="rounded-lg border border-slate-300 bg-white/70 px-2.5 py-1.5 min-h-[3rem] focus-within:border-sky-400 focus-within:bg-white">
      <div className="flex items-center justify-between">
        <div className="text-[10px] font-semibold text-slate-600 uppercase tracking-wide">Notes</div>
        <div className="text-[10px] text-slate-400">{saving ? "Saving…" : value !== lastSaved ? "Click away to save" : "Click to edit"}</div>
      </div>
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={save}
        onKeyDown={(e) => {
          if ((e.metaKey || e.ctrlKey) && e.key === "Enter") (e.target as HTMLTextAreaElement).blur();
          if (e.key === "Escape") {
            setValue(lastSaved);
            (e.target as HTMLTextAreaElement).blur();
          }
        }}
        rows={2}
        placeholder="Type notes for this job / day…"
        className="w-full resize-y bg-transparent text-[13px] text-slate-900 leading-snug outline-none placeholder:text-slate-400"
      />
    </div>
  );
}
