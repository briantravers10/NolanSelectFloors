"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * "← Back" for every inner page (a client, a building, a form…). Goes up
 * one level in the URL — /clients/abc/edit → /clients/abc → /clients — so
 * it's predictable and never depends on browser history. Top-level
 * section pages (just /clients, /schedule…) show nothing.
 *
 * Saved changes are never lost by going back: every Save/Create redirects
 * after writing, so only what you haven't saved yet is dropped.
 */
export function BackButton() {
  const pathname = usePathname();
  const parts = pathname.split("/").filter(Boolean);
  if (parts.length < 2) return null;
  const parent = "/" + parts.slice(0, -1).join("/");
  return (
    <Link
      href={parent}
      className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 shrink-0"
    >
      <span aria-hidden>←</span> Back
    </Link>
  );
}
