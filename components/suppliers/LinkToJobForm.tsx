"use client";

import { linkInvoiceToJobAction } from "@/app/suppliers/actions";
import type { JobOption } from "./AddSupplierInvoiceForm";

/**
 * Job picker on an invoice line. Changing it moves the SAME record onto
 * that job (or off any job) — the supplier total does not change.
 */
export function LinkToJobForm({ materialId, projectId, jobs }: { materialId: string; projectId: string | null; jobs: JobOption[] }) {
  const linked = projectId ? jobs.find((j) => j.id === projectId) : undefined;
  return (
    <form action={linkInvoiceToJobAction.bind(null, materialId, projectId)} className="inline-flex items-center gap-1.5">
      <select
        name="project_id"
        defaultValue={projectId ?? ""}
        onChange={(e) => e.currentTarget.form?.requestSubmit()}
        aria-label="Job this invoice is for"
        className={`rounded-md border px-2 py-1 text-xs max-w-[260px] ${projectId ? "border-slate-300 bg-white text-slate-800" : "border-amber-300 bg-amber-50 text-amber-900 font-medium"}`}
      >
        <option value="">{projectId && !linked ? "Linked to a closed job" : "Not linked — pick a job…"}</option>
        {jobs.map((j) => (
          <option key={j.id} value={j.id}>{j.label}</option>
        ))}
      </select>
    </form>
  );
}
