import { listBuildings, listClientCompanies, listEmployees, listJobRequests, listProjects, listTasks } from "@/lib/db";
import { Card, PageHeader, StatusBadge, Button, EmptyState } from "@/components/ui";
import { todayIso } from "@/lib/dates";
import { addTaskAction, setTaskStatusAction } from "./actions";
import { TASK_STATUSES } from "@/lib/types";
import Link from "next/link";
import { requireSectionAccess } from "@/lib/permissions";
import { AccessDenied } from "@/components/AccessDenied";

const RELATED_HREF: Record<string, (id: string) => string> = {
  project: (id) => `/projects/${id}`,
  job_request: (id) => `/job-requests/${id}`,
  client_company: (id) => `/clients/${id}`,
  building: (id) => `/buildings/${id}`,
  employee: (id) => `/staff/${id}`,
  lead: () => `/new-business`,
};

export default async function TasksPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const access = await requireSectionAccess("tasks");
  if (access === "none") return <AccessDenied section="Tasks" />;

  const { status } = await searchParams;
  const [tasks, projects, jobRequests, buildings, clients, employees] = await Promise.all([
    listTasks(),
    listProjects(),
    listJobRequests(),
    listBuildings(),
    listClientCompanies(),
    listEmployees(),
  ]);
  const today = todayIso();
  const employeeById = new Map(employees.map((e) => [e.id, e]));
  const projectById = new Map(projects.map((p) => [p.id, p]));
  const jobRequestById = new Map(jobRequests.map((j) => [j.id, j]));
  const buildingById = new Map(buildings.map((b) => [b.id, b]));
  const clientById = new Map(clients.map((c) => [c.id, c]));

  function relatedLabel(t: (typeof tasks)[number]) {
    if (!t.related_type || !t.related_id) return null;
    if (t.related_type === "project") return projectById.get(t.related_id)?.name;
    if (t.related_type === "job_request") {
      const jr = jobRequestById.get(t.related_id);
      return jr ? buildingById.get(jr.building_id)?.name : undefined;
    }
    if (t.related_type === "client_company") return clientById.get(t.related_id)?.name;
    if (t.related_type === "building") return buildingById.get(t.related_id)?.name;
    return t.related_type;
  }

  const filtered = status ? tasks.filter((t) => t.status === status) : tasks;
  const sorted = filtered.slice().sort((a, b) => {
    const aOverdue = a.due_date && a.due_date < today && a.status !== "Completed";
    const bOverdue = b.due_date && b.due_date < today && b.status !== "Completed";
    if (aOverdue !== bOverdue) return aOverdue ? -1 : 1;
    return (a.due_date ?? "9999").localeCompare(b.due_date ?? "9999");
  });

  return (
    <div>
      <PageHeader title="Tasks" subtitle={`${tasks.filter((t) => t.status !== "Completed").length} open tasks.`} />

      <Card className="p-4 mb-5">
        <form action={addTaskAction} className="flex flex-wrap gap-2">
          <input name="title" placeholder="Quick add a task…" required className="flex-1 min-w-[200px] rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          <input name="due_date" type="date" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          <Button type="submit">Add</Button>
        </form>
      </Card>

      <div className="flex flex-wrap gap-2 mb-4">
        <Link href="/tasks" className={`text-xs font-medium rounded-full px-3 py-1 border ${!status ? "bg-slate-900 text-white border-slate-900" : "border-slate-300 text-slate-600"}`}>All</Link>
        {TASK_STATUSES.map((s) => (
          <Link key={s} href={`/tasks?status=${encodeURIComponent(s)}`} className={`text-xs font-medium rounded-full px-3 py-1 border ${status === s ? "bg-slate-900 text-white border-slate-900" : "border-slate-300 text-slate-600"}`}>{s}</Link>
        ))}
      </div>

      <Card>
        {sorted.length === 0 ? (
          <EmptyState message="No tasks match this filter." />
        ) : (
          <div className="divide-y divide-slate-100">
            {sorted.map((t) => {
              const overdue = t.due_date && t.due_date < today && t.status !== "Completed";
              const related = relatedLabel(t);
              const href = t.related_type && t.related_id ? RELATED_HREF[t.related_type]?.(t.related_id) : undefined;
              return (
                <div key={t.id} className="px-4 py-3 flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className={`text-sm font-medium ${overdue ? "text-rose-700" : "text-slate-900"}`}>{t.title} {overdue && <span className="text-xs font-semibold ml-1">OVERDUE</span>}</div>
                    <div className="text-xs text-slate-500">
                      {related && href ? <Link href={href} className="hover:underline">{related}</Link> : related}
                      {t.assigned_to && ` · ${employeeById.get(t.assigned_to)?.first_name} ${employeeById.get(t.assigned_to)?.last_name}`}
                      {t.due_date && ` · Due ${t.due_date}`}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge status={t.status} />
                    <div className="flex gap-1">
                      {TASK_STATUSES.filter((s) => s !== t.status).map((s) => (
                        <form key={s} action={setTaskStatusAction.bind(null, t.id, s)}>
                          <button type="submit" className="text-[11px] rounded-full border border-slate-300 px-2 py-0.5 text-slate-500 hover:bg-slate-100">{s}</button>
                        </form>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}
