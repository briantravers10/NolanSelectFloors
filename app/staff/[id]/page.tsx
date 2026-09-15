import { notFound } from "next/navigation";
import Link from "next/link";
import {
  listBuildings,
  listEmployees,
  listEmployeeSkills,
  listProjects,
  listScheduleAssignments,
} from "@/lib/db";
import { Card, PageHeader, PhoneLink, EmailLink, Stat, EmptyState } from "@/components/ui";
import { formatCurrency } from "@/lib/calculations";
import { addDays, dayLabel, isoDate, startOfWeek } from "@/lib/dates";
import { STAFF_CAPABILITIES } from "@/lib/types";

export default async function StaffDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [employees, skills, assignments, projects, buildings] = await Promise.all([
    listEmployees(),
    listEmployeeSkills(),
    listScheduleAssignments(),
    listProjects(),
    listBuildings(),
  ]);
  const employee = employees.find((e) => e.id === id);
  if (!employee) notFound();

  const employeeCapabilities = new Set(skills.filter((s) => s.employee_id === id).map((s) => s.capability));
  const monday = startOfWeek(new Date());
  const weekDates = Array.from({ length: 7 }, (_, i) => isoDate(addDays(monday, i)));
  const weekAssignments = assignments.filter((a) => a.employee_id === id && weekDates.includes(a.schedule_date));
  const normalDays = weekAssignments.filter((a) => !a.time_and_half).length;
  const otDays = weekAssignments.filter((a) => a.time_and_half).length;
  const weeklyCost = weekAssignments.reduce((sum, a) => sum + a.assignment_cost, 0);
  const projectById = new Map(projects.map((p) => [p.id, p]));
  const buildingById = new Map(buildings.map((b) => [b.id, b]));

  return (
    <div>
      <PageHeader
        title={`${employee.first_name} ${employee.last_name}`}
        subtitle={employee.title}
        action={
          <div className="flex gap-3 text-sm">
            <PhoneLink phone={employee.phone} />
            <EmailLink email={employee.email} />
          </div>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <Stat label="Day Rate" value={formatCurrency(employee.day_rate)} />
        <Stat label="Days Scheduled (This Week)" value={weekAssignments.length} />
        <Stat label="Normal / Time-and-Half" value={`${normalDays} / ${otDays}`} />
        <Stat label="Projected Weekly Cost" value={formatCurrency(weeklyCost)} />
      </div>

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
                            <span className="text-slate-500">{formatCurrency(a.assignment_cost)}</span>
                          </Link>
                        );
                      })}
                    </div>
                  );
                })}
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
          <h2 className="text-sm font-semibold text-slate-900 uppercase tracking-wide mb-3">Capabilities</h2>
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
          <div className="mt-4 pt-4 border-t border-slate-200 text-sm">
            <div className="flex justify-between mb-1"><span className="text-slate-500">Status</span><span>{employee.active ? "Active" : "Inactive"}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">Driver</span><span>{employee.is_driver ? "Yes" : "No"}</span></div>
          </div>
        </Card>
      </div>
    </div>
  );
}
