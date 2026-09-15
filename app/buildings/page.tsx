import Link from "next/link";
import { listBuildings, listClientCompanies, listProjects } from "@/lib/db";
import { Card, PageHeader } from "@/components/ui";

export default async function BuildingsPage() {
  const [buildings, clients, projects] = await Promise.all([listBuildings(), listClientCompanies(), listProjects()]);
  const clientById = new Map(clients.map((c) => [c.id, c]));

  const activeStatuses = new Set(["Approved", "Pre-Construction", "Materials Required", "Materials Ordered", "Materials Ready", "Ready to Schedule", "Scheduled", "In Progress", "Paused", "Punch List"]);

  return (
    <div>
      <PageHeader title="Buildings" subtitle={`${buildings.length} buildings across ${clients.length} management companies.`} />
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        {buildings.map((b) => {
          const activeJobs = projects.filter((p) => p.building_id === b.id && activeStatuses.has(p.status)).length;
          return (
            <Link key={b.id} href={`/buildings/${b.id}`}>
              <Card className="p-4 h-full hover:border-sky-300 hover:shadow-md transition-all">
                <div className="font-medium text-slate-900">{b.name}</div>
                <div className="text-sm text-slate-500 mt-0.5">{b.address}, {b.city}, {b.state} {b.zip}</div>
                <div className="text-xs text-sky-700 mt-2">{clientById.get(b.client_company_id)?.name}</div>
                {activeJobs > 0 && (
                  <div className="mt-2 inline-flex items-center rounded-full bg-blue-100 text-blue-700 text-xs px-2 py-0.5">
                    {activeJobs} active job{activeJobs > 1 ? "s" : ""}
                  </div>
                )}
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
