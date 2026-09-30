"use client";

import { useRef } from "react";
import { SearchableSelect } from "@/components/SearchableSelect";

export interface JobOption {
  id: string;
  label: string;
}

/**
 * Generic "Move to job..." control — re-links a filed document (a bid/PO
 * email, an outbound invoice or change order, a drawing, or the COI) to a
 * different job. A type-to-filter search (SearchableSelect) instead of a
 * plain `<select>`, since a company with 50+ jobs makes a flat dropdown
 * unusable. Picking a result submits immediately — same instant-submit
 * pattern as the rest of this app. The bound server action is passed in
 * from the server component, since each document type moves differently
 * under the hood (see lib/db.ts move* functions).
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
  const formRef = useRef<HTMLFormElement>(null);
  const hiddenRef = useRef<HTMLInputElement>(null);

  return (
    <form ref={formRef} action={action} className="inline-block w-[180px]">
      <input ref={hiddenRef} type="hidden" name="project_id" />
      <SearchableSelect
        options={jobs}
        excludeId={excludeProjectId}
        placeholder="Move to job…"
        onSelect={(id) => {
          if (hiddenRef.current) hiddenRef.current.value = id;
          formRef.current?.requestSubmit();
        }}
      />
    </form>
  );
}
