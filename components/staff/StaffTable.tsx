"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { PhoneLink } from "@/components/ui";
import { STAFF_CAPABILITIES } from "@/lib/types";

export interface StaffRow {
  id: string;
  name: string;
  nickname?: string;
  title: string;
  phone?: string;
  taxStatus?: string;
  isDriver: boolean;
  active: boolean;
  payRate?: string;
  capabilities: string[];
  offTodayLabel?: string;
  overAllowance: boolean;
}

/** Staff list with filters: search (name / nickname), title, capability,
 * tax status, active/inactive. Filtering is instant, in the browser. */
export function StaffTable({ rows, canViewRates }: { rows: StaffRow[]; canViewRates: boolean }) {
  const [q, setQ] = useState("");
  const [title, setTitle] = useState("");
  const [cap, setCap] = useState("");
  const [tax, setTax] = useState("");
  const [status, setStatus] = useState<"active" | "inactive" | "all">("active");

  const titles = useMemo(() => [...new Set(rows.map((r) => r.title).filter(Boolean))].sort(), [rows]);

  const filtered = rows.filter((r) => {
    if (status === "active" && !r.active) return false;
    if (status === "inactive" && r.active) return false;
    if (title && r.title !== title) return false;
    if (cap && !r.capabilities.includes(cap)) return false;
    if (tax && (r.taxStatus ?? "") !== tax) return false;
    if (q) {
      const needle = q.trim().toLowerCase();
      const hay = `${r.name} ${r.nickname ?? ""} ${r.title} ${r.phone ?? ""}`.toLowerCase();
      if (!hay.includes(needle)) return false;
    }
    return true;
  });

  const sel = "rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm";

  return (
    <>
      <div className="no-print flex flex-wrap items-center gap-2 mb-3">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search name, nickname, phone…"
          className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm min-w-[240px] flex-1 sm:flex-none"
        />
        <select value={title} onChange={(e) => setTitle(e.target.value)} className={sel}>
          <option value="">All titles</option>
          {titles.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
        <select value={cap} onChange={(e) => setCap(e.target.value)} className={sel}>
          <option value="">Any capability</option>
          {STAFF_CAPABILITIES.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        <select value={tax} onChange={(e) => setTax(e.target.value)} className={sel}>
          <option value="">W-4 or 1099</option>
          <option value="W-4">W-4</option>
          <option value="1099">1099</option>
        </select>
        <select value={status} onChange={(e) => setStatus(e.target.value as typeof status)} className={sel}>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
          <option value="all">Everyone</option>
        </select>
        <span className="text-xs text-slate-500 ml-auto">{filtered.length} of {rows.length}</span>
        {(q || title || cap || tax || status !== "active") && (
          <button
            type="button"
            onClick={() => {
              setQ(""); setTitle(""); setCap(""); setTax(""); setStatus("active");
            }}
            className="text-xs text-sky-600 hover:text-sky-800"
          >
            Clear filters
          </button>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-slate-500 uppercase tracking-wide border-b border-slate-200">
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Title</th>
              <th className="px-4 py-3">Phone</th>
              <th className="px-4 py-3">Tax</th>
              <th className="px-4 py-3 text-center">Driver</th>
              {canViewRates && <th className="px-4 py-3 text-right">Pay Rate</th>}
              <th className="px-4 py-3">Capabilities</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-sm text-slate-500">No one matches those filters.</td>
              </tr>
            )}
            {filtered.map((e) => (
              <tr key={e.id} className={`border-b border-slate-100 last:border-0 hover:bg-slate-50 ${!e.active ? "opacity-50" : ""}`}>
                <td className="px-4 py-2.5">
                  <Link href={`/staff/${e.id}`} className="font-medium text-slate-900 hover:text-sky-600 inline-flex items-center gap-1.5">
                    {e.name}
                    {e.nickname ? <span className="text-slate-500 font-normal"> ({e.nickname})</span> : null}
                  </Link>
                  {e.offTodayLabel && (
                    <span className="ml-2 inline-flex items-center rounded-full bg-amber-50 text-amber-800 border border-amber-200 px-2 py-0.5 text-[11px] font-medium whitespace-nowrap">
                      {e.offTodayLabel} today
                    </span>
                  )}
                  {e.overAllowance && (
                    <span className="ml-2 inline-flex items-center rounded-full bg-rose-50 text-rose-800 border border-rose-200 px-2 py-0.5 text-[11px] font-medium whitespace-nowrap" title="Used more time off this year than their allowance.">
                      ⚠ Over Allowance
                    </span>
                  )}
                </td>
                <td className="px-4 py-2.5 text-slate-600">{e.title}</td>
                <td className="px-4 py-2.5"><PhoneLink phone={e.phone} /></td>
                <td className="px-4 py-2.5 text-slate-600">{e.taxStatus ?? "—"}</td>
                <td className="px-4 py-2.5 text-center">{e.isDriver ? "Yes" : "—"}</td>
                {canViewRates && <td className="px-4 py-2.5 text-right">{e.payRate}</td>}
                <td className="px-4 py-2.5 text-slate-500 text-xs">{e.capabilities.join(", ")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
