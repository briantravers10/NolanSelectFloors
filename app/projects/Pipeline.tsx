import Link from "next/link";
import { listBuildings, listClientCompanies, listOfficeUsers, listProjects } from "@/lib/db";
import { Card, StatusBadge, EmptyState } from "@/components/ui";
import { formatCurrency } from "@/lib/calculations";
import { PIPELINE_STAGES } from "@/lib/types";
import { movePipelineStageFormAction } from "./actions";

/**
 * Visual Project Pipeline — a kanban across the 5 simplified lifecycle
 * stages (Bid Sent, Bid Accepted, Scheduled, In Progress, Complete — see
 * README "Project Pipeline Stage Simplification"). Cards link straight to
 * the existing project detail page, and
 * the "Move to" dropdown updates the SAME projects row shown there and on
 * the Bid Dashboard (verified: both read from lib/db.ts#listProjects()).
 *
 * Native HTML5 drag-and-drop was deliberately skipped in favor of this
 * dropdown — it works with zero client JS, needs no library, and is more
 * reliable than a hand-rolled DnD implementation under time constraints.
 * See README "What was deliberately simplified" for the tradeoff note.
 */
export async function Pipeline({ stageFilter }: { stageFilter?: string } = {}) {
  const [projects, buildings, clients, officeUsers] = await Promise.all([
    listProjects(),
    listBuildings(),
    listClientCompanies(),
    listOfficeUsers(),
  ]);
  const buildingById = new Map(buildings.map((b) => [b.id, b]));
  const clientById = new Map(clients.map((c) => [c.id, c]));
  const officeUserById = new Map(officeUsers.map((u) => [u.id, u]));

  const visibleStages = stageFilter ? PIPELINE_STAGES.filter((s) => s === stageFilter) : PIPELINE_STAGES;

  return (
    <div className={`grid grid-cols-1 md:grid-cols-2 ${stageFilter ? "" : "xl:grid-cols-5"} gap-4`}>
      {visibleStages.map((stage) => {
        const items = projects.filter((p) => p.pipeline_stage === stage);
        return (
          <div key={stage} className="min-w-0">
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
              {stage} ({items.length})
            </div>
            <div className="space-y-2.5">
              {items.length === 0 && <EmptyState message="No projects at this stage." />}
              {items.map((p) => {
                const building = buildingById.get(p.building_id);
                const client = building ? clientById.get(building.client_company_id) : undefined;
                const estimator = p.assigned_estimator_id ? officeUserById.get(p.assigned_estimator_id) : undefined;
                return (
                  <Card key={p.id} className="p-3">
                    <Link href={`/projects/${p.id}`} className="block hover:text-sky-600">
                      <div className="text-sm font-medium text-slate-900 truncate">
                        {building?.name}
                        {p.unit_number && ` — ${p.unit_number}`}
                      </div>
                      <div className="text-xs text-slate-500 mb-1.5 truncate">{client?.name}</div>
                    </Link>
                    <div className="flex flex-wrap gap-1.5 mb-1.5">
                      <StatusBadge status={p.bid_status} />
                    </div>
                    <div className="text-[11px] text-slate-400 mb-2">
                      {formatCurrency(p.project_value)} · {estimator?.full_name ?? "Unassigned"}
                    </div>
                    <form action={movePipelineStageFormAction.bind(null, p.id)} className="flex gap-1.5">
                      <select name="stage" defaultValue="" className="flex-1 min-w-0 rounded-lg border border-slate-300 px-1.5 py-1 text-[11px]">
                        <option value="" disabled>Move to…</option>
                        {PIPELINE_STAGES.filter((s) => s !== stage).map((s) => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                      <button type="submit" className="text-[11px] rounded-lg border border-slate-300 px-2 py-1 text-slate-600 hover:bg-slate-100 shrink-0">
                        Move
                      </button>
                    </form>
                  </Card>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
