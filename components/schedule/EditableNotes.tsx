"use client";

import { useState } from "react";
import { setScheduleNotesAction } from "@/app/schedule/actions";
import { formatDateShort } from "@/lib/dates";

/**
 * The Notes box on a schedule tile, editable in place on Create/Edit
 * Schedule: click, type, and it saves when you click away or press
 * Ctrl/Cmd+Enter (Escape cancels). View Schedule keeps the read-only box.
 *
 * A continuing job's box starts blank each day — it no longer carries
 * yesterday's text forward (see lib/db.ts#getOrCreateProjectScheduleDay), so
 * writing today's note never means erasing yesterday's first. The prior
 * day's own note (if any) is shown greyed out above with its date, and
 * "Repeat this note" copies it into today's box and saves immediately.
 */
export function EditableNotes({
  projectId,
  date,
  notes,
  priorNote,
  priorNoteDate,
}: {
  projectId: string;
  date: string;
  notes?: string;
  priorNote?: string;
  priorNoteDate?: string;
}) {
  const [value, setValue] = useState(notes ?? "");
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState(notes ?? "");

  async function save(next: string) {
    if (next === lastSaved) return;
    setSaving(true);
    const fd = new FormData();
    fd.set("notes", next);
    await setScheduleNotesAction(projectId, date, fd);
    setLastSaved(next);
    setSaving(false);
  }

  return (
    <div className="space-y-1.5">
      {priorNote && (
        <div className="rounded-lg border border-slate-200 bg-slate-100 px-2.5 py-1.5">
          <div className="flex items-center justify-between gap-2">
            <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">
              Note from {priorNoteDate ? formatDateShort(priorNoteDate) : "before"}
            </div>
            <button type="button" onClick={() => { setValue(priorNote); save(priorNote); }} className="text-[10px] font-medium text-sky-700 hover:underline shrink-0">
              Repeat this note
            </button>
          </div>
          <div className="text-[13px] text-slate-500 leading-snug whitespace-pre-wrap">{priorNote}</div>
        </div>
      )}
      <div className="rounded-lg border border-slate-300 bg-white/70 px-2.5 py-1.5 min-h-[3rem] focus-within:border-sky-400 focus-within:bg-white">
        <div className="flex items-center justify-between">
          <div className="text-[10px] font-semibold text-slate-600 uppercase tracking-wide">Notes — Today</div>
          <div className="text-[10px] text-slate-400">{saving ? "Saving…" : value !== lastSaved ? "Click away to save" : "Click to edit"}</div>
        </div>
        <textarea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onBlur={() => save(value)}
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
    </div>
  );
}
