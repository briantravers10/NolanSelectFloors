import Link from "next/link";
import { listProjects, listQuickBooksSyncLog } from "@/lib/db";
import { canViewQuickBooksSyncLog, getActingUser } from "@/lib/current-user";
import { Card, PageHeader, EmptyState, StatusBadge } from "@/components/ui";
import { formatJobNumber } from "@/lib/calculations";

/** Admin-only Sync Log view — every meaningful QuickBooks action
 * (connected, disconnected, customer linked/created, estimate/invoice
 * created/linked, sync run, webhook processed). See lib/db.ts
 * logQuickBooksSyncEvent() / README "QuickBooks Online Integration —
 * Sync Log". */
export default async function QuickBooksSyncLogPage() {
  const actingUser = await getActingUser();
  if (!canViewQuickBooksSyncLog(actingUser)) {
    return (
      <div>
        <PageHeader title="QuickBooks Sync Log" />
        <EmptyState message="Only Owner/Admin can view the Sync Log." />
      </div>
    );
  }

  const [log, projects] = await Promise.all([listQuickBooksSyncLog(), listProjects()]);
  const projectById = new Map(projects.map((p) => [p.id, p]));

  return (
    <div>
      <PageHeader title="QuickBooks Sync Log" subtitle="Every connection, customer, and document action taken through the QuickBooks integration." />
      <div className="mb-4">
        <Link href="/company-setup/quickbooks" className="text-sm text-sky-600 hover:underline">← Back to QuickBooks Settings</Link>
      </div>

      <Card className="p-4">
        {log.length === 0 ? (
          <EmptyState message="No QuickBooks activity logged yet." />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-slate-500 uppercase border-b border-slate-200">
                <th className="py-1.5">When</th>
                <th className="py-1.5">Action</th>
                <th className="py-1.5">Job</th>
                <th className="py-1.5">Document</th>
                <th className="py-1.5">Result</th>
                <th className="py-1.5">By</th>
              </tr>
            </thead>
            <tbody>
              {log.map((entry) => (
                <tr key={entry.id} className="border-b border-slate-100 last:border-0 align-top">
                  <td className="py-1.5 whitespace-nowrap text-xs text-slate-500">{new Date(entry.created_at).toLocaleString()}</td>
                  <td className="py-1.5">{entry.action}</td>
                  <td className="py-1.5">
                    {entry.project_id ? (
                      <Link href={`/projects/${entry.project_id}`} className="text-sky-600 hover:underline">
                        {projectById.get(entry.project_id) ? (
                          <>
                            <span className="font-mono">{formatJobNumber(projectById.get(entry.project_id)!.job_number)}</span> {projectById.get(entry.project_id)!.name}
                          </>
                        ) : (
                          entry.project_id
                        )}
                      </Link>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="py-1.5 text-xs text-slate-600">
                    {entry.entity_type ? `${entry.entity_type} ${entry.document_number ?? entry.qb_entity_id ?? ""}` : "—"}
                  </td>
                  <td className="py-1.5">
                    <StatusBadge status={entry.success ? "Completed" : "Problem"} />
                    {entry.error_detail && <div className="text-xs text-rose-600 mt-0.5 max-w-xs">{entry.error_detail}</div>}
                  </td>
                  <td className="py-1.5 text-xs text-slate-500">{entry.initiated_by ?? "System"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
