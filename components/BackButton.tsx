"use client";

import { usePathname, useRouter } from "next/navigation";

/**
 * "← Back" on every inner page. Goes to the page you actually came from
 * when this tab has one (browser history), otherwise up one level in the
 * URL (/clients/abc/edit → /clients/abc → /clients) — e.g. when a link
 * was opened straight into a fresh tab. Top-level section pages show
 * nothing.
 */
export function BackButton() {
  const pathname = usePathname();
  const router = useRouter();
  const parts = pathname.split("/").filter(Boolean);
  if (parts.length < 2) return null;
  const parent = "/" + parts.slice(0, -1).join("/");

  return (
    <button
      type="button"
      onClick={() => {
        if (typeof window !== "undefined" && window.history.length > 1) router.back();
        else router.push(parent);
      }}
      className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 shrink-0"
    >
      <span aria-hidden>←</span> Back
    </button>
  );
}
