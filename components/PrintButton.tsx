"use client";

/** Opens the browser print dialog; print CSS in globals.css hides the
 * sidebar/top bar/controls so only the schedule content prints. */
export function PrintButton({ label = "Print" }: { label?: string }) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="no-print inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
    >
      🖨 {label}
    </button>
  );
}
