"use client";

export interface JobOption {
  id: string;
  label: string;
}

/**
 * Generic "Move to job..." control — re-links a filed document (a bid/PO
 * email, an outbound invoice or change order, a drawing, or the COI) to a
 * different job. Picking a job submits immediately, same instant-submit
 * pattern as the Suppliers job-link picker. The bound server action is
 * passed in from the server component, since each document type moves
 * differently under the hood (see lib/db.ts move* functions).
 */
export function MoveToJobPicker({
  action,
  jobs,
  excludeProjectId,
}: {
  action: (formData: FormData) => void | Promise<void>;
  jobs: JobOption[];
  excludeProjectId?: string;
}) {
  return (
    <form action={action} className="inline-flex items-center gap-1.5">
      <select
        name="project_id"
        defaultValue=""
        onChange={(e) => e.currentTarget.form?.requestSubmit()}
        aria-label="Move to a different job"
        className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs max-w-[220px]"
      >
        <option value="">Move to job…</option>
        {jobs.filter((j) => j.id !== excludeProjectId).map((j) => (
          <option key={j.id} value={j.id}>{j.label}</option>
        ))}
      </select>
    </form>
  );
}
