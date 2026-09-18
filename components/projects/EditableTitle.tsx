"use client";

import { useState } from "react";
import { renameProjectAction } from "@/app/projects/actions";

/** Project title with a Rename link: edit in place, Save or Enter to
 * commit, Escape to cancel. */
export function EditableTitle({ projectId, name, canEdit }: { projectId: string; name: string; canEdit: boolean }) {
  const [editing, setEditing] = useState(false);
  if (!canEdit) return <h1 className="text-xl md:text-2xl font-semibold text-slate-900">{name}</h1>;
  if (!editing) {
    return (
      <h1 className="text-xl md:text-2xl font-semibold text-slate-900 flex items-center gap-2">
        {name}
        <button type="button" onClick={() => setEditing(true)} className="text-xs font-medium text-sky-600 hover:text-sky-800" title="Rename this job">
          ✎ Rename
        </button>
      </h1>
    );
  }
  return (
    <form action={renameProjectAction.bind(null, projectId)} onSubmit={() => setEditing(false)} className="flex items-center gap-2">
      <input
        name="name"
        defaultValue={name}
        autoFocus
        required
        onKeyDown={(e) => e.key === "Escape" && setEditing(false)}
        className="text-xl md:text-2xl font-semibold text-slate-900 rounded-lg border border-sky-300 px-2 py-1 min-w-[280px]"
      />
      <button type="submit" className="rounded-lg bg-sky-600 text-white px-3 py-1.5 text-sm font-medium hover:bg-sky-700">Save</button>
      <button type="button" onClick={() => setEditing(false)} className="text-sm text-slate-500 hover:text-slate-800">Cancel</button>
    </form>
  );
}
