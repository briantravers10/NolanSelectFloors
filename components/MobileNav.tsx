"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { MOBILE_NAV_ITEMS, NAV_ITEMS } from "./nav-items";
import { Icon } from "./Icon";
import type { SectionAccessLevel, SectionKey } from "@/lib/types";

/** `access` (build 11) — see components/Sidebar.tsx for the write-up. */
export function MobileNav({ access }: { access: Record<SectionKey, SectionAccessLevel> }) {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);
  const moreItems = NAV_ITEMS.filter((item) => !item.sectionKey || access[item.sectionKey] !== "none");
  const bottomItems = MOBILE_NAV_ITEMS.filter((item) => {
    const navItem = NAV_ITEMS.find((n) => n.href === item.href);
    return item.href === "/more" || !navItem?.sectionKey || access[navItem.sectionKey] !== "none";
  });

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
                  className="flex flex-col items-center gap-1.5 rounded-xl border border-slate-200 py-3 text-slate-700 active:bg-slate-50"
                >
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
                className="flex-1 flex flex-col items-center justify-center gap-0.5 py-2 text-slate-500"
              >
                <Icon name={item.icon} className="w-5 h-5" />
                <span className="text-[10px] font-medium">{item.label}</span>
              </button>
            );
          }
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex-1 flex flex-col items-center justify-center gap-0.5 py-2 ${active ? "text-sky-600" : "text-slate-500"}`}
            >
              <Icon name={item.icon} className="w-5 h-5" />
              <span className="text-[10px] font-medium">{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}
