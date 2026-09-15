"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "./Icon";
import type { SearchResult } from "@/app/api/search/route";

export function SearchBox() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    if (query.trim().length < 2) return;
    const timeout = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
        const data = await res.json();
        setResults(data.results ?? []);
        setOpen(true);
      } catch {
        setResults([]);
      }
    }, 180);
    return () => clearTimeout(timeout);
  }, [query]);

  function handleChange(value: string) {
    setQuery(value);
    if (value.trim().length < 2) {
      setResults([]);
    }
  }

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  return (
    <div ref={boxRef} className="relative w-full max-w-md">
      <div className="flex items-center gap-2 bg-slate-100 rounded-lg px-3 py-2 border border-transparent focus-within:border-sky-400 focus-within:bg-white">
        <Icon name="search" className="w-4 h-4 text-slate-400 shrink-0" />
        <input
          value={query}
          onChange={(e) => handleChange(e.target.value)}
          onFocus={() => results.length > 0 && setOpen(true)}
          placeholder="Search buildings, clients, contacts, staff, projects…"
          className="bg-transparent outline-none text-sm w-full placeholder:text-slate-400"
        />
      </div>
      {open && results.length > 0 && (
        <div className="absolute mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg z-50 max-h-96 overflow-y-auto">
          {results.map((r, i) => (
            <button
              key={i}
              onClick={() => {
                setOpen(false);
                setQuery("");
                router.push(r.href);
              }}
              className="w-full text-left px-3 py-2.5 hover:bg-slate-50 flex flex-col border-b border-slate-100 last:border-0"
            >
              <span className="text-xs font-medium text-sky-600">{r.type}</span>
              <span className="text-sm text-slate-800">{r.label}</span>
              {r.sublabel && <span className="text-xs text-slate-500">{r.sublabel}</span>}
            </button>
          ))}
        </div>
      )}
      {open && query.trim().length >= 2 && results.length === 0 && (
        <div className="absolute mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg z-50 px-3 py-3 text-sm text-slate-500">
          No matches for &ldquo;{query}&rdquo;.
        </div>
      )}
    </div>
  );
}
