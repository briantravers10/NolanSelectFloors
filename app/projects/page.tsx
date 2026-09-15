import Link from "next/link";
import { listBuildings, listClientCompanies, listProjects, listScheduleAssignments } from "@/lib/db";
import { Card, PageHeader, StatusBadge } from "@/components/ui";
import { formatCurrency } from "@/lib/calculations";
import { PROJECT_STATUSES } from "@/lib/types";
import { projectLaborCost } from "@/lib/calculations";

export default async function ProjectsPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const { status } = await searchParams;
  const [projects, buildings, clients, assignments] = await Promise.all([
    listProjects(),
    listBuildings(),
    listClientCompanies(),
    listScheduleAssignments(),
  ]);
  const buildingById = new Map(buildings.map((b) => [b.id, b]));
  const clientById = new Map(clients.map((c) => [c.id, c]));

  const filtered = (status ? projects.filter((p) => p.status === status) : projects)
    .slice()
    .sort((a, b) => (b.start_date ?? "").localeCompare(a.start_date ?? ""));

  return (
    <div>
      <PageHeader title="Projects" subtitle={`${projects.length} projects across the pipeline.`} />

      <div className="flex flex-wrap gap-2 mb-5">
        <Link href="/projects" className={`text-xs font-medium rounded-full px-3 py-1 border ${!status ? "bg-slate-900 text-white border-slate-900" : "border-slate-300 text-slate-600"}`}>
          All
        </Link>
        {PROJECT_STATUSES.map((s) => (
          <Link key={s} href={`/projects?status=${encodeURIComponent(s)}`} className={`text-xs font-medium rounded-full px-3 py-1 border ${status === s ? "bg-slate-900 text-white border-slate-900" : "border-slate-300 text-slate-600"}`}>
            {s}
          </Link>
        ))}
      </div>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-slate-500 uppercase tracking-wide border-b border-slate-200">
                <th className="px-4 py-3">Project</th>
                <th className="px-4 py-3">Building</th>
                <th className="px-4 py-3">Management Co.</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Start</th>
                <th className="px-4 py-3 text-right">Value</th>
                <th className="px-4 py-3 text-right">Labor Cost</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => {
                const building = buildingById.get(p.building_id);
                const client = building ? clientById.get(building.client_company_id) : undefined;
                return (
                  <tr key={p.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <Link href={`/projects/${p.id}`} className="font-medium text-slate-900 hover:text-sky-600">
                        {p.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{building?.name}</td>
                    <td className="px-4 py-3 text-slate-600">{client?.name}</td>
                    <td className="px-4 py-3"><StatusBadge status={p.status} /></td>
                    <td className="px-4 py-3 text-slate-600">{p.start_date ?? "—"}</td>
                    <td className="px-4 py-3 text-right">{formatCurrency(p.project_value)}</td>
                    <td className="px-4 py-3 text-right">{formatCurrency(projectLaborCost(assignments, p.id))}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
