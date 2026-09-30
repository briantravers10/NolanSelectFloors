"use client";

import { useEffect, useRef, useState } from "react";

export interface SearchableOption {
  id: string;
  label: string;
}

/**
 * Type-to-filter, single-pick dropdown — for a list too long to scan as a
 * plain `<select>` (every job/building/client/etc. in the company).
 * Filtering happens live, client-side, on every keystroke — no "Search"
 * button, no page reload, no waiting. Clicking (or Enter-ing) a result
 * fires `onSelect` immediately; the caller decides what that does (e.g.
 * submit a form right away, matching the instant-submit pattern used
 * elsewhere in this app).
 */
export function SearchableSelect({
  options,
  onSelect,
  placeholder = "Search…",
  excludeId,
  className = "",
  maxResults = 50,
}: {
  options: SearchableOption[];
  onSelect: (id: string) => void;
  placeholder?: string;
  excludeId?: string;
  className?: string;
  maxResults?: number;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const q = query.trim().toLowerCase();
  const candidates = excludeId ? options.filter((o) => o.id !== excludeId) : options;
  const filtered = (q ? candidates.filter((o) => o.label.toLowerCase().includes(q)) : candidates).slice(0, maxResults);

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <input
        type="text"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        placeholder={placeholder}
        className="w-full rounded-md border border-slate-300 bg-white px-2 py-1 text-xs"
      />
      {open && (
        <div className="absolute right-0 z-20 mt-1 w-64 max-h-64 overflow-y-auto rounded-md border border-slate-300 bg-white shadow-lg">
          {filtered.length === 0 ? (
            <div className="px-2.5 py-2 text-xs text-slate-500">No matches{query ? ` for "${query}"` : ""}.</div>
          ) : (
            filtered.map((o) => (
              <button
                key={o.id}
                type="button"
                onClick={() => {
                  onSelect(o.id);
                  setQuery("");
                  setOpen(false);
                }}
                className="block w-full text-left px-2.5 py-1.5 text-xs text-slate-800 hover:bg-sky-50"
              >
                {o.label}
              </button>
            ))
          )}
          {candidates.length > filtered.length && filtered.length === maxResults && (
            <div className="px-2.5 py-1.5 text-[11px] text-slate-400 border-t border-slate-100">Keep typing to narrow down further…</div>
          )}
        </div>
      )}
    </div>
  );
}
