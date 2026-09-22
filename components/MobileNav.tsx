"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { MOBILE_NAV_ITEMS, NAV_ITEMS } from "./nav-items";
import { Icon } from "./Icon";
import { NavBadge } from "./NavBadge";
import type { SectionAccessLevel, SectionKey } from "@/lib/types";

/** `access` (build 11) — see components/Sidebar.tsx for the write-up.
 * `badgeCounts` — see lib/nav-badges.ts. */
export function MobileNav({ access, badgeCounts }: { access: Record<SectionKey, SectionAccessLevel>; badgeCounts: Record<string, number> }) {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);
  const moreItems = NAV_ITEMS.filter((item) => !item.sectionKey || access[item.sectionKey] !== "none");
  const bottomItems = MOBILE_NAV_ITEMS.filter((item) => {
    const navItem = NAV_ITEMS.find((n) => n.href === item.href);
    return item.href === "/more" || !navItem?.sectionKey || access[navItem.sectionKey] !== "none";
  });
  // "More" tile badge — everything not already surfaced by its own bottom
  // bar icon (Dashboard/Schedule/Projects/Staff), so nothing is double-counted.
  const bottomHrefs = new Set(bottomItems.map((i) => i.href));
  const moreBadgeTotal = moreItems.reduce((sum, item) => (bottomHrefs.has(item.href) ? sum : sum + (badgeCounts[item.href] ?? 0)), 0);

  return (
    <>
      {moreOpen && (
        <div className="md:hidden fixed inset-0 z-40 bg-black/40" onClick={() => setMoreOpen(false)}>
          <div
            className="absolute bottom-0 left-0 right-0 bg-white rounded-t-2xl p-4 pb-[calc(env(safe-area-inset-bottom,0px)+1rem)] max-h-[75vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="font-semibold text-slate-900">All sections</div>
              <button onClick={() => setMoreOpen(false)} className="p-2 -m-2 text-slate-500" aria-label="Close menu">
                <Icon name="close" className="w-5 h-5" />
              </button>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {moreItems.map((item) => item.href === "#assistant" ? (
                <button
                  key={item.href}
                  type="button"
                  onClick={() => {
                    setMoreOpen(false);
                    window.dispatchEvent(new CustomEvent("nsf:assistant", { detail: "open" }));
                  }}
                  className="flex flex-col items-center gap-1.5 rounded-xl border border-sky-200 bg-sky-50 py-3 text-sky-800 active:bg-sky-100"
                >
                  <Icon name={item.icon} className="w-5 h-5" />
                  <span className="text-[11px] font-medium text-center leading-tight">{item.label}</span>
                </button>
              ) : (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMoreOpen(false)}
                  className="relative flex flex-col items-center gap-1.5 rounded-xl border border-slate-200 py-3 text-slate-700 active:bg-slate-50"
                >
                  {!!badgeCounts[item.href] && (
                    <span className="absolute top-1.5 right-1.5">
                      <NavBadge count={badgeCounts[item.href]} />
                    </span>
                  )}
                  <Icon name={item.icon} className="w-5 h-5" />
                  <span className="text-[11px] font-medium text-center leading-tight">{item.label}</span>
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-white border-t border-slate-200 flex"
        style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
      >
        {bottomItems.map((item) => {
          const isMore = item.href === "/more";
          const active = !isMore && (pathname === item.href || pathname.startsWith(item.href + "/"));
          if (isMore) {
            return (
              <button
                key={item.href}
                onClick={() => setMoreOpen(true)}
                className="relative flex-1 flex flex-col items-center justify-center gap-0.5 py-2 text-slate-500"
              >
                {!!moreBadgeTotal && (
                  <span className="absolute top-0.5 right-[calc(50%-1.5rem)]">
                    <NavBadge count={moreBadgeTotal} />
                  </span>
                )}
                <Icon name={item.icon} className="w-5 h-5" />
                <span className="text-[10px] font-medium">{item.label}</span>
              </button>
            );
          }
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`relative flex-1 flex flex-col items-center justify-center gap-0.5 py-2 ${active ? "text-sky-600" : "text-slate-500"}`}
            >
              {!!badgeCounts[item.href] && (
                <span className="absolute top-0.5 right-[calc(50%-1.5rem)]">
                  <NavBadge count={badgeCounts[item.href]} />
                </span>
              )}
              <Icon name={item.icon} className="w-5 h-5" />
              <span className="text-[10px] font-medium">{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}
