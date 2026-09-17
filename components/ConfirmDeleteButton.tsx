"use client";

import { useState } from "react";

/** Two-step permanent delete: link → warning + real Confirm button. */
export function ConfirmDeleteButton({
  action,
  label,
  title,
  warning,
}: {
  action: () => Promise<void>;
  label: string;
  title: string;
  warning: string;
}) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  if (!confirming) {
    return (
      <button type="button" onClick={() => setConfirming(true)} className="text-xs text-rose-600 hover:text-rose-800 underline">
        {label}
      </button>
    );
  }
  return (
    <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm">
      <p className="text-rose-900 font-medium mb-1">{title}</p>
      <p className="text-xs text-rose-800 mb-2">{warning}</p>
      <form action={action} onSubmit={() => setBusy(true)} className="flex items-center gap-2">
        <button type="submit" disabled={busy} className="rounded-lg bg-rose-600 text-white px-3 py-1.5 text-xs font-medium hover:bg-rose-700 disabled:opacity-60">
          {busy ? "Deleting…" : "Yes, delete"}
        </button>
        <button type="button" onClick={() => setConfirming(false)} className="text-xs text-slate-600 hover:text-slate-900">
          Cancel
        </button>
      </form>
    </div>
  );
}
