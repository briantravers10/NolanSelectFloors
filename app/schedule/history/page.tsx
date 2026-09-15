import { listActivityLog, listEmployees, listProjects } from "@/lib/db";
import { Card, PageHeader, EmptyState } from "@/components/ui";
import { isScheduleActivity } from "@/lib/schedule";
import { ScheduleSubNav } from "@/components/schedule/ScheduleSubNav";

export default async function ScheduleHistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; user?: string; project?: string; employee?: string }>;
}) {
  const { date, user, project, employee } = await searchParams;
  const [activityLog, projects, employees] = await Promise.all([listActivityLog(), listProjects(), listEmployees()]);
  const projectById = new Map(projects.map((p) => [p.id, p]));
  const employeeById = new Map(employees.map((e) => [e.id, e]));

  let entries = activityLog.filter((a) => isScheduleActivity(a.action));
  if (date) entries = entries.filter((a) => a.created_at.startsWith(date));
  if (user) entries = entries.filter((a) => (a.actor_name ?? "").toLowerCase().includes(user.toLowerCase()));
  if (project) {
    entries = entries.filter((a) => a.related_type === "project" && (a.related_id === project || (projectById.get(a.related_id ?? "")?.name ?? "").toLowerCase().includes(project.toLowerCase())));
  }
  if (employee) {
    entries = entries.filter((a) => {
      const emp = a.related_type === "employee" ? employeeById.get(a.related_id ?? "") : undefined;
      const empName = emp ? `${emp.first_name} ${emp.last_name}` : "";
      return empName.toLowerCase().includes(employee.toLowerCase()) || (a.detail ?? "").toLowerCase().includes(employee.toLowerCase());
    });
  }

  return (
    <div>
      <PageHeader title="Change History" subtitle="Every schedule change — who, when, what, before → after." />
      <ScheduleSubNav active="history" />

      <Card className="p-4 mb-4">
        <form className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <div>
            <label className="block text-[11px] text-slate-500 uppercase mb-1">Date</label>
            <input type="date" name="date" defaultValue={date} className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm" />
          </div>
          <div>
            <label className="block text-[11px] text-slate-500 uppercase mb-1">User</label>
            <input name="user" defaultValue={user} placeholder="Name" className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm" />
          </div>
          <div>
            <label className="block text-[11px] text-slate-500 uppercase mb-1">Job / Project</label>
            <input name="project" defaultValue={project} placeholder="Name or ID" className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm" />
          </div>
          <div>
            <label className="block text-[11px] text-slate-500 uppercase mb-1">Employee</label>
            <input name="employee" defaultValue={employee} placeholder="Name" className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm" />
          </div>
          <div className="sm:col-span-4">
            <button type="submit" className="rounded-lg bg-sky-600 text-white px-3.5 py-2 text-sm font-medium hover:bg-sky-700">Filter</button>
          </div>
        </form>
      </Card>

      {entries.length === 0 ? (
        <EmptyState message="No schedule activity matches these filters." />
      ) : (
        <Card className="divide-y divide-slate-100">
          {entries.map((a) => (
            <div key={a.id} className="px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                <div className="text-sm font-medium text-slate-900">{a.action}</div>
                <div className="text-xs text-slate-400 whitespace-nowrap">{new Date(a.created_at).toLocaleString()}</div>
              </div>
              <div className="text-xs text-slate-500 mt-0.5">
                {a.actor_name ?? "Unknown"}
                {a.related_type === "project" && projectById.get(a.related_id ?? "") ? ` · ${projectById.get(a.related_id ?? "")!.name}` : ""}
              </div>
              {a.detail && <div className="text-sm text-slate-700 mt-1">{a.detail}</div>}
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}
