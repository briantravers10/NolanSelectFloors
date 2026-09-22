"use client";

import { assignInvoiceAction } from "@/app/dashboard/actions";

/** Who's sending this invoice — saves as soon as it's changed. */
export function InvoiceAssigneeSelect({ projectId, assignedTo, people }: { projectId: string; assignedTo: string | null; people: { id: string; name: string }[] }) {
  return (
    <form action={assignInvoiceAction.bind(null, projectId)}>
      <select
        name="office_user_id"
        defaultValue={assignedTo ?? ""}
        onChange={(e) => e.currentTarget.form?.requestSubmit()}
        aria-label="Who is sending this invoice"
        className={`rounded-md border px-2 py-1.5 text-xs ${assignedTo ? "border-amber-400 bg-white text-amber-900 font-medium" : "border-slate-300 bg-white text-slate-700"}`}
      >
        <option value="">Assign to…</option>
        {people.map((p) => (
          <option key={p.id} value={p.id}>{p.name}</option>
        ))}
      </select>
    </form>
  );
}
