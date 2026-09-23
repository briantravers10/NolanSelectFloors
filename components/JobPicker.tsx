"use client";

import { useMemo, useState } from "react";

export interface JobPickerOption {
  id: string;
  label: string;
}

/**
 * Type-to-search job picker — submits the picked job's id via a hidden
 * input named `name`, so it drops straight into any existing form in place
 * of a plain <select>. Built for lists too long to scan by eye (e.g. Email
 * Inbox's every job across every pipeline stage, not just active ones).
 */
export function JobPicker({
  name,
  jobs,
  defaultValue,
  required,
  placeholder = "Type to search jobs…",
}: {
  name: string;
  jobs: JobPickerOption[];
  defaultValue?: string;
  required?: boolean;
  placeholder?: string;
}) {
  const initial = jobs.find((j) => j.id === defaultValue);
  const [selectedId, setSelectedId] = useState(initial?.id ?? "");
  const [query, setQuery] = useState(initial?.label ?? "");
  const [open, setOpen] = useState(false);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return jobs.slice(0, 50);
    return jobs.filter((j) => j.label.toLowerCase().includes(q)).slice(0, 50);
  }, [jobs, query]);

  return (
    <div className="relative">
      <input type="hidden" name={name} value={selectedId} required={required} />
      <input
        type="text"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setSelectedId("");
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder={placeholder}
        autoComplete="off"
        className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm"
      />
      {open && matches.length > 0 && (
        <div className="absolute z-20 mt-1 w-full max-h-56 overflow-auto rounded-lg border border-slate-200 bg-white shadow-lg">
          {matches.map((j) => (
            <button
              key={j.id}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                setSelectedId(j.id);
                setQuery(j.label);
                setOpen(false);
              }}
              className={`block w-full text-left px-2.5 py-1.5 text-sm hover:bg-sky-50 ${j.id === selectedId ? "bg-sky-50 font-medium" : ""}`}
            >
              {j.label}
            </button>
          ))}
        </div>
      )}
      {open && query.trim() && matches.length === 0 && (
        <div className="absolute z-20 mt-1 w-full rounded-lg border border-slate-200 bg-white shadow-lg px-2.5 py-1.5 text-sm text-slate-400">No jobs match.</div>
      )}
    </div>
  );
}
