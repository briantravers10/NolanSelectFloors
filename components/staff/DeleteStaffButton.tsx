"use client";

import { useState } from "react";

/**
 * Two-step delete so a stray tap can't wipe someone: first click reveals
 * the warning + a real Confirm button, second click submits the server
 * action. Deleting is permanent and takes their schedule/hours history with
 * it, so the copy nudges toward "Mark Inactive" for anyone who just left.
 */
export function DeleteStaffButton({ action, name }: { action: () => Promise<void>; name: string }) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  if (!confirming) {
    return (
      <button type="button" onClick={() => setConfirming(true)} className="text-xs text-rose-600 hover:text-rose-800 underline">
        Delete staff member
      </button>
    );
  }

  return (
    <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm">
      <p className="text-rose-900 font-medium mb-1">Permanently delete {name}?</p>
      <p className="text-xs text-rose-800 mb-2">
        This removes them and all their schedule assignments, logged hours and time off. It can&apos;t be undone.
        If they&apos;ve just left the company, use &quot;Mark Inactive&quot; instead to keep their history.
      </p>
      <form
        action={action}
        onSubmit={() => setBusy(true)}
        className="flex items-center gap-2"
      >
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
