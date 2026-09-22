import type { ActualLaborEntry, Employee, Project } from "@/lib/types";
import { employeeDisplayName } from "@/lib/employee-name";
import { actualHoursWarnings, totalActualHoursByEmployeeDay } from "@/lib/schedule";
import { Card, AlertPill, Button } from "@/components/ui";
import { addActualLaborEntryAction, deleteActualLaborEntryAction } from "@/app/schedule/actions";

/** Actual-hours entry for a single date — supports multiple entries per
 * employee per day (e.g. two different jobs), with soft (non-blocking)
 * warnings for unusually high daily totals or likely duplicate entries. */
export function ActualHoursSection({
  date,
  entries,
  employees,
  projects,
}: {
  date: string;
  entries: ActualLaborEntry[];
  employees: Employee[];
  projects: Project[];
}) {
  const dayEntries = entries.filter((e) => e.work_date === date);
  const warnings = actualHoursWarnings(dayEntries);
  const totals = totalActualHoursByEmployeeDay(dayEntries);
  const employeeById = new Map(employees.map((e) => [e.id, e]));
  const projectById = new Map(projects.map((p) => [p.id, p]));

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-slate-900 uppercase tracking-wide">Actual Hours Worked — {date}</h2>
      </div>

      {warnings.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-3">
          {warnings.map((w, i) => (
            <AlertPill key={i}>{w.message}</AlertPill>
          ))}
        </div>
      )}

      {totals.length === 0 ? (
        <div className="text-sm text-slate-500 mb-3">No actual hours logged yet for this day.</div>
      ) : (
        <div className="space-y-2 mb-4">
          {totals.map((t) => {
            const emp = employeeById.get(t.employee_id);
            return (
              <div key={`${t.employee_id}-${t.work_date}`} className="border border-slate-200 rounded-lg p-2.5">
                <div className="flex items-center justify-between text-sm font-medium text-slate-900">
                  <span>{emp ? employeeDisplayName(emp) : t.employee_id}</span>
                  <span>{t.totalHours} hrs total</span>
                </div>
                <div className="mt-1 space-y-1">
                  {t.entries.map((e) => (
                    <div key={e.id} className="flex items-center justify-between text-xs text-slate-500">
                      <span>
                        {e.project_id ? (projectById.get(e.project_id)?.name ?? e.project_id) : "Driver — no job assigned"} — {e.hours} hrs
                        {e.start_time && e.end_time ? ` (${e.start_time}–${e.end_time})` : ""}
                        {e.notes ? ` · ${e.notes}` : ""}
                      </span>
                      <form action={deleteActualLaborEntryAction.bind(null, e.id)}>
                        <button type="submit" className="text-slate-400 hover:text-rose-600">✕</button>
                      </form>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <form action={addActualLaborEntryAction} className="flex flex-wrap items-end gap-2 border-t border-slate-200 pt-3">
        <input type="hidden" name="work_date" value={date} />
        <div>
          <label className="block text-[10px] text-slate-500 uppercase mb-0.5">Employee</label>
          <select name="employee_id" required className="rounded-md border border-slate-300 px-2 py-1.5 text-sm">
            {employees.map((e) => <option key={e.id} value={e.id}>{employeeDisplayName(e)}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-[10px] text-slate-500 uppercase mb-0.5">Job</label>
          <select name="project_id" required className="rounded-md border border-slate-300 px-2 py-1.5 text-sm max-w-[220px]">
            {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-[10px] text-slate-500 uppercase mb-0.5">Hours</label>
          <input type="number" name="hours" step="0.25" min="0.25" required className="rounded-md border border-slate-300 px-2 py-1.5 text-sm w-20" />
        </div>
        <div>
          <label className="block text-[10px] text-slate-500 uppercase mb-0.5">Start</label>
          <input name="start_time" placeholder="7:00 AM" className="rounded-md border border-slate-300 px-2 py-1.5 text-sm w-24" />
        </div>
        <div>
          <label className="block text-[10px] text-slate-500 uppercase mb-0.5">End</label>
          <input name="end_time" placeholder="3:30 PM" className="rounded-md border border-slate-300 px-2 py-1.5 text-sm w-24" />
        </div>
        <Button type="submit">Log Hours</Button>
      </form>
    </Card>
  );
}
