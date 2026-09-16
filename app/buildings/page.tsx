import Link from "next/link";
import { listBuildings, listClientCompanies, listProjects } from "@/lib/db";
import { Card, PageHeader, LinkButton } from "@/components/ui";
import { Icon } from "@/components/Icon";
import { BUILDING_REGIONS } from "@/lib/types";
import { isActiveProjectStage } from "@/lib/calculations";
import { BuildingMapLoader, type MapPin } from "@/components/BuildingMapLoader";

export default async function BuildingsPage({ searchParams }: { searchParams: Promise<{ region?: string; view?: string }> }) {
  const { region, view } = await searchParams;
  const showMap = view === "map";
  const [buildings, clients, projects] = await Promise.all([listBuildings(), listClientCompanies(), listProjects()]);
  const clientById = new Map(clients.map((c) => [c.id, c]));

  const regionsPresent = BUILDING_REGIONS.filter((r) => buildings.some((b) => b.region === r));
  const filtered = region ? buildings.filter((b) => b.region === region) : buildings;

  const pins: MapPin[] = filtered
    .filter((b) => b.latitude != null && b.longitude != null)
    .map((b) => ({
      id: b.id,
      lat: b.latitude as number,
      lng: b.longitude as number,
      label: b.name,
      sublabel: `${b.address}, ${b.city}, ${b.state}`,
      region: b.region,
      href: `/buildings/${b.id}`,
    }));

  return (
    <div>
      <PageHeader
        title="Buildings"
        subtitle={`${buildings.length} buildings across ${clients.length} management companies.`}
        action={
          <div className="flex gap-2">
            <LinkButton href="/buildings/haul-away" variant="secondary">
              <Icon name="truck" className="w-4 h-4" /> Haul-Away Run
            </LinkButton>
            <LinkButton href="/buildings/new">
              <Icon name="plus" className="w-4 h-4" /> New Building
            </LinkButton>
          </div>
        }
      />

      <div className="flex flex-wrap gap-2 mb-5 border-b border-slate-200 pb-3">
        <Link href={`/buildings${region ? `?region=${encodeURIComponent(region)}` : ""}`} className={`text-sm font-medium rounded-lg px-3 py-1.5 ${!showMap ? "bg-slate-900 text-white" : "text-slate-500 hover:bg-slate-100"}`}>
          List
        </Link>
        <Link href={`/buildings?view=map${region ? `&region=${encodeURIComponent(region)}` : ""}`} className={`text-sm font-medium rounded-lg px-3 py-1.5 ${showMap ? "bg-slate-900 text-white" : "text-slate-500 hover:bg-slate-100"}`}>
          Map
        </Link>
      </div>

      <div className="flex flex-wrap gap-2 mb-5">
        <Link href={`/buildings${showMap ? "?view=map" : ""}`} className={`text-xs font-medium rounded-full px-3 py-1 border ${!region ? "bg-slate-900 text-white border-slate-900" : "border-slate-300 text-slate-600"}`}>
          All Regions
        </Link>
        {regionsPresent.map((r) => (
          <Link
            key={r}
            href={`/buildings?region=${encodeURIComponent(r)}${showMap ? "&view=map" : ""}`}
            className={`text-xs font-medium rounded-full px-3 py-1 border ${region === r ? "bg-slate-900 text-white border-slate-900" : "border-slate-300 text-slate-600"}`}
          >
            {r} ({buildings.filter((b) => b.region === r).length})
          </Link>
        ))}
      </div>

      {showMap ? (
        <>
          <BuildingMapLoader pins={pins} />
          <p className="text-xs text-slate-500 mt-2">
            {pins.length} building{pins.length === 1 ? "" : "s"} plotted · pins colored by region · click a pin to open the building.
          </p>
        </>
      ) : region ? (
        <BuildingGrid buildings={filtered} clientById={clientById} projects={projects} />
      ) : (
        <div className="space-y-8">
          {regionsPresent.map((r) => (
            <div key={r}>
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">{r} ({buildings.filter((b) => b.region === r).length})</div>
              <BuildingGrid buildings={buildings.filter((b) => b.region === r)} clientById={clientById} projects={projects} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function BuildingGrid({
  buildings,
  clientById,
  projects,
}: {
  buildings: Awaited<ReturnType<typeof listBuildings>>;
  clientById: Map<string, Awaited<ReturnType<typeof listClientCompanies>>[number]>;
  projects: Awaited<ReturnType<typeof listProjects>>;
}) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
      {buildings.map((b) => {
        const activeJobs = projects.filter((p) => p.building_id === b.id && isActiveProjectStage(p)).length;
        return (
          <Link key={b.id} href={`/buildings/${b.id}`}>
            <Card className="p-4 h-full hover:border-sky-300 hover:shadow-md transition-all">
              <div className="font-medium text-slate-900">{b.name}</div>
              <div className="text-sm text-slate-500 mt-0.5">{b.address}, {b.city}, {b.state} {b.zip}</div>
              <div className="flex items-center gap-2 mt-2">
                <span className="text-[11px] rounded-full bg-slate-100 text-slate-600 px-2 py-0.5">{b.region}</span>
                <span className="text-xs text-sky-700">{clientById.get(b.client_company_id)?.name}</span>
              </div>
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
  );
}
