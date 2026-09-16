import { listBuildings, listClientCompanies, listProjects } from "@/lib/db";
import { PageHeader } from "@/components/ui";
import { HaulAwayPlanner } from "@/components/buildings/HaulAwayPlanner";
import { isLiveRoutingConfigured } from "@/lib/routing";
import { isActiveProjectStage } from "@/lib/calculations";

export default async function HaulAwayRunPage() {
  const [projects, buildings, clients] = await Promise.all([listProjects(), listBuildings(), listClientCompanies()]);
  const buildingById = new Map(buildings.map((b) => [b.id, b]));
  const clientById = new Map(clients.map((c) => [c.id, c]));

  const candidates = projects
    .filter(isActiveProjectStage)
    .map((p) => {
      const building = buildingById.get(p.building_id);
      return { project: p, building, client: building ? clientById.get(building.client_company_id) : undefined };
    })
    .filter((c) => c.building && c.building.latitude != null && c.building.longitude != null);

  return (
    <div>
      <PageHeader
        title="Haul-Away Run"
        subtitle="Pick active job sites needing old-floor debris pickup for a day, and plot the run."
      />
      <HaulAwayPlanner
        candidates={candidates.map((c) => ({
          projectId: c.project.id,
          projectName: c.project.name,
          unitNumber: c.project.unit_number,
          buildingName: c.building!.name,
          buildingHref: `/buildings/${c.building!.id}`,
          clientName: c.client?.name,
          region: c.building!.region,
          lat: c.building!.latitude as number,
          lng: c.building!.longitude as number,
        }))}
        liveRoutingConfigured={isLiveRoutingConfigured()}
      />
    </div>
  );
}
