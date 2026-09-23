"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

/** Filters Weekly Review down to jobs assigned (for invoicing) to one
 * person, or to Unassigned — so the office can print just their own list.
 * Navigates via the URL (?assignee=...) so Print picks up the filtered set. */
export function AssigneeFilterSelect({ people, value }: { people: { id: string; name: string }[]; value: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  return (
    <select
      defaultValue={value}
      onChange={(e) => {
        const params = new URLSearchParams(searchParams.toString());
        if (e.target.value) params.set("assignee", e.target.value);
        else params.delete("assignee");
        router.push(`${pathname}?${params.toString()}`);
      }}
      aria-label="Filter by who the invoice is assigned to"
      className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm"
    >
      <option value="">Everyone</option>
      <option value="unassigned">Unassigned</option>
      {people.map((p) => (
        <option key={p.id} value={p.id}>{p.name}</option>
      ))}
    </select>
  );
}
