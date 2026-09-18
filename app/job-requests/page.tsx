import Link from "next/link";
import { listBuildings, listClientCompanies, listJobRequests } from "@/lib/db";
import { Card, PageHeader, StatusBadge, LinkButton, EmptyState } from "@/components/ui";
import { Icon } from "@/components/Icon";
import type { JobRequestStatus } from "@/lib/types";
import { getActingUser } from "@/lib/current-user";
import { formatDateLong } from "@/lib/dates";
import { daysBetween, todayIso } from "@/lib/dates";
import { requireSectionAccess } from "@/lib/permissions";
import { AccessDenied } from "@/components/AccessDenied";

const CLOSED: JobRequestStatus[] = ["Converted to Project", "Archived", "Declined", "Cancelled"];
const isOpen = (s: JobRequestStatus) => !CLOSED.includes(s);
// A job request open this long without resolution is flagged as overdue —
// keeps urgent/stale requests visually flagged even though the list
// defaults to newest-first.
const OVERDUE_DAYS = 5;

export default async function JobRequestsPage({ searchParams }: { searchParams: Promise<{ filter?: string }> }) {
  const access = await requireSectionAccess("job_requests");
  if (access === "none") return <AccessDenied section="Job Requests" />;
  const { filter } = await searchParams;
  return (
    <div>
      <PageHeader
        title="Job Requests"
        subtitle="Incoming work. Start a request to put it under your name, then create the job when the details are in."
        action={<LinkButton href="/job-requests/new"><Icon name="plus" className="w-4 h-4" />New Job Request</LinkButton>}
      />
      <JobRequestsList filter={filter} />
    </div>
  );
}

async function JobRequestsList({ filter }: { filter?: string }) {
  const [jobRequests, buildings, clients, actingUser] = await Promise.all([listJobRequests(), listBuildings(), listClientCompanies(), getActingUser()]);
  const buildingById = new Map(buildings.map((b) => [b.id, b]));
  const clientById = new Map(clients.map((c) => [c.id, c]));
  const today = todayIso();

  const tab = filter === "mine" || filter === "created" || filter === "archived" ? filter : "open";
  const filtered = jobRequests
    .filter((j) => {
      if (tab === "mine") return isOpen(j.status) && j.started_by_user_id === actingUser.id;
      if (tab === "created") return j.status === "Converted to Project";
      if (tab === "archived") return j.status === "Archived" || j.status === "Declined" || j.status === "Cancelled";
      return isOpen(j.status);
    })
    .slice()
    .sort((a, b) => (a.received_at < b.received_at ? 1 : -1)); // most recent first
  const counts = {
    open: jobRequests.filter((j) => isOpen(j.status)).length,
    mine: jobRequests.filter((j) => isOpen(j.status) && j.started_by_user_id === actingUser.id).length,
    created: jobRequests.filter((j) => j.status === "Converted to Project").length,
    archived: jobRequests.filter((j) => j.status === "Archived" || j.status === "Declined" || j.status === "Cancelled").length,
  };
  const pill = (key: string, label: string, n: number) => (
    <Link
      key={key}
      href={key === "open" ? "/job-requests" : `/job-requests?filter=${key}`}
      className={`text-xs font-medium rounded-full px-3 py-1 border ${tab === key ? "bg-slate-900 text-white border-slate-900" : "border-slate-300 text-slate-600"}`}
    >
      {label} · {n}
    </Link>
  );

  return (
    <div>
      <div className="flex flex-wrap gap-2 mb-5">
        {pill("open", "Open", counts.open)}
        {pill("mine", "Mine", counts.mine)}
        {pill("created", "Job Created", counts.created)}
        {pill("archived", "Archived", counts.archived)}
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
              const overdue = ageDays >= OVERDUE_DAYS && isOpen(jr.status);
              const displayStatus = jr.status === "Converted to Project" ? "Job Created" : jr.status;
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
                      <StatusBadge status={displayStatus} />
                      <div className="text-[11px] text-slate-400 mt-1">Received {formatDateLong(jr.received_at.slice(0, 10))} · via {jr.received_via}</div>
                      {jr.started_by_name && <div className="text-[11px] text-sky-700 mt-0.5">Started by {jr.started_by_name}</div>}
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
