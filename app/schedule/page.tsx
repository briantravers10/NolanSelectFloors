import Link from "next/link";
import {
  listBuildings,
  listClientCompanies,
  listCrewRequirements,
  listEmployeeAvailability,
  listEmployees,
  listEmployeeSkills,
  listProjectMaterials,
  listProjects,
  listScheduleAssignments,
} from "@/lib/db";
import { Card, PageHeader, Button, EmptyState } from "@/components/ui";
import {
  compareCrewForProjectDate,
  findDoubleBookings,
  formatCurrency,
  isMissingDriver,
  summarizeDay,
  summarizeWeek,
} from "@/lib/calculations";
import { addDays, dayLabel, formatDateShort, isoDate, startOfWeek, todayIso } from "@/lib/dates";
import { AssignmentForm } from "@/components/schedule/AssignmentForm";
import { SendScheduleButton } from "@/components/schedule/SendScheduleButton";
import { removeAssignmentAction } from "./actions";

export default async function SchedulePage({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  const { date: dateParam } = await searchParams;
  const anchor = dateParam ? new Date(dateParam + "T00:00:00") : new Date();
  const monday = startOfWeek(anchor);
  const weekDates = Array.from({ length: 7 }, (_, i) => isoDate(addDays(monday, i)));
  const today = todayIso();

  const [
    projects,
    buildings,
    clients,
    employees,
    employeeSkills,
    availability,
    crewRequirements,
    assignments,
    projectMaterials,
  ] = await Promise.all([
    listProjects(),
    listBuildings(),
    listClientCompanies(),
    listEmployees(),
    listEmployeeSkills(),
    listEmployeeAvailability(),
    listCrewRequirements(),
    listScheduleAssignments(),
    listProjectMaterials(),
  ]);

  const buildingById = new Map(buildings.map((b) => [b.id, b]));
  const clientById = new Map(clients.map((c) => [c.id, c]));
  const employeeById = new Map(employees.map((e) => [e.id, e]));
  const projectById = new Map(projects.map((p) => [p.id, p]));

  const weekSummary = summarizeWeek(assignments, weekDates);
  const doubleBookings = findDoubleBookings(assignments).filter((db) => weekDates.includes(db.schedule_date));
  const activeProjects = projects.filter((p) => !["Completed", "Invoiced", "Paid"].includes(p.status));

  // Night-before send preview: the next date in the week that has assignments and is >= today.
  const nextDate = weekDates.find((d) => d >= today && assignments.some((a) => a.schedule_date === d)) ?? weekDates[0];
  const nextDateAssignments = assignments.filter((a) => a.schedule_date === nextDate);
  const messageLines = [`Nolan Select Floors — Schedule for ${nextDate}`, ""];
  const byEmployee = new Map<string, typeof nextDateAssignments>();
  for (const a of nextDateAssignments) {
    if (!byEmployee.has(a.employee_id)) byEmployee.set(a.employee_id, []);
    byEmployee.get(a.employee_id)!.push(a);
  }
  for (const [empId, list] of byEmployee) {
    const emp = employeeById.get(empId);
    for (const a of list) {
      const project = projectById.get(a.project_id);
      const building = project ? buildingById.get(project.building_id) : undefined;
      messageLines.push(`${emp?.first_name} ${emp?.last_name}: ${building?.name ?? ""}${project?.unit_number ? " Unit " + project.unit_number : ""} — ${a.role_on_job}${a.time_and_half ? " (time-and-half)" : ""}`);
    }
  }
  const scheduleMessage = messageLines.join("\n");

  const prevWeek = isoDate(addDays(monday, -7));
  const nextWeek = isoDate(addDays(monday, 7));

  return (
    <div>
      <PageHeader
        title="Schedule"
        subtitle={`Week of ${formatDateShort(weekDates[0])} – ${formatDateShort(weekDates[6])}`}
        action={
          <div className="flex flex-wrap gap-2">
            <Link href={`/schedule?date=${prevWeek}`}><Button variant="secondary">← Prev Week</Button></Link>
            <Link href={`/schedule?date=${isoDate(new Date())}`}><Button variant="secondary">This Week</Button></Link>
            <Link href={`/schedule?date=${nextWeek}`}><Button variant="secondary">Next Week →</Button></Link>
            <SendScheduleButton message={scheduleMessage} />
          </div>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        <Card className="p-3">
          <div className="text-xs text-slate-500 uppercase">Week Man-Days</div>
          <div className="text-xl font-semibold">{weekSummary.totalManDays}</div>
        </Card>
        <Card className="p-3">
          <div className="text-xs text-slate-500 uppercase">Week Labor Cost</div>
          <div className="text-xl font-semibold">{formatCurrency(weekSummary.totalLaborCost)}</div>
        </Card>
        <Card className="p-3">
          <div className="text-xs text-slate-500 uppercase">Normal Rate</div>
          <div className="text-xl font-semibold">{formatCurrency(weekSummary.totalNormalCost)}</div>
        </Card>
        <Card className="p-3">
          <div className="text-xs text-slate-500 uppercase">Time-and-Half</div>
          <div className="text-xl font-semibold text-amber-600">{formatCurrency(weekSummary.totalTimeAndHalfCost)}</div>
        </Card>
      </div>

      {doubleBookings.length > 0 && (
        <Card className="p-3 mb-5 border-rose-200 bg-rose-50">
          <div className="text-sm font-semibold text-rose-700 mb-1">⚠ Double-booking detected this week</div>
          <ul className="text-sm text-rose-700 list-disc list-inside">
            {doubleBookings.map((db, i) => {
              const emp = employeeById.get(db.employee_id);
              return (
                <li key={i}>
                  {emp?.first_name} {emp?.last_name} on {db.schedule_date}: {db.project_ids.map((pid) => projectById.get(pid)?.name ?? pid).join(" AND ")}
                </li>
              );
            })}
          </ul>
        </Card>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-4 gap-5">
        <div className="xl:col-span-3 space-y-4">
          {weekDates.map((date) => {
            const dayAssignments = assignments.filter((a) => a.schedule_date === date);
            const daySummary = summarizeDay(assignments, date);
            const dayProjectIds = Array.from(new Set(dayAssignments.map((a) => a.project_id)));
            return (
              <Card key={date} className={`p-4 ${date === today ? "ring-2 ring-sky-400" : ""}`}>
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <div className="font-semibold text-slate-900">{dayLabel(date)} <span className="text-slate-400 font-normal">{date}</span></div>
                  </div>
                  <div className="text-xs text-slate-500">{daySummary.manCount} crew · {formatCurrency(daySummary.laborCost)}{daySummary.timeAndHalfDays > 0 && ` (${formatCurrency(daySummary.timeAndHalfCost)} @ 1.5x)`}</div>
                </div>
                {dayProjectIds.length === 0 ? (
                  <EmptyState message="No crew scheduled." />
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {dayProjectIds.map((projectId) => {
                      const project = projectById.get(projectId);
                      if (!project) return null;
                      const building = buildingById.get(project.building_id);
                      const client = building ? clientById.get(building.client_company_id) : undefined;
                      const crew = dayAssignments.filter((a) => a.project_id === projectId);
                      const crewComparison = compareCrewForProjectDate(crewRequirements, assignments, projectId, date);
                      const missingDriver = isMissingDriver(project, assignments, employees, projectId, date);
                      const materials = projectMaterials.filter((m) => m.project_id === projectId);
                      const undelivered = materials.filter((m) => m.status !== "Delivered" && m.status !== "Returned").length;
                      const dayCost = crew.reduce((s, a) => s + a.assignment_cost, 0);
                      return (
                        <div key={projectId} className="border border-slate-200 rounded-lg p-3">
                          <Link href={`/projects/${projectId}`} className="font-medium text-sm text-slate-900 hover:text-sky-600">
                            {building?.name}{project.unit_number ? ` — Unit ${project.unit_number}` : ""}
                          </Link>
                          <div className="text-xs text-slate-500 mb-1.5">{client?.name}</div>
                          <div className="text-xs text-slate-600 mb-1.5">Crew {crew.length} · {formatCurrency(dayCost)}</div>
                          <div className="flex flex-wrap gap-1 mb-1.5">
                            {crew.map((a) => {
                              const emp = employeeById.get(a.employee_id);
                              return (
                                <form key={a.id} action={removeAssignmentAction.bind(null, a.id, projectId)}>
                                  <button type="submit" title="Remove assignment" className="text-[11px] bg-slate-100 hover:bg-rose-100 hover:text-rose-700 rounded px-1.5 py-0.5 text-slate-600">
                                    {emp?.first_name} {emp?.last_name?.[0]}. · {a.role_on_job}{a.time_and_half ? " · 1.5x" : ""} ✕
                                  </button>
                                </form>
                              );
                            })}
                          </div>
                          <div className="flex flex-wrap gap-1">
                            {crewComparison.filter((c) => !c.complete).map((c) => (
                              <span key={c.role} className="text-[11px] rounded px-1.5 py-0.5 bg-rose-50 text-rose-700">⚠ Missing {c.missing} {c.role}</span>
                            ))}
                            {missingDriver && <span className="text-[11px] rounded px-1.5 py-0.5 bg-rose-50 text-rose-700 font-medium">⚠ NO DRIVER</span>}
                            {undelivered > 0 && <span className="text-[11px] rounded px-1.5 py-0.5 bg-amber-50 text-amber-700">{undelivered} material(s) pending</span>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </Card>
            );
          })}
        </div>

        <Card className="p-4 h-fit sticky top-20">
          <h2 className="text-sm font-semibold text-slate-900 uppercase tracking-wide mb-3">Assign Crew</h2>
          <AssignmentForm
            projects={activeProjects}
            employees={employees.filter((e) => e.active)}
            employeeSkills={employeeSkills}
            assignments={assignments}
            availability={availability}
            defaultDate={today}
          />
        </Card>
      </div>
    </div>
  );
}
