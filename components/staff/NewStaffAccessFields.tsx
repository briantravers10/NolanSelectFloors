"use client";

import { useState } from "react";
import { StaffAccessGridFields } from "@/app/company-setup/staff-access/StaffAccessGridFields";

/** Optional "Give app access" section on the New Staff form (Owner/Admin only). */
export function NewStaffAccessFields() {
  const [on, setOn] = useState(false);
  return (
    <div className="rounded-lg border border-slate-200 p-3">
      <label className="flex items-center gap-2 text-sm font-medium text-slate-800 cursor-pointer">
        <input type="checkbox" name="give_access" value="1" checked={on} onChange={(e) => setOn(e.target.checked)} className="rounded border-slate-400" />
        Give app access (they log in with the email above)
      </label>
      {on && (
        <div className="mt-3 space-y-3">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Money visibility</label>
            <select name="access_role" defaultValue="field_employee" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
              <option value="field_employee">Field / crew — no pay rates or costs</option>
              <option value="office_staff">Office staff — sees costs</option>
            </select>
          </div>
          <div>
            <h3 className="text-xs font-semibold text-slate-700 uppercase tracking-wide mb-2">What can they open? (read-only or edit, per section)</h3>
            <StaffAccessGridFields current={{ dashboard: "view", schedule: "view" }} />
          </div>
          <p className="text-xs text-slate-500">After saving, their page shows the setup code to pass along.</p>
        </div>
      )}
    </div>
  );
}
