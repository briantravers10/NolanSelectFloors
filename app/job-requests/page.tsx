import Link from "next/link";
import { listBuildings, listClientCompanies, listJobRequests } from "@/lib/db";
import { Card, PageHeader, StatusBadge, LinkButton, EmptyState } from "@/components/ui";
import { Icon } from "@/components/Icon";
import { JOB_REQUEST_STATUSES, type JobRequestStatus } from "@/lib/types";
import { formatDateLong } from "@/lib/dates";
import { daysBetween, todayIso } from "@/lib/dates";
import { BidDashboard } from "./BidDashboard";

const OPEN_STATUSES: JobRequestStatus[] = JOB_REQUEST_STATUSES.filter((s) => s !== "Converted to Project" && s !== "Declined" && s !== "Cancelled");
// A job request open this long without resolution is flagged as overdue —
// keeps urgent/stale requests visually flagged even though the list
// defaults to newest-first.
const OVERDUE_DAYS = 5;

export default async function JobRequestsPage({ searchParams }: { searchParams: Promise<{ status?: string; view?: string }> }) {
  const { status, view } = await searchParams;
  const showBidDashboard = view === "bids";

  return (
    <div>
      <PageHeader
        title="Job Requests"
        subtitle={showBidDashboard ? "Who owns which bid, at a glance — no need to open a record to check." : "Incoming work from management companies, most recent first."}
        action={<LinkButton href="/job-requests/new"><Icon name="plus" className="w-4 h-4" />New Job Request</LinkButton>}
      />

      <div className="flex flex-wrap gap-2 mb-5 border-b border-slate-200 pb-3">
        <Link
          href="/job-requests"
          className={`text-sm font-medium rounded-lg px-3 py-1.5 ${!showBidDashboard ? "bg-slate-900 text-white" : "text-slate-500 hover:bg-slate-100"}`}
        >
          Requests
        </Link>
        <Link
          href="/job-requests?view=bids"
          className={`text-sm font-medium rounded-lg px-3 py-1.5 ${showBidDashboard ? "bg-slate-900 text-white" : "text-slate-500 hover:bg-slate-100"}`}
        >
          Bid Dashboard
        </Link>
      </div>

      {showBidDashboard ? <BidDashboard /> : <JobRequestsList status={status} /> }
    </div>
  );
}

async function JobRequestsList({ status }: { status?: string }) {
  const [jobRequests, buildings, clients] = await Promise.all([listJobRequests(), listBuildings(), listClientCompanies()]);
  const buildingById = new Map(buildings.map((b) => [b.id, b]));
  const clientById = new Map(clients.map((c) => [c.id, c]));
  const today = todayIso();

  const filtered = (status ? jobRequests.filter((j) => j.status === status) : jobRequests.filter((j) => OPEN_STATUSES.includes(j.status)))
    .slice()
    .sort((a, b) => (a.received_at < b.received_at ? 1 : -1)); // most recent first

  return (
    <div>
      <div className="flex flex-wrap gap-2 mb-5">
        <Link href="/job-requests" className={`text-xs font-medium rounded-full px-3 py-1 border ${!status ? "bg-slate-900 text-white border-slate-900" : "border-slate-300 text-slate-600"}`}>
          All Open
        </Link>
        {JOB_REQUEST_STATUSES.map((s) => (
          <Link key={s} href={`/job-requests?status=${encodeURIComponent(s)}`} className={`text-xs font-medium rounded-full px-3 py-1 border ${status === s ? "bg-slate-900 text-white border-slate-900" : "border-slate-300 text-slate-600"}`}>
            {s}
          </Link>
        ))}
      </div>

      <Card>
        {filtered.length === 0 ? (
          <EmptyState message="No job requests match this filter." />
        ) : (
          <div className="divide-y divide-slate-100">
            {filtered.map((jr) => {
              const building = buildingById.get(jr.building_id);
              const client = building ? clientById.get(building.client_company_id) : undefined;
              const ageDays = daysBetween(jr.received_at.slice(0, 10), today);
              const overdue = ageDays >= OVERDUE_DAYS && jr.status !== "Converted to Project" && jr.status !== "Declined" && jr.status !== "Cancelled";
              return (
                <Link key={jr.id} href={`/job-requests/${jr.id}`} className="block px-4 py-3 hover:bg-slate-50">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-slate-900 truncate">
                          {building?.name}{jr.unit_number && ` — ${jr.unit_number}`}
                        </span>
                        {overdue && <span className="text-[10px] font-semibold uppercase text-rose-700 bg-rose-50 rounded-full px-1.5 py-0.5 shrink-0">Overdue</span>}
                      </div>
                      <div className="text-xs text-slate-500">{client?.name}</div>
                      <p className="text-sm text-slate-600 mt-1 line-clamp-1">{jr.description}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <StatusBadge status={jr.status} />
                      <div className="text-[11px] text-slate-400 mt-1">Received {formatDateLong(jr.received_at.slice(0, 10))} · via {jr.received_via}</div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}
