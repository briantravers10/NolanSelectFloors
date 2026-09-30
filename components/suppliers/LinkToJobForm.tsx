"use client";

import { useRef } from "react";
import { linkInvoiceToJobAction } from "@/app/suppliers/actions";
import { SearchableSelect } from "@/components/SearchableSelect";
import type { JobOption } from "./AddSupplierInvoiceForm";

/**
 * Job picker on an invoice line. Changing it moves the SAME record onto
 * that job (or off any job) — the supplier total does not change. A
 * type-to-filter search instead of a plain <select>, since the list is
 * every job in the company.
 */
export function LinkToJobForm({ materialId, projectId, jobs }: { materialId: string; projectId: string | null; jobs: JobOption[] }) {
  const linked = projectId ? jobs.find((j) => j.id === projectId) : undefined;
  const formRef = useRef<HTMLFormElement>(null);
  const hiddenRef = useRef<HTMLInputElement>(null);

  function submitWith(id: string) {
    if (hiddenRef.current) hiddenRef.current.value = id;
    formRef.current?.requestSubmit();
  }

  return (
    <form ref={formRef} action={linkInvoiceToJobAction.bind(null, materialId, projectId)} className="inline-flex items-center gap-1.5">
      <input ref={hiddenRef} type="hidden" name="project_id" defaultValue={projectId ?? ""} />
      <SearchableSelect
        options={jobs}
        placeholder={linked ? linked.label : projectId ? "Linked to a closed job" : "Not linked — pick a job…"}
        onSelect={submitWith}
        className={`w-[220px] ${projectId ? "" : "[&_input]:border-amber-300 [&_input]:bg-amber-50 [&_input]:text-amber-900 [&_input]:font-medium"}`}
      />
      {projectId && (
        <button type="button" onClick={() => submitWith("")} className="text-[11px] text-slate-400 hover:text-rose-600 shrink-0" title="Unlink from any job">
          Unlink
        </button>
      )}
    </form>
  );
}
