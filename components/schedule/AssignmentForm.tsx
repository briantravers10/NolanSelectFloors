"use client";

import { useMemo, useState } from "react";
import { addAssignmentAction } from "@/app/schedule/actions";
import { Button } from "@/components/ui";
import { STAFF_CAPABILITIES } from "@/lib/types";
import type { Employee, EmployeeSkill, Project, ScheduleAssignment, EmployeeAvailability } from "@/lib/types";
import { formatCurrency } from "@/lib/calculations";

export function AssignmentForm({
  projects,
  employees,
  employeeSkills,
  assignments,
  availability,
  defaultDate,
}: {
  projects: Project[];
  employees: Employee[];
  employeeSkills: EmployeeSkill[];
  assignments: ScheduleAssignment[];
  availability: EmployeeAvailability[];
  defaultDate: string;
}) {
  const [employeeId, setEmployeeId] = useState(employees[0]?.id ?? "");
  const [date, setDate] = useState(defaultDate);
  const [timeAndHalf, setTimeAndHalf] = useState(false);
  const [role, setRole] = useState<string>(STAFF_CAPABILITIES[0]);

  const employee = employees.find((e) => e.id === employeeId);
  const skillsByEmployee = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const s of employeeSkills) {
      if (!map.has(s.employee_id)) map.set(s.employee_id, []);
      map.get(s.employee_id)!.push(s.capability);
    }
    return map;
  }, [employeeSkills]);

  const conflict = useMemo(() => {
    if (!employeeId || !date) return null;
    const existing = assignments.filter((a) => a.employee_id === employeeId && a.schedule_date === date);
    if (existing.length > 0) {
      const projectNames = existing.map((a) => projects.find((p) => p.id === a.project_id)?.name ?? a.project_id).join(", ");
      return `Already booked on ${date}: ${projectNames}`;
    }
    const avail = availability.find((a) => a.employee_id === employeeId && a.schedule_date === date);
    if (avail && avail.status !== "working" && avail.status !== "available") {
      return `Marked ${avail.status.replace("_", " ")} on ${date}`;
    }
    return null;
  }, [employeeId, date, assignments, availability, projects]);

  const cost = employee ? employee.day_rate * (timeAndHalf ? 1.5 : 1) : 0;

  return (
    <form action={addAssignmentAction} className="space-y-3">
      <div>
        <label className="block text-[11px] text-slate-500 uppercase mb-1">Project</label>
        <select name="project_id" required className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm">
          {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-[11px] text-slate-500 uppercase mb-1">Date</label>
          <input type="date" name="schedule_date" value={date} onChange={(e) => setDate(e.target.value)} required className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm" />
        </div>
        <div>
          <label className="block text-[11px] text-slate-500 uppercase mb-1">Role on Job</label>
          <select name="role_on_job" value={role} onChange={(e) => setRole(e.target.value)} className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm">
            {STAFF_CAPABILITIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      </div>
      <div>
        <label className="block text-[11px] text-slate-500 uppercase mb-1">Call Time (used in Send Schedule preview)</label>
        <input name="call_time" placeholder="7:00 AM" defaultValue="7:00 AM" className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm" />
      </div>
      <div>
        <label className="block text-[11px] text-slate-500 uppercase mb-1">Employee</label>
        <select name="employee_id" value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} required className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm">
          {employees.map((e) => (
            <option key={e.id} value={e.id}>
              {e.first_name} {e.last_name} — {e.title}{e.is_driver ? " (Driver)" : ""} — {formatCurrency(e.day_rate)}/day
            </option>
          ))}
        </select>
        {employee && (
          <div className="text-xs text-slate-500 mt-1">
            Capabilities: {(skillsByEmployee.get(employee.id) ?? []).join(", ") || "—"}
          </div>
        )}
        {conflict && <div className="text-xs text-rose-600 font-medium mt-1">⚠ {conflict}</div>}
      </div>
      <label className="flex items-center gap-2 text-sm text-slate-700">
        <input type="checkbox" name="time_and_half" checked={timeAndHalf} onChange={(e) => setTimeAndHalf(e.target.checked)} className="rounded border-slate-300" />
        Time and a half
      </label>
      <div className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
        <span className="text-xs text-slate-500 uppercase">Cost Preview</span>
        <span className="text-sm font-semibold text-slate-900">{formatCurrency(cost)}</span>
      </div>
      <Button type="submit" className="w-full justify-center">Assign to Job</Button>
    </form>
  );
}
