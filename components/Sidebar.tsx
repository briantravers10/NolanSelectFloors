"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_ITEMS } from "./nav-items";
import { Icon } from "./Icon";
import { NavBadge } from "./NavBadge";
import type { SectionAccessLevel, SectionKey } from "@/lib/types";

/**
 * `access` (build 11) is the current acting user's section access map —
 * see lib/permissions.ts getAllSectionAccess() and README "Enforcement".
 * A nav item whose sectionKey resolves to 'none' is hidden entirely, per
 * the client's ask that staff not even see sections they can't use.
 */
export function Sidebar({
  access,
  realAuthOn,
  badgeCounts,
  isOwner,
}: {
  access: Record<SectionKey, SectionAccessLevel>;
  realAuthOn: boolean;
  badgeCounts: Record<string, number>;
  /** Owner/Admin only — gates the "AI Support" link below. Not part of
   * NAV_ITEMS' section-permission system since it isn't grantable through
   * that grid; see app/ai-support/page.tsx. */
  isOwner: boolean;
}) {
  const pathname = usePathname();
  const items = NAV_ITEMS.filter((item) => !item.sectionKey || access[item.sectionKey] !== "none");
  return (
    <aside className="hidden md:flex md:w-60 md:flex-col md:shrink-0 bg-slate-900 text-slate-200 h-dvh sticky top-0">
      <div className="px-5 py-5 border-b border-slate-800">
        <Link href="/dashboard" className="block">
          <div className="text-white font-semibold text-lg leading-tight">Nolan Select Floors</div>
          <div className="text-xs text-slate-400 mt-0.5">Operations Console</div>
        </Link>
      </div>
      <nav className="flex-1 overflow-y-auto py-3">
        {items.map((item) => {
          if (item.href === "#assistant") {
            return (
              <button
                key={item.href}
                type="button"
                onClick={() => window.dispatchEvent(new CustomEvent("nsf:assistant", { detail: "toggle" }))}
                className="w-full flex items-center gap-3 px-5 py-2.5 text-sm font-medium transition-colors text-sky-300 hover:bg-slate-800/60 hover:text-white border-l-2 border-transparent"
              >
                <Icon name={item.icon} className="w-4.5 h-4.5 shrink-0" />
                <span>{item.label}</span>
              </button>
            );
          }
          if (item.href === "#report-problem") {
            return (
              <button
                key={item.href}
                type="button"
                onClick={() => window.dispatchEvent(new CustomEvent("nsf:report-problem", { detail: "open" }))}
                className="w-full flex items-center gap-3 px-5 py-2.5 text-sm font-medium transition-colors text-rose-300 hover:bg-slate-800/60 hover:text-white border-l-2 border-transparent"
              >
                <Icon name={item.icon} className="w-4.5 h-4.5 shrink-0" />
                <span>{item.label}</span>
              </button>
            );
          }
          const active = pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-5 py-2.5 text-sm font-medium transition-colors ${
                active ? "bg-slate-800 text-white border-l-2 border-sky-400" : "text-slate-300 hover:bg-slate-800/60 hover:text-white border-l-2 border-transparent"
              }`}
            >
              <Icon name={item.icon} className="w-4.5 h-4.5 shrink-0" />
              <span className="flex-1">{item.label}</span>
              <NavBadge count={badgeCounts[item.href]} />
            </Link>
          );
        })}
        {isOwner && (
          <Link
            href="/ai-support"
            className={`flex items-center gap-3 px-5 py-2.5 text-sm font-medium transition-colors ${
              pathname === "/ai-support" || pathname.startsWith("/ai-support/")
                ? "bg-slate-800 text-white border-l-2 border-sky-400"
                : "text-slate-300 hover:bg-slate-800/60 hover:text-white border-l-2 border-transparent"
            }`}
          >
            <Icon name="settings" className="w-4.5 h-4.5 shrink-0" />
            <span className="flex-1">AI Support</span>
            <NavBadge count={badgeCounts["/ai-support"]} />
          </Link>
        )}
      </nav>
      <div className="px-5 py-4 border-t border-slate-800 text-xs text-slate-500">
        {realAuthOn ? "Signed in" : "No login required — single-company demo mode."}
      </div>
    </aside>
  );
}
