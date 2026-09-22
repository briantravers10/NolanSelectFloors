import Link from "next/link";
import { getDashboardData } from "@/lib/dashboard";
import { formatCurrency } from "@/lib/calculations";
import { formatDateLong } from "@/lib/dates";
import { Card, PageHeader, Stat, StatusBadge, AlertPill, EmptyState } from "@/components/ui";
import { Icon } from "@/components/Icon";
import { requireSectionAccess } from "@/lib/permissions";
import { AccessDenied } from "@/components/AccessDenied";
import { markInvoiceSentAction } from "./actions";
import { Button } from "@/components/ui";
import { canViewLaborCost, getActingUser } from "@/lib/current-user";
import { listOfficeUsers } from "@/lib/db";
import { InvoiceAssigneeSelect } from "@/components/dashboard/InvoiceAssigneeSelect";

export default async function DashboardPage() {
  const access = await requireSectionAccess("dashboard");
  if (access === "none") return <AccessDenied section="the Dashboard" />;

  const [data, actingUser, officeUsers] = await Promise.all([getDashboardData(), getActingUser(), listOfficeUsers()]);
  // Money stays with the office: labor cost and invoices are hidden from
  // field staff, who still get jobs, man count and who's working.
  const showMoney = canViewLaborCost(actingUser);
  const senders = officeUsers
    .filter((u) => u.active && (u.access_role === "office_staff" || u.access_role === "owner_admin"))
    .map((u) => ({ id: u.id, name: u.full_name }))
    .sort((a, b) => a.name.localeCompare(b.name));
  const senderName = (id: string | null) => senders.find((s) => s.id === id)?.name;

  return (
    <div>
      <PageHeader title="Dashboard" subtitle={formatDateLong(data.today)} />

      <div className={`grid grid-cols-2 ${showMoney ? "md:grid-cols-4" : "md:grid-cols-3"} gap-3 mb-6`}>
        <Stat label="Jobs Today" value={data.totalJobs} />
        <Stat label="Man Count Today" value={data.totalManCount} />
        {showMoney && <Stat label="Labor Cost Today" value={formatCurrency(data.totalLaborCost)} />}
        <Stat
          label="Staff Working / Available / Off"
          value={
            <span className="text-lg font-semibold">
              {data.staffWorking} / {data.staffAvailable} / {data.staffOff}
            </span>
          }
        />
      </div>

      {data.emailIntake.staleDays !== null && data.emailIntake.staleDays >= 7 && (
        <Card className="p-4 mb-5 border-rose-300 bg-rose-50">
          <div className="flex items-center gap-2 mb-1">
            <Icon name="alert" className="w-4 h-4 text-rose-700" />
            <h2 className="text-sm font-semibold text-rose-900 uppercase tracking-wide">Email intake may have stopped</h2>
          </div>
          <p className="text-sm text-rose-900">
            No forwarded email has reached the app in {data.emailIntake.staleDays} days. If drawings and invoices are still arriving in Gmail, the forwarding rule has probably been switched off or Google asked Aidan to re-verify it.
            Check Gmail → Settings → Forwarding and POP/IMAP, and the filter under Filters and Blocked Addresses.
          </p>
        </Card>
      )}

      {showMoney && data.invoicesToSend.length > 0 && (
        <Card className="p-4 mb-5 border-amber-300 bg-amber-50">
          <div className="flex items-center gap-2 mb-2">
            <Icon name="alert" className="w-4 h-4 text-amber-700" />
            <h2 className="text-sm font-semibold text-amber-900 uppercase tracking-wide">
              Invoices to send — {data.invoicesToSend.length} completed {data.invoicesToSend.length === 1 ? "job" : "jobs"}
            </h2>
          </div>
          <div className="divide-y divide-amber-200">
            {data.invoicesToSend.map((j) => (
              <div key={j.projectId} className="py-2 flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <Link href={`/projects/${j.projectId}`} className="text-sm font-medium text-slate-900 hover:text-sky-700">{j.name}</Link>
                  <div className="text-xs text-slate-600">
                    {j.clientName ?? "No management company"}
                    {j.completedOn ? ` · completed ${formatDateLong(j.completedOn)}` : ""}
                    {j.value ? ` · ${formatCurrency(j.value)}` : ""}
                    {j.assignedTo && senderName(j.assignedTo) ? <span className="ml-1 font-medium text-amber-900">· {senderName(j.assignedTo)} is sending it</span> : null}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <InvoiceAssigneeSelect projectId={j.projectId} assignedTo={j.assignedTo} people={senders} />
                  <form action={markInvoiceSentAction.bind(null, j.projectId, true)}>
                    <Button type="submit" variant="secondary" className="text-xs py-1.5">Mark as Sent</Button>
                  </form>
                </div>
              </div>
            ))}
          </div>
          <p className="text-[11px] text-amber-800 mt-2">Marking a job here clears it from everyone&apos;s dashboard. Undo from the job page if it was a mistake.</p>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 space-y-5">
          <Card className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-slate-900 uppercase tracking-wide">Today&apos;s Jobs</h2>
              <Link href="/schedule" className="text-sm text-sky-600 hover:underline">
                View schedule →
              </Link>
            </div>
            {data.todaysJobs.length === 0 ? (
              <EmptyState message="No crew scheduled today." />
            ) : (
              <div className="space-y-3">
                {data.todaysJobs.map((job) => (
                  <Link
                    key={job.project.id}
                    href={`/projects/${job.project.id}`}
                    className="block rounded-lg border border-slate-200 p-3 hover:border-sky-300 hover:bg-sky-50/40 transition-colors"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <div className="font-medium text-slate-900">
                          {job.buildingName} {job.project.unit_number && <span className="text-slate-500 font-normal">— Unit {job.project.unit_number}</span>}
                        </div>
                        <div className="text-xs text-slate-500">{job.clientName} · PM: {job.pmName}</div>
                      </div>
                      <StatusBadge status={job.project.pipeline_stage} />
                    </div>
                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600">
                      <span>{job.project.name}</span>
                      <span>Crew: {job.manCount}</span>
                      {showMoney && <span>Labor: {formatCurrency(job.laborCost)}</span>}
                      {job.materialsWorstStatus && job.materialsWorstStatus !== "Delivered" && (
                        <span className="text-amber-600">Materials: {job.materialsWorstStatus}</span>
                      )}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {job.crew.map((c, i) => (
                        <span key={i} className="text-[11px] bg-slate-100 rounded px-1.5 py-0.5 text-slate-600">
                          {c.name} · {c.role}{c.isDriver ? " 🚚" : ""}
                        </span>
                      ))}
                    </div>
                    {job.notes && <div className="mt-2 text-xs text-slate-500 italic">{job.notes}</div>}
                  </Link>
                ))}
              </div>
            )}
          </Card>

          <Card className="p-4">
            <h2 className="text-sm font-semibold text-slate-900 uppercase tracking-wide mb-3">Upcoming (Next 7 Days)</h2>
            {data.upcomingProjects.length === 0 ? (
              <EmptyState message="Nothing scheduled to start in the next 7 days." />
            ) : (
              <div className="divide-y divide-slate-100">
                {data.upcomingProjects.map(({ project, building }) => (
                  <Link key={project.id} href={`/projects/${project.id}`} className="flex items-center justify-between py-2.5 hover:bg-slate-50 -mx-1 px-1 rounded">
                    <div>
                      <div className="text-sm font-medium text-slate-800">{building?.name} {project.unit_number && `— Unit ${project.unit_number}`}</div>
                      <div className="text-xs text-slate-500">{project.name}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm text-slate-700">{project.start_date}</div>
                      <StatusBadge status={project.pipeline_stage} />
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </Card>
        </div>

        <Card className="p-4 h-fit">
          <div className="flex items-center gap-2 mb-3">
            <Icon name="alert" className="w-4 h-4 text-amber-600" />
            <h2 className="text-sm font-semibold text-slate-900 uppercase tracking-wide">Attention Required</h2>
          </div>
          {data.attention.length === 0 ? (
            <EmptyState message="Nothing needs attention right now." />
          ) : (
            <ul className="space-y-2.5">
              {data.attention.map((item, i) => (
                <li key={i}>
                  <Link href={item.href} className="flex items-start gap-2 group">
                    <AlertPill tone={item.severity}>{item.severity === "bad" ? "Action" : "Watch"}</AlertPill>
                    <span className="text-sm text-slate-700 group-hover:text-sky-700 group-hover:underline">{item.message}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
