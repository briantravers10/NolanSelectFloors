import Link from "next/link";
import { listBuildings, listClientCompanies, listJobRequests } from "@/lib/db";
import { Card, PageHeader, StatusBadge, LinkButton, EmptyState } from "@/components/ui";
import { Icon } from "@/components/Icon";
import { JOB_REQUEST_STATUSES } from "@/lib/types";
import { formatDateShort } from "@/lib/dates";
import { BidDashboard } from "./BidDashboard";

const OPEN_STATUSES = JOB_REQUEST_STATUSES.filter((s) => s !== "Converted to Project" && s !== "Declined" && s !== "Cancelled");

export default async function JobRequestsPage({ searchParams }: { searchParams: Promise<{ status?: string; view?: string }> }) {
  const { status, view } = await searchParams;
  const showBidDashboard = view === "bids";

  return (
    <div>
      <PageHeader
        title="Job Requests"
        subtitle={showBidDashboard ? "Who owns which bid, at a glance — no need to open a record to check." : "Incoming work from management companies, from first call to ready-to-schedule."}
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

  const filtered = status ? jobRequests.filter((j) => j.status === status) : jobRequests;
  const columns = status ? [status as string] : OPEN_STATUSES;

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

      <div className={`grid grid-cols-1 ${status ? "" : "md:grid-cols-2 xl:grid-cols-3"} gap-4`}>
        {columns.map((col) => {
          const items = filtered.filter((j) => j.status === col);
          return (
            <div key={col}>
              {!status && <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">{col} ({items.length})</div>}
              <div className="space-y-2.5">
                {items.length === 0 && status && <EmptyState message="No job requests in this status." />}
                {items.map((jr) => {
                  const building = buildingById.get(jr.building_id);
                  const client = building ? clientById.get(building.client_company_id) : undefined;
                  return (
                    <Link key={jr.id} href={`/job-requests/${jr.id}`}>
                      <Card className="p-3 hover:border-sky-300 transition-colors">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="text-sm font-medium text-slate-900 truncate">{building?.name}{jr.unit_number && ` — ${jr.unit_number}`}</div>
                            <div className="text-xs text-slate-500">{client?.name}</div>
                          </div>
                          {status && <StatusBadge status={jr.status} />}
                        </div>
                        <p className="text-xs text-slate-600 mt-1.5 line-clamp-2">{jr.description}</p>
                        <div className="text-[11px] text-slate-400 mt-1.5">Received {formatDateShort(jr.received_at.slice(0, 10))} via {jr.received_via}</div>
                      </Card>
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
