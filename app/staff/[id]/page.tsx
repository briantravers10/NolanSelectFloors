import { notFound } from "next/navigation";
import Link from "next/link";
import {
  listActualLaborEntries,
  listBuildings,
  listEmployees,
  listEmployeeSkills,
  listProjects,
  listScheduleAssignments,
  listTimeOffForEmployee,
} from "@/lib/db";
import { Card, PageHeader, PhoneLink, EmailLink, Stat, EmptyState, Button } from "@/components/ui";
import { formatCurrency, plannedAssignmentShares, plannedCostOf } from "@/lib/calculations";
import { employeeLaborHistory, payRateLabel } from "@/lib/labor-cost";
import { canEditPayRates, canEditTimeOffAllowance, canViewLaborCost, canViewTimeOffAllowance, getActingUser } from "@/lib/current-user";
import { addDays, dayLabel, formatDateLong, formatDateShort, isoDate, startOfWeek, todayIso } from "@/lib/dates";
import { STAFF_CAPABILITIES, TAX_STATUSES } from "@/lib/types";
import type { TimeOffEntry } from "@/lib/types";
import { computeTimeOffUsage, splitUpcomingAndPast } from "@/lib/time-off";
import { canEdit } from "@/lib/permissions";
import { employeeDisplayName } from "@/lib/employee-name";

function taxStatusLabel(status?: string) {
  return status === "W-4" ? "W-4 Employee" : status === "1099" ? "1099 Contractor" : "Not set";
}
import { AddTimeOffForm } from "@/components/staff/AddTimeOffForm";
import { DeleteStaffButton } from "@/components/staff/DeleteStaffButton";
import { addTimeOffAction, deleteTimeOffAction, deleteStaffAction, setEmployeeActiveAction, updateEmployeeProfileAction, updateEmployeeNicknameAction, updateEmployeePayRateAction, updateEmployeeTaxStatusAction, updateEmployeeTimeOffAllowanceAction } from "../actions";

export default async function StaffDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [employees, skills, assignments, projects, buildings, actualLaborEntries, actingUser, timeOffEntries] = await Promise.all([
    listEmployees(),
    listEmployeeSkills(),
    listScheduleAssignments(),
    listProjects(),
    listBuildings(),
    listActualLaborEntries(),
    getActingUser(),
    listTimeOffForEmployee(id),
  ]);
  const employee = employees.find((e) => e.id === id);
  if (!employee) notFound();
  const canEditStaff = await canEdit("staff");
  const canViewRates = canViewLaborCost(actingUser);
  const canEditRates = canEditPayRates(actingUser);
  const canViewAllowance = canViewTimeOffAllowance(actingUser);
  const canEditAllowance = canEditTimeOffAllowance(actingUser);
  const history = employeeLaborHistory(id, actualLaborEntries, projects);
  const { upcoming: upcomingTimeOff, past: pastTimeOff } = splitUpcomingAndPast(timeOffEntries, todayIso());
  const timeOffUsage = computeTimeOffUsage(timeOffEntries, employee);

  const employeeCapabilities = new Set(skills.filter((s) => s.employee_id === id).map((s) => s.capability));
  const monday = startOfWeek(new Date());
  const weekDates = Array.from({ length: 7 }, (_, i) => isoDate(addDays(monday, i)));
  const weekAssignments = assignments.filter((a) => a.employee_id === id && weekDates.includes(a.schedule_date));
  const normalDays = weekAssignments.filter((a) => !a.time_and_half).length;
  const otDays = weekAssignments.filter((a) => a.time_and_half).length;
  // One day rate per day even when double-booked: cost each assignment at
  // its share of that day's single rate.
  const plannedShares = plannedAssignmentShares(weekAssignments);
  const weeklyCost = plannedCostOf(weekAssignments, plannedShares);
  const projectById = new Map(projects.map((p) => [p.id, p]));
  const buildingById = new Map(buildings.map((b) => [b.id, b]));

  return (
    <div>
      <PageHeader
        title={employeeDisplayName(employee)}
        subtitle={employee.title}
        action={
          <div className="flex gap-3 text-sm">
            <PhoneLink phone={employee.phone} />
            <EmailLink email={employee.email} />
          </div>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {canViewRates && <Stat label="Pay Rate (Actual-Cost)" value={payRateLabel(employee)} />}
        <Stat label="Days Scheduled (This Week)" value={weekAssignments.length} />
        <Stat label="Normal / Time-and-Half" value={`${normalDays} / ${otDays}`} />
        {canViewRates && <Stat label="Projected Weekly Cost (Planned)" value={formatCurrency(weeklyCost)} />}
        {canViewAllowance && (
          <Stat
            label={`Vacation Used (${timeOffUsage.year})`}
            value={`${timeOffUsage.vacationUsed} of ${timeOffUsage.vacationAllowed ?? "—"} days`}
            tone={timeOffUsage.vacationOver ? "bad" : "default"}
          />
        )}
        {canViewAllowance && (
          <Stat
            label={`Sick Used (${timeOffUsage.year})`}
            value={`${timeOffUsage.sickUsed} of ${timeOffUsage.sickAllowed ?? "—"} days`}
            tone={timeOffUsage.sickOver ? "bad" : "default"}
          />
        )}
      </div>
      {canViewAllowance && (timeOffUsage.vacationOver || timeOffUsage.sickOver) && (
        <div className="mb-6 rounded-lg border border-rose-200 bg-rose-50 text-rose-800 text-sm px-3.5 py-2.5">
          ⚠ Over Allowance — {employee.first_name} has used more {timeOffUsage.vacationOver && timeOffUsage.sickOver ? "vacation and sick" : timeOffUsage.vacationOver ? "vacation" : "sick"} days than their {timeOffUsage.year} allowance. There is no email/notification system yet — this in-app banner and badge are the only alert for now.
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 space-y-5">
          <Card className="p-4">
            <h2 className="text-sm font-semibold text-slate-900 uppercase tracking-wide mb-3">Current Week Schedule</h2>
            {weekAssignments.length === 0 ? (
              <EmptyState message="Not scheduled this week." />
            ) : (
              <div className="divide-y divide-slate-100">
                {weekDates.map((date) => {
                  const dayAssignments = weekAssignments.filter((a) => a.schedule_date === date);
                  if (dayAssignments.length === 0) return null;
                  return (
                    <div key={date} className="py-2.5">
                      <div className="text-xs font-semibold text-slate-500 uppercase mb-1">{dayLabel(date)} {date}</div>
                      {dayAssignments.map((a) => {
                        const project = projectById.get(a.project_id);
                        const building = project ? buildingById.get(project.building_id) : undefined;
                        return (
                          <Link key={a.id} href={`/projects/${a.project_id}`} className="flex items-center justify-between text-sm py-1 hover:text-sky-600">
                            <span>{building?.name}{project?.unit_number ? ` — Unit ${project.unit_number}` : ""} · {a.role_on_job}{a.time_and_half ? " (1.5x)" : ""}</span>
                            <span className="text-slate-500">{formatCurrency(plannedShares.get(a.id) ?? a.assignment_cost)}</span>
                          </Link>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
          {canViewRates && (
            <Card className="p-4">
              <h2 className="text-sm font-semibold text-slate-900 uppercase tracking-wide mb-1">Labor History — Actual Work</h2>
              <p className="text-xs text-slate-500 mb-3">Which jobs, hours per job, and allocated labor cost per job — computed from actual hours logged on the Schedule&apos;s End-of-Day Review, never entered here.</p>
              {history.length === 0 ? (
                <EmptyState message="No actual hours logged for this employee yet." />
              ) : (
                <div className="divide-y divide-slate-100 max-h-96 overflow-y-auto">
                  {history.map((day) => (
                    <div key={day.date} className="py-2.5">
                      <div className="flex items-center justify-between text-xs font-semibold text-slate-500 uppercase mb-1">
                        <span>{dayLabel(day.date)} {formatDateShort(day.date)}</span>
                        <span>{day.totalHours} hrs · {formatCurrency(day.totalCost)}</span>
                      </div>
                      {day.jobs.map((j, i) => (
                        <div key={i} className="flex items-center justify-between text-sm py-0.5">
                          <Link href={`/projects/${j.projectId}`} className="hover:text-sky-600">{j.projectName}</Link>
                          <span className="text-slate-500">{j.hours} hrs · {formatCurrency(j.cost)}</span>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </Card>
          )}
          <Card className="p-4">
            <h2 className="text-sm font-semibold text-slate-900 uppercase tracking-wide mb-1">Time Off</h2>
            <p className="text-xs text-slate-500 mb-3">
              A simple log of vacation/sick/personal/unpaid days — no balance or accrual tracking (see README). Scheduling this
              person during a logged time-off range shows a warning on the Crew picker, but never blocks the assignment.
            </p>

            <AddTimeOffForm
              action={addTimeOffAction.bind(null, employee.id)}
              employeeFirstName={employee.first_name}
              vacationUsed={timeOffUsage.vacationUsed}
              vacationAllowed={timeOffUsage.vacationAllowed}
              sickUsed={timeOffUsage.sickUsed}
              sickAllowed={timeOffUsage.sickAllowed}
            />

            {upcomingTimeOff.length === 0 && pastTimeOff.length === 0 ? (
              <EmptyState message="No time off logged for this employee." />
            ) : (
              <div className="space-y-4">
                {upcomingTimeOff.length > 0 && (
                  <div>
                    <div className="text-[11px] font-semibold text-slate-500 uppercase mb-1.5">Upcoming / Current</div>
                    <div className="space-y-1.5">
                      {upcomingTimeOff.map((entry) => (
                        <TimeOffRow key={entry.id} entry={entry} employeeId={employee.id} />
                      ))}
                    </div>
                  </div>
                )}
                {pastTimeOff.length > 0 && (
                  <div>
                    <div className="text-[11px] font-semibold text-slate-500 uppercase mb-1.5">Past</div>
                    <div className="space-y-1.5">
                      {pastTimeOff.map((entry) => (
                        <TimeOffRow key={entry.id} entry={entry} employeeId={employee.id} />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </Card>
          {employee.notes && (
            <Card className="p-4">
              <h2 className="text-sm font-semibold text-slate-900 uppercase tracking-wide mb-2">Notes</h2>
              <p className="text-sm text-slate-700">{employee.notes}</p>
            </Card>
          )}
        </div>

        <Card className="p-4 h-fit">
          {canViewRates && (
            <div className="mb-4 pb-4 border-b border-slate-200">
              <h2 className="text-sm font-semibold text-slate-900 uppercase tracking-wide mb-3">Pay Rate (Actual-Cost)</h2>
              {canEditRates ? (
                <form action={updateEmployeePayRateAction.bind(null, employee.id)} className="space-y-2">
                  <div>
                    <label className="block text-[11px] text-slate-500 uppercase mb-1">Pay Type</label>
                    <select name="pay_type" defaultValue={employee.pay_type} className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm">
                      <option value="daily">Daily Rate</option>
                      <option value="hourly">Hourly Rate</option>
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[11px] text-slate-500 uppercase mb-1">Daily Rate ($)</label>
                      <input name="daily_rate" type="number" step="0.01" defaultValue={employee.daily_rate ?? ""} className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm" />
                    </div>
                    <div>
                      <label className="block text-[11px] text-slate-500 uppercase mb-1">Hourly Rate ($)</label>
                      <input name="hourly_rate" type="number" step="0.01" defaultValue={employee.hourly_rate ?? ""} className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm" />
                    </div>
                  </div>
                  <Button type="submit" variant="secondary" className="text-xs py-1">Save Rate</Button>
                  <p className="text-[11px] text-slate-400">Changing this never affects already-logged actual-hours entries — each one keeps the rate that applied when it was saved (see README).</p>
                </form>
              ) : (
                <div className="text-sm text-slate-800">{payRateLabel(employee)}</div>
              )}
            </div>
          )}
          {canViewAllowance && (
            <div className="mb-4 pb-4 border-b border-slate-200">
              <h2 className="text-sm font-semibold text-slate-900 uppercase tracking-wide mb-3">Annual Time-Off Allowance</h2>
              {canEditAllowance ? (
                <form action={updateEmployeeTimeOffAllowanceAction.bind(null, employee.id)} className="space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[11px] text-slate-500 uppercase mb-1">Vacation Days / Yr</label>
                      <input name="vacation_days_allowed" type="number" min="0" step="1" defaultValue={employee.vacation_days_allowed ?? ""} className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm" />
                    </div>
                    <div>
                      <label className="block text-[11px] text-slate-500 uppercase mb-1">Sick Days / Yr</label>
                      <input name="sick_days_allowed" type="number" min="0" step="1" defaultValue={employee.sick_days_allowed ?? ""} className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm" />
                    </div>
                  </div>
                  <Button type="submit" variant="secondary" className="text-xs py-1">Save Allowance</Button>
                  <p className="text-[11px] text-slate-400">Set per employee — not a flat company-wide number. Leave blank if not tracked for this person yet.</p>
                </form>
              ) : (
                <div className="text-sm text-slate-800">
                  Vacation: {employee.vacation_days_allowed ?? "not set"} days/yr · Sick: {employee.sick_days_allowed ?? "not set"} days/yr
                </div>
              )}
            </div>
          )}
          <h2 className="text-sm font-semibold text-slate-900 uppercase tracking-wide mb-3">Role &amp; Capabilities</h2>
          {canEditStaff ? (
            <form action={updateEmployeeProfileAction.bind(null, employee.id)} className="space-y-2">
              <div>
                <label className="block text-[11px] text-slate-500 uppercase mb-1">Job Title</label>
                <input name="title" defaultValue={employee.title} className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm" />
              </div>
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input type="checkbox" name="is_driver" defaultChecked={employee.is_driver} className="rounded border-slate-300" /> Driver
              </label>
              <div className="space-y-1">
                {STAFF_CAPABILITIES.map((cap) => (
                  <label key={cap} className="flex items-center gap-2 text-sm text-slate-800">
                    <input type="checkbox" name="capabilities" value={cap} defaultChecked={employeeCapabilities.has(cap)} className="rounded border-slate-300" />
                    {cap}
                  </label>
                ))}
              </div>
              <Button type="submit" variant="secondary" className="text-xs py-1">Save</Button>
            </form>
          ) : (
            <div className="space-y-1.5">
              {STAFF_CAPABILITIES.map((cap) => (
                <div key={cap} className="flex items-center gap-2 text-sm">
                  <span className={`inline-flex w-4 h-4 rounded border items-center justify-center text-[10px] ${employeeCapabilities.has(cap) ? "bg-emerald-500 border-emerald-500 text-white" : "border-slate-300"}`}>
                    {employeeCapabilities.has(cap) ? "✓" : ""}
                  </span>
                  <span className={employeeCapabilities.has(cap) ? "text-slate-800" : "text-slate-400"}>{cap}</span>
                </div>
              ))}
            </div>
          )}
          <div className="mt-4 pt-4 border-t border-slate-200 text-sm">
            <div className="flex justify-between items-center mb-1">
              <span className="text-slate-500">Status</span>
              <span className="flex items-center gap-2">
                {employee.active ? "Active" : "Inactive"}
                {canEditStaff && (
                  <form action={setEmployeeActiveAction.bind(null, employee.id, !employee.active)}>
                    <button type="submit" className="text-xs text-sky-600 hover:text-sky-800 underline">
                      {employee.active ? "Mark Inactive" : "Mark Active"}
                    </button>
                  </form>
                )}
              </span>
            </div>
            <div className="flex justify-between"><span className="text-slate-500">Driver</span><span>{employee.is_driver ? "Yes" : "No"}</span></div>
          </div>
          {canEditStaff && (
            <div className="mt-4 pt-4 border-t border-slate-200">
              <DeleteStaffButton action={deleteStaffAction.bind(null, employee.id)} name={`${employee.first_name} ${employee.last_name}`} />
            </div>
          )}
          <div className="mt-4 pt-4 border-t border-slate-200">
            <h2 className="text-sm font-semibold text-slate-900 uppercase tracking-wide mb-2">Nickname</h2>
            {canEditStaff ? (
              <form action={updateEmployeeNicknameAction.bind(null, employee.id)} className="flex items-center gap-2">
                <input name="nickname" defaultValue={employee.nickname ?? ""} placeholder="e.g. Migs" className="flex-1 rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm" />
                <Button type="submit" variant="secondary" className="text-xs py-1">Save</Button>
              </form>
            ) : (
              <div className="text-sm text-slate-800">{employee.nickname || "Not set"}</div>
            )}
            <p className="text-[11px] text-slate-400 mt-1">Shows in brackets after their name on the schedule and is searchable in the crew picker.</p>
          </div>
          <div className="mt-4 pt-4 border-t border-slate-200">
            <h2 className="text-sm font-semibold text-slate-900 uppercase tracking-wide mb-2">Tax Status</h2>
            {canEditStaff ? (
              <form action={updateEmployeeTaxStatusAction.bind(null, employee.id)} className="flex items-center gap-2">
                <select name="tax_status" defaultValue={employee.tax_status ?? ""} className="flex-1 rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm">
                  <option value="">Not set</option>
                  {TAX_STATUSES.map((t) => (
                    <option key={t} value={t}>{t === "W-4" ? "W-4 Employee" : "1099 Contractor"}</option>
                  ))}
                </select>
                <Button type="submit" variant="secondary" className="text-xs py-1">Save</Button>
              </form>
            ) : (
              <div className="text-sm text-slate-800">{taxStatusLabel(employee.tax_status)}</div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}

function TimeOffRow({ entry, employeeId }: { entry: TimeOffEntry; employeeId: string }) {
  const range = entry.start_date === entry.end_date ? formatDateLong(entry.start_date) : `${formatDateShort(entry.start_date)} – ${formatDateLong(entry.end_date)}`;
  return (
    <div className="flex items-start justify-between gap-2 text-sm border border-slate-200 rounded-lg px-2.5 py-2">
      <div>
        <div className="font-medium text-slate-800">{entry.type} <span className="text-slate-500 font-normal">— {range}</span></div>
        {entry.notes && <div className="text-xs text-slate-500 mt-0.5">{entry.notes}</div>}
      </div>
      <form action={deleteTimeOffAction.bind(null, employeeId, entry.id)}>
        <button type="submit" className="text-xs text-slate-400 hover:text-rose-600 shrink-0">Remove</button>
      </form>
    </div>
  );
}
