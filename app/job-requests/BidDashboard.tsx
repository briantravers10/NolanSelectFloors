import Link from "next/link";
import {
  listBuildings,
  listClientCompanies,
  listOfficeUsers,
  listProjects,
} from "@/lib/db";
import { getActingUser } from "@/lib/current-user";
import { Card, StatusBadge, EmptyState } from "@/components/ui";
import { formatCurrency } from "@/lib/calculations";
import { formatDateLong, daysBetween, todayIso } from "@/lib/dates";
import type { Project } from "@/lib/types";

interface BidColumn {
  key: string;
  label: string;
  filter: (p: Project, myId: string) => boolean;
}

const COLUMNS: BidColumn[] = [
  { key: "unclaimed", label: "Unclaimed", filter: (p) => p.bid_status === "Unclaimed" },
  { key: "mine", label: "My Bids", filter: (p, myId) => p.assigned_estimator_id === myId },
  { key: "in_progress", label: "In Progress", filter: (p) => p.bid_status === "Claimed" || p.bid_status === "In Progress" },
  { key: "ready", label: "Ready / Completed", filter: (p) => p.bid_status === "Ready for Review" },
  { key: "awaiting", label: "Awaiting Decision", filter: (p) => p.bid_status === "Completed/Sent" },
];

/** Simple derived priority — no dedicated schema column: a bid still
 * unclaimed/unresolved after a week is flagged High so staff can triage
 * without opening every record. */
function derivePriority(p: Project): "High" | "Normal" {
  if (p.bid_status === "Accepted" || p.bid_status === "Rejected") return "Normal";
  const ageDays = daysBetween(p.created_at.slice(0, 10), todayIso());
  return ageDays >= 7 ? "High" : "Normal";
}

export async function BidDashboard() {
  const [projects, buildings, clients, officeUsers, actingUser] = await Promise.all([
    listProjects(),
    listBuildings(),
    listClientCompanies(),
    listOfficeUsers(),
    getActingUser(),
  ]);
  const buildingById = new Map(buildings.map((b) => [b.id, b]));
  const clientById = new Map(clients.map((c) => [c.id, c]));
  const officeUserById = new Map(officeUsers.map((u) => [u.id, u]));

  return (
    <div>
      <p className="text-sm text-slate-500 mb-4">
        Viewing as <strong>{actingUser.fullName}</strong> ({actingUser.role === "manager" ? "Manager/Owner" : "Estimator"}). Switch who
        you&apos;re acting as from the top bar.
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4">
        {COLUMNS.map((col) => {
          const items = projects
            .filter((p) => col.filter(p, actingUser.id))
            .slice()
            .sort((a, b) => (a.updated_at < b.updated_at ? 1 : -1)); // most recent first, per section
          return (
            <div key={col.key}>
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                {col.label} ({items.length})
              </div>
              <Card>
                {items.length === 0 ? (
                  <EmptyState message="Nothing here." />
                ) : (
                  <div className="divide-y divide-slate-100">
                    {items.map((p) => {
                      const building = buildingById.get(p.building_id);
                      const client = building ? clientById.get(building.client_company_id) : undefined;
                      const estimator = p.assigned_estimator_id ? officeUserById.get(p.assigned_estimator_id) : undefined;
                      const priority = derivePriority(p);
                      return (
                        <Link key={p.id} href={`/projects/${p.id}`} className="block px-3 py-2.5 hover:bg-slate-50">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <div className="text-sm font-medium text-slate-900 truncate">
                                {building?.name}{p.unit_number && ` — ${p.unit_number}`}
                              </div>
                              <div className="text-xs text-slate-500 truncate">{client?.name}</div>
                            </div>
                            {priority === "High" && (
                              <span className="text-[10px] font-semibold uppercase text-rose-600 shrink-0">High</span>
                            )}
                          </div>
                          <div className="flex items-center justify-between mt-1.5">
                            <StatusBadge status={p.bid_status} />
                            <span className="text-[11px] text-slate-400">{formatCurrency(p.project_value)}</span>
                          </div>
                          <div className="text-[11px] text-slate-400 mt-1">
                            {estimator?.full_name ?? "Unassigned"}
                            {p.claimed_at ? ` · claimed ${formatDateLong(p.claimed_at.slice(0, 10))}` : ""}
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                )}
              </Card>
            </div>
          );
        })}
      </div>
    </div>
  );
}
