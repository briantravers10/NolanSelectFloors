"use client";

import { useState } from "react";
import { WEEKDAYS } from "@/lib/types";

/** "Office" checkbox + typical-workdays picker, shown together on the
 * staff add/edit forms. The workdays feed Create/Edit Schedule's "Office
 * Staff Working Today" auto-check (see lib/db.ts#ensureOfficeWorkingDefaults)
 * so payroll for office staff stays accurate with minimal daily clicking. */
export function OfficeWorkdaysFields({ defaultIsOffice, defaultWorkdays }: { defaultIsOffice?: boolean; defaultWorkdays?: string[] }) {
  const [isOffice, setIsOffice] = useState(Boolean(defaultIsOffice));
  const selected = new Set(defaultWorkdays ?? []);

  return (
    <div>
      <label className="flex items-center gap-2 text-sm text-slate-700">
        <input
          type="checkbox"
          name="is_office"
          defaultChecked={defaultIsOffice}
          onChange={(e) => setIsOffice(e.target.checked)}
          className="rounded border-slate-300"
        />
        Office
      </label>
      {isOffice && (
        <div className="mt-1.5 ml-1">
          <div className="text-[11px] text-slate-500 uppercase mb-1">Typical workdays — autofills &quot;Working&quot; on Create/Edit Schedule</div>
          <div className="flex flex-wrap gap-x-3 gap-y-1">
            {WEEKDAYS.map((d) => (
              <label key={d} className="flex items-center gap-1 text-sm text-slate-700">
                <input type="checkbox" name="office_workdays" value={d} defaultChecked={selected.has(d)} className="rounded border-slate-300" />
                {d}
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
