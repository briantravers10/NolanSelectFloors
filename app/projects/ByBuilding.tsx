import Link from "next/link";
import { listBuildings, listClientCompanies, listProjects } from "@/lib/db";
import { Card, StatusBadge, EmptyState } from "@/components/ui";
import { formatCurrency } from "@/lib/calculations";

/**
 * "Jobs" view of the SAME project data as the List/Pipeline tabs — grouped
 * by building, and within each building ordered by unit number (numeric
 * prefix first, then any letter suffix — "3B" before "12A" — falling back
 * to start date for units that tie or have no unit number at all). Not a
 * separate Jobs concept: every row here is the exact same `projects` row
 * shown on /projects and /projects/[id].
 */
export async function ByBuilding({ stageFilter }: { stageFilter?: string } = {}) {
  const [projects, buildings, clients] = await Promise.all([listProjects(), listBuildings(), listClientCompanies()]);
  const clientById = new Map(clients.map((c) => [c.id, c]));

  const filtered = stageFilter ? projects.filter((p) => p.pipeline_stage === stageFilter) : projects;

  const buildingsWithJobs = buildings
    .filter((b) => filtered.some((p) => p.building_id === b.id))
    .sort((a, b) => a.name.localeCompare(b.name));

  if (buildingsWithJobs.length === 0) {
    return <EmptyState message="No jobs match this stage." />;
  }

  return (
    <div className="space-y-6">
      {buildingsWithJobs.map((building) => {
        const jobs = filtered.filter((p) => p.building_id === building.id).sort(compareByUnitThenDate);
        const client = clientById.get(building.client_company_id);
        return (
          <Card key={building.id} className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <Link href={`/buildings/${building.id}`} className="font-medium text-slate-900 hover:text-sky-600">
                  {building.name}
                </Link>
                <div className="text-xs text-slate-500">{client?.name}</div>
              </div>
              <div className="text-xs text-slate-400">{jobs.length} job{jobs.length === 1 ? "" : "s"}</div>
            </div>
            <div className="divide-y divide-slate-100">
              {jobs.map((p) => (
                <Link key={p.id} href={`/projects/${p.id}`} className="flex items-center justify-between py-2.5 hover:bg-slate-50 -mx-1 px-1 rounded gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-slate-800 truncate">
                      {p.unit_number ? `Unit ${p.unit_number}` : p.name}
                    </div>
                    <div className="text-xs text-slate-500 truncate">{p.name} · {p.start_date ?? "no start date"}</div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-sm text-slate-700">{formatCurrency(p.project_value)}</div>
                    <StatusBadge status={p.status} />
                  </div>
                </Link>
              ))}
            </div>
          </Card>
        );
      })}
    </div>
  );
}

/** Splits a unit like "12A" into { num: 12, suffix: "A" } for a sensible
 * numeric-then-alphanumeric sort. Units with no leading number (e.g.
 * "Lobby", "Roof") sort after all numbered units, alphabetically. */
function parseUnit(unit?: string): { num: number | null; suffix: string } {
  if (!unit) return { num: null, suffix: "" };
  const match = unit.trim().match(/^(\d+)\s*([A-Za-z]*)/);
  if (!match) return { num: null, suffix: unit.trim().toUpperCase() };
  return { num: parseInt(match[1], 10), suffix: match[2].toUpperCase() };
}

function compareByUnitThenDate(a: { unit_number?: string; start_date?: string }, b: { unit_number?: string; start_date?: string }): number {
  const ua = parseUnit(a.unit_number);
  const ub = parseUnit(b.unit_number);
  if (ua.num !== null && ub.num !== null) {
    if (ua.num !== ub.num) return ua.num - ub.num;
    if (ua.suffix !== ub.suffix) return ua.suffix.localeCompare(ub.suffix);
  } else if (ua.num !== null) {
    return -1; // numbered units sort before non-numbered/missing units
  } else if (ub.num !== null) {
    return 1;
  } else if (ua.suffix !== ub.suffix) {
    return ua.suffix.localeCompare(ub.suffix);
  }
  // Tie (same unit, or both un-numbered with the same/no label) — order
  // chronologically by start date.
  return (a.start_date ?? "").localeCompare(b.start_date ?? "");
}
