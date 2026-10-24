import { getActingUser } from "@/lib/current-user";
import { isOwnerActingUser } from "@/lib/permissions";
import { AccessDenied } from "@/components/AccessDenied";
import { listQaTestRuns, listQaFindings } from "@/lib/db";
import { Card, PageHeader, Stat, EmptyState, StatusBadge } from "@/components/ui";
import { formatDateTime } from "@/lib/dates";
import { RunQaTestsButton } from "@/components/qa/RunQaTestsButton";

/**
 * Autonomous QA Testing Agent dashboard — Owner/Admin only, same gating
 * pattern as AI Support (isOwnerActingUser). See qa/README.md for the
 * full design: what runs twice daily, what the GitHub Actions workflow
 * does, and the production-safety guarantees.
 */
export default async function QaDashboardPage() {
  const actingUser = await getActingUser();
  if (!(await isOwnerActingUser(actingUser))) return <AccessDenied section="QA Dashboard" />;

  const runs = await listQaTestRuns(30);
  const lastRun = runs[0];
  const allFindings = await listQaFindings();
  const openFindings = allFindings.filter((f) => f.bug_report_id); // filed ones only — see report-results.mjs

  const totalsAcrossRuns = runs.reduce(
    (acc, r) => ({ total: acc.total + r.total_tests, passed: acc.passed + r.passed_tests, failed: acc.failed + r.failed_tests, skipped: acc.skipped + r.skipped_tests }),
    { total: 0, passed: 0, failed: 0, skipped: 0 }
  );

  function nextScheduledRun(): string {
    // 8am/8pm America/New_York — see .github/workflows/qa.yml's should-run
    // job for the actual DST-aware gate this mirrors.
    const now = new Date();
    const nyHour = Number(now.toLocaleString("en-US", { timeZone: "America/New_York", hour: "2-digit", hour12: false }));
    const next = new Date(now);
    if (nyHour < 8) next.setHours(next.getHours() + (8 - nyHour));
    else if (nyHour < 20) next.setHours(next.getHours() + (20 - nyHour));
    else next.setHours(next.getHours() + (24 - nyHour + 8));
    return formatDateTime(next.toISOString());
  }

  return (
    <div>
      <PageHeader
        title="QA Testing"
        subtitle="Autonomous, read-only-safe testing that runs twice daily and before every change reaches main — see qa/README.md for how it's isolated from production data."
        action={<RunQaTestsButton />}
      />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        <Stat label="Last run" value={lastRun ? formatDateTime(lastRun.started_at) : "Never"} />
        <Stat label="Next scheduled" value={nextScheduledRun()} />
        <Stat
          label="Last status"
          value={lastRun ? lastRun.status : "—"}
          tone={lastRun?.status === "passed" ? "good" : lastRun?.status === "failed" ? "bad" : "default"}
        />
        <Stat label="Runs tracked" value={runs.length} />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        <Stat label="Tests (last 30 runs)" value={totalsAcrossRuns.total} />
        <Stat label="Passed" value={totalsAcrossRuns.passed} tone="good" />
        <Stat label="Failed" value={totalsAcrossRuns.failed} tone={totalsAcrossRuns.failed > 0 ? "bad" : "default"} />
        <Stat label="Skipped" value={totalsAcrossRuns.skipped} />
      </div>

      <h2 className="text-sm font-semibold text-slate-900 uppercase tracking-wide mb-2">Findings filed as bug reports — {openFindings.length}</h2>
      {openFindings.length === 0 ? (
        <Card className="p-6 mb-6">
          <EmptyState message="No QA-detected issues filed yet. Check AI Support for anything currently open." />
        </Card>
      ) : (
        <Card className="p-3 mb-6">
          <table className="w-full text-sm">
            <tbody>
              {openFindings.slice(0, 20).map((f) => (
                <tr key={f.id} className="border-b border-slate-100 last:border-0">
                  <td className="py-2 px-2 text-xs text-slate-500 w-36">{formatDateTime(f.created_at)}</td>
                  <td className="py-2 px-2">
                    <div className="text-slate-800">{f.test_name}</div>
                    <div className="text-xs text-slate-500">{f.page_path}</div>
                  </td>
                  <td className="py-2 px-2 text-xs"><StatusBadge status={f.severity} /></td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="text-xs text-slate-500 mt-2">Full detail and resolution tracking lives in AI Support, alongside employee-reported bugs.</p>
        </Card>
      )}

      <h2 className="text-sm font-semibold text-slate-900 uppercase tracking-wide mb-2">Run history</h2>
      {runs.length === 0 ? (
        <Card className="p-6"><EmptyState message="No QA runs recorded yet — this fills in once the GitHub Actions workflow and database migration are both live. See qa/README.md." /></Card>
      ) : (
        <Card className="p-3">
          <table className="w-full text-sm">
            <tbody>
              {runs.map((r) => (
                <tr key={r.id} className="border-b border-slate-100 last:border-0">
                  <td className="py-2 px-2 text-xs text-slate-500 w-36">{formatDateTime(r.started_at)}</td>
                  <td className="py-2 px-2 text-xs capitalize">{r.trigger}</td>
                  <td className="py-2 px-2 text-xs"><StatusBadge status={r.status} /></td>
                  <td className="py-2 px-2 text-xs text-slate-600">
                    {r.passed_tests}/{r.total_tests} passed{r.failed_tests > 0 ? `, ${r.failed_tests} failed` : ""}
                  </td>
                  <td className="py-2 px-2 text-right">
                    {r.github_run_url && (
                      <a href={r.github_run_url} target="_blank" rel="noreferrer" className="text-xs text-sky-600 hover:underline">
                        Logs →
                      </a>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
