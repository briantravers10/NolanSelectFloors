"use client";

import { moveFiledEmailToProjectAction } from "@/app/inbox/actions";

export interface JobOption {
  id: string;
  label: string;
}

/**
 * "Move to job" on a filed bid/estimate or purchase order — for when the
 * job picker in Email Inbox only offered one match (e.g. a building with
 * several units sharing one address) and the wrong one got picked. Picking
 * a job here submits immediately, same instant-submit pattern as the
 * Suppliers job-link picker.
 */
export function MoveFiledEmailToJobForm({ emailId, currentProjectId, jobs }: { emailId: string; currentProjectId: string; jobs: JobOption[] }) {
  return (
    <form action={moveFiledEmailToProjectAction.bind(null, emailId, currentProjectId)} className="inline-flex items-center gap-1.5">
      <select
        name="project_id"
        defaultValue=""
        onChange={(e) => e.currentTarget.form?.requestSubmit()}
        aria-label="Move to a different job"
        className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs max-w-[220px]"
      >
        <option value="">Move to job…</option>
        {jobs.filter((j) => j.id !== currentProjectId).map((j) => (
          <option key={j.id} value={j.id}>{j.label}</option>
        ))}
      </select>
    </form>
  );
}
