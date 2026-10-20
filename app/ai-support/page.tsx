import { getActingUser } from "@/lib/current-user";
import { isOwnerActingUser } from "@/lib/permissions";
import { AccessDenied } from "@/components/AccessDenied";
import { listBugReports } from "@/lib/db";
import { Card, PageHeader, Stat, EmptyState } from "@/components/ui";
import { AdminReportRow } from "@/components/support/AdminReportRow";

/**
 * "AI Support" — Phase 4 of the AI bug monitoring/support system (see
 * docs/ai-bug-support/architecture-notes.md). Owner/Admin only, gated
 * the same way as the other Owner-exclusive areas (isOwnerActingUser) —
 * deliberately not a new entry in the shared staff-access permission
 * grid, so it's inherently Owner-only without anyone needing to
 * remember to grant it.
 */
export default async function AiSupportPage() {
  const actingUser = await getActingUser();
  if (!(await isOwnerActingUser(actingUser))) return <AccessDenied section="AI Support" />;

  const reports = await listBugReports();
  const openReports = reports.filter((r) => r.status !== "Resolved");
  const resolvedReports = reports.filter((r) => r.status === "Resolved");
  const unhandledCount = reports.filter((r) => r.status === "Open").length;

  return (
    <div>
      <PageHeader title="AI Support" subtitle="Employee bug reports and error monitoring, in one place." />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        <Stat label="Open" value={unhandledCount} tone={unhandledCount > 0 ? "bad" : "default"} />
        <Stat label="In progress" value={reports.filter((r) => r.status === "Investigating" || r.status === "Fix Proposed").length} />
        <Stat label="Resolved" value={resolvedReports.length} tone="good" />
        <Stat label="Total reports" value={reports.length} />
      </div>

      <Card className="p-4 mb-5">
        <h2 className="text-sm font-semibold text-slate-900 uppercase tracking-wide mb-1">Automatically Detected Errors</h2>
        <p className="text-xs text-slate-500 mb-2">
          Sentry error monitoring is live (unhandled errors, which page they happened on, timestamps) but not yet pulled
          into this table — that needs a Sentry API token with read access, which hasn&apos;t been configured yet. Until
          then, check the Sentry dashboard directly for errors nobody has reported here.
        </p>
        <a
          href="https://travers-group-llc.sentry.io/issues/"
          target="_blank"
          rel="noreferrer"
          className="text-sm text-sky-600 hover:underline"
        >
          Open Sentry Issues →
        </a>
      </Card>

      <h2 className="text-sm font-semibold text-slate-900 uppercase tracking-wide mb-2">
        Open &amp; In Progress — {openReports.length}
      </h2>
      {openReports.length === 0 ? (
        <Card className="p-6 mb-6">
          <EmptyState message="Nothing open — every reported problem has been resolved." />
        </Card>
      ) : (
        <div className="space-y-3 mb-6">
          {openReports.map((r) => (
            <AdminReportRow key={r.id} report={r} />
          ))}
        </div>
      )}

      {resolvedReports.length > 0 && (
        <>
          <h2 className="text-sm font-semibold text-slate-900 uppercase tracking-wide mb-2">Resolved — {resolvedReports.length}</h2>
          <div className="space-y-3 opacity-75">
            {resolvedReports.map((r) => (
              <AdminReportRow key={r.id} report={r} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
