"use client";

import { useState, useTransition } from "react";

/**
 * Manual "Estimated / Contract Value" entry for the Financial Summary
 * card — for when QuickBooks isn't connected (so there's no Estimate
 * document to pull a number from) and the office just wants to type in
 * the dollar figure from their own estimate. Saves straight onto
 * project.project_value via the same action the Estimate Calculator
 * uses (see app/projects/actions.ts#saveProjectEstimateAction).
 */
export function EditEstimateValueButton({ action, currentValue }: { action: (value: number) => Promise<void>; currentValue: number }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(currentValue ? String(currentValue) : "");
  const [isPending, startTransition] = useTransition();

  if (!editing) {
    return (
      <button type="button" onClick={() => setEditing(true)} className="text-xs text-sky-600 hover:underline">
        Edit
      </button>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const num = Math.max(0, Number(value) || 0);
        startTransition(async () => {
          await action(num);
          setEditing(false);
        });
      }}
      className="inline-flex items-center gap-1.5"
    >
      <input
        type="number"
        step="0.01"
        min="0"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        autoFocus
        className="w-28 rounded-md border border-slate-300 px-1.5 py-0.5 text-xs text-right"
      />
      <button type="submit" disabled={isPending} className="text-xs font-medium text-sky-600 hover:underline disabled:opacity-50">
        {isPending ? "Saving…" : "Save"}
      </button>
      <button type="button" onClick={() => setEditing(false)} className="text-xs text-slate-400 hover:underline">
        Cancel
      </button>
    </form>
  );
}
