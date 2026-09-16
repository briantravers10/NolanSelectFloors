import Link from "next/link";
import { listBuildings, listProjectMaterials, listProjects } from "@/lib/db";
import { Card, PageHeader, StatusBadge, EmptyState } from "@/components/ui";
import { formatCurrency, isActiveProjectStage } from "@/lib/calculations";
import { addDays, isoDate, todayIso } from "@/lib/dates";
import { MATERIAL_STATUSES } from "@/lib/types";

export default async function MaterialsPage() {
  const [projectMaterials, projects, buildings] = await Promise.all([listProjectMaterials(), listProjects(), listBuildings()]);
  const projectById = new Map(projects.map((p) => [p.id, p]));
  const buildingById = new Map(buildings.map((b) => [b.id, b]));

  const today = todayIso();
  const soon = isoDate(addDays(new Date(), 5));
  const activeMaterials = projectMaterials.filter((m) => {
    const p = projectById.get(m.project_id);
    return p && isActiveProjectStage(p);
  });

  const warnings = activeMaterials.filter((m) => {
    const p = projectById.get(m.project_id);
    if (!p?.start_date) return false;
    return p.start_date >= today && p.start_date <= soon && m.status !== "Delivered" && m.status !== "Returned";
  });

  return (
    <div>
      <PageHeader title="Materials" subtitle="Tracking materials across every active project." />

      {warnings.length > 0 && (
        <Card className="p-4 mb-5 border-amber-200 bg-amber-50">
          <div className="text-sm font-semibold text-amber-800 mb-2">Delivery Warnings — jobs starting soon without delivered materials</div>
          <ul className="text-sm text-amber-800 space-y-1">
            {warnings.map((m) => {
              const p = projectById.get(m.project_id);
              const b = p ? buildingById.get(p.building_id) : undefined;
              return (
                <li key={m.id}>
                  <Link href={`/projects/${p?.id}`} className="hover:underline">
                    {b?.name} ({p?.name}) starts {p?.start_date} — {m.description} still {m.status}
                  </Link>
                </li>
              );
            })}
          </ul>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-5">
        {MATERIAL_STATUSES.map((status) => {
          const count = activeMaterials.filter((m) => m.status === status).length;
          if (count === 0) return null;
          return (
            <Card key={status} className="p-3">
              <div className="text-xs text-slate-500 uppercase">{status}</div>
              <div className="text-xl font-semibold">{count}</div>
            </Card>
          );
        })}
      </div>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-slate-500 uppercase tracking-wide border-b border-slate-200">
                <th className="px-4 py-3">Project</th>
                <th className="px-4 py-3">Material</th>
                <th className="px-4 py-3">Supplier</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Expected</th>
                <th className="px-4 py-3 text-right">Cost</th>
              </tr>
            </thead>
            <tbody>
              {activeMaterials.length === 0 && (
                <tr><td colSpan={6}><EmptyState message="No materials tracked yet." /></td></tr>
              )}
              {activeMaterials.map((m) => {
                const p = projectById.get(m.project_id);
                const b = p ? buildingById.get(p.building_id) : undefined;
                return (
                  <tr key={m.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <Link href={`/projects/${p?.id}`} className="text-slate-900 hover:text-sky-600 font-medium">{b?.name}</Link>
                      <div className="text-xs text-slate-500">{p?.name}</div>
                    </td>
                    <td className="px-4 py-3 text-slate-700">{m.description}</td>
                    <td className="px-4 py-3 text-slate-500">{m.supplier ?? "—"}</td>
                    <td className="px-4 py-3"><StatusBadge status={m.status} /></td>
                    <td className="px-4 py-3 text-slate-500">{m.expected_delivery ?? "—"}</td>
                    <td className="px-4 py-3 text-right">{formatCurrency(m.cost)}</td>
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
