"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_ITEMS } from "./nav-items";
import { Icon } from "./Icon";

export function Sidebar() {
  const pathname = usePathname();
  return (
    <aside className="hidden md:flex md:w-60 md:flex-col md:shrink-0 bg-slate-900 text-slate-200 h-dvh sticky top-0">
      <div className="px-5 py-5 border-b border-slate-800">
        <Link href="/dashboard" className="block">
          <div className="text-white font-semibold text-lg leading-tight">Nolan Select Floors</div>
          <div className="text-xs text-slate-400 mt-0.5">Operations Console</div>
        </Link>
      </div>
      <nav className="flex-1 overflow-y-auto py-3">
        {NAV_ITEMS.map((item) => {
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
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
      <div className="px-5 py-4 border-t border-slate-800 text-xs text-slate-500">
        No login required — single-company demo mode.
      </div>
    </aside>
  );
}
