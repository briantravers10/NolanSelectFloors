"use client";

// Minimal "add/remove crew" control embedded in an expanded schedule row.
// Reuses the existing addAssignmentAction/removeAssignmentAction server
// actions (schedule_assignments stays the single planned-crew record).
import { useState } from "react";
import type { Employee } from "@/lib/types";
import { STAFF_CAPABILITIES } from "@/lib/types";
import { Button } from "@/components/ui";
import { addAssignmentAction, removeAssignmentAction } from "@/app/schedule/actions";

export function AddCrewInline({
  projectId,
  date,
  employees,
  crew,
}: {
  projectId: string;
  date: string;
  employees: Employee[];
  crew: { assignmentId: string; employeeId: string; name: string }[];
}) {
  const [showForm, setShowForm] = useState(false);

  return (
    <div className="space-y-2">
      {crew.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {crew.map((c) => (
            <form key={c.assignmentId} action={removeAssignmentAction.bind(null, c.assignmentId, projectId)}>
              <button type="submit" title="Remove from schedule" className="text-xs bg-white border border-slate-300 hover:bg-rose-50 hover:text-rose-700 hover:border-rose-300 rounded-full px-2.5 py-1 text-slate-700">
                {c.name} ✕
              </button>
            </form>
          ))}
        </div>
      )}

      {showForm ? (
        <form
          action={async (fd) => {
            await addAssignmentAction(fd);
            setShowForm(false);
          }}
          className="flex flex-wrap items-end gap-2 bg-white border border-slate-200 rounded-lg p-2.5"
        >
          <input type="hidden" name="project_id" value={projectId} />
          <input type="hidden" name="schedule_date" value={date} />
          <div>
            <label className="block text-[10px] text-slate-500 uppercase mb-0.5">Employee</label>
            <select name="employee_id" required className="rounded-md border border-slate-300 px-2 py-1 text-sm">
              {employees.map((e) => (
                <option key={e.id} value={e.id}>{e.first_name} {e.last_name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[10px] text-slate-500 uppercase mb-0.5">Role</label>
            <select name="role_on_job" className="rounded-md border border-slate-300 px-2 py-1 text-sm">
              {STAFF_CAPABILITIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[10px] text-slate-500 uppercase mb-0.5">Call Time</label>
            <input name="call_time" defaultValue="7:00 AM" className="rounded-md border border-slate-300 px-2 py-1 text-sm w-24" />
          </div>
          <Button type="submit" className="text-xs py-1.5">Add</Button>
          <Button type="button" variant="secondary" className="text-xs py-1.5" onClick={() => setShowForm(false)}>Cancel</Button>
        </form>
      ) : (
        <Button type="button" variant="secondary" className="text-xs py-1" onClick={() => setShowForm(true)}>+ Add Crew Member</Button>
      )}
    </div>
  );
}
