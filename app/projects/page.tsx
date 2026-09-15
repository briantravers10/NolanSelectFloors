import Link from "next/link";
import { listBuildings, listClientCompanies, listProjects, listScheduleAssignments } from "@/lib/db";
import { Card, PageHeader, StatusBadge } from "@/components/ui";
import { formatCurrency } from "@/lib/calculations";
import { PIPELINE_STAGES, PROJECT_STATUSES } from "@/lib/types";
import { projectLaborCost } from "@/lib/calculations";
import { Pipeline } from "./Pipeline";

export default async function ProjectsPage({ searchParams }: { searchParams: Promise<{ status?: string; view?: string; stage?: string }> }) {
  const { status, view, stage } = await searchParams;
  const showPipeline = view === "pipeline";

  return (
    <div>
      <PageHeader title="Projects" subtitle={showPipeline ? "Drag-free kanban across the 6 primary lifecycle stages." : "Every project, in one list."} />

      <div className="flex flex-wrap gap-2 mb-4 border-b border-slate-200 pb-3">
        <Link href={`/projects${stage ? `?stage=${encodeURIComponent(stage)}` : ""}`} className={`text-sm font-medium rounded-lg px-3 py-1.5 ${!showPipeline ? "bg-slate-900 text-white" : "text-slate-500 hover:bg-slate-100"}`}>
          List
        </Link>
        <Link href={`/projects?view=pipeline${stage ? `&stage=${encodeURIComponent(stage)}` : ""}`} className={`text-sm font-medium rounded-lg px-3 py-1.5 ${showPipeline ? "bg-slate-900 text-white" : "text-slate-500 hover:bg-slate-100"}`}>
          Pipeline
        </Link>
      </div>

      {/* Sub-navigation by pipeline stage — jump straight to "Scheduled",
          "Project In Process", etc. instead of scanning the whole list/board. */}
      <div className="flex flex-wrap gap-2 mb-5">
        <Link
          href={showPipeline ? "/projects?view=pipeline" : "/projects"}
          className={`text-xs font-medium rounded-full px-3 py-1 border ${!stage ? "bg-slate-900 text-white border-slate-900" : "border-slate-300 text-slate-600"}`}
        >
          All Stages
        </Link>
        {PIPELINE_STAGES.map((s) => (
          <Link
            key={s}
            href={`/projects?${showPipeline ? "view=pipeline&" : ""}stage=${encodeURIComponent(s)}`}
            className={`text-xs font-medium rounded-full px-3 py-1 border ${stage === s ? "bg-slate-900 text-white border-slate-900" : "border-slate-300 text-slate-600"}`}
          >
            {s}
          </Link>
        ))}
      </div>

      {showPipeline ? <Pipeline stageFilter={stage} /> : <ProjectsList status={status} stage={stage} />}
    </div>
  );
}

async function ProjectsList({ status, stage }: { status?: string; stage?: string }) {
  const [projects, buildings, clients, assignments] = await Promise.all([
    listProjects(),
    listBuildings(),
    listClientCompanies(),
    listScheduleAssignments(),
  ]);
  const buildingById = new Map(buildings.map((b) => [b.id, b]));
  const clientById = new Map(clients.map((c) => [c.id, c]));

  let filtered = projects.slice();
  if (stage) filtered = filtered.filter((p) => p.pipeline_stage === stage);
  if (status) filtered = filtered.filter((p) => p.status === status);
  filtered.sort((a, b) => (b.start_date ?? "").localeCompare(a.start_date ?? ""));

  return (
    <div>
      <div className="flex flex-wrap gap-2 mb-5">
        <Link href={stage ? `/projects?stage=${encodeURIComponent(stage)}` : "/projects"} className={`text-xs font-medium rounded-full px-3 py-1 border ${!status ? "bg-slate-900 text-white border-slate-900" : "border-slate-300 text-slate-600"}`}>
          All Statuses
        </Link>
        {PROJECT_STATUSES.map((s) => (
          <Link key={s} href={`/projects?status=${encodeURIComponent(s)}${stage ? `&stage=${encodeURIComponent(stage)}` : ""}`} className={`text-xs font-medium rounded-full px-3 py-1 border ${status === s ? "bg-slate-900 text-white border-slate-900" : "border-slate-300 text-slate-600"}`}>
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
                <th className="px-4 py-3">Stage</th>
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
                    <td className="px-4 py-3"><StatusBadge status={p.pipeline_stage} /></td>
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
