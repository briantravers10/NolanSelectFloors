import Link from "next/link";
import { listBuildings, listClientCompanies, listInboundEmails, listProjectDrawings, listProjects } from "@/lib/db";
import { Card, PageHeader, EmptyState } from "@/components/ui";
import { formatDateShort } from "@/lib/dates";
import { formatJobNumber } from "@/lib/calculations";
import { requireSectionAccess } from "@/lib/permissions";
import { AccessDenied } from "@/components/AccessDenied";
import { drawingFileUrl, signedFileUrl } from "@/lib/storage";
import { mapWithConcurrency } from "@/lib/concurrency";

/**
 * DRAWINGS — one library of every drawing across every job, so nobody has
 * to open jobs one by one to find a plan. Each card is the same file the
 * job page shows (current version only; older versions stay in the job's
 * history). Drawings that arrived by email without a building named sit
 * at the top, amber, until someone files them from Email Inbox.
 */
const DRAWING_LIKE = /\.(pdf|dwg|dxf|rvt|skp|png|jpe?g|heic|tiff?)$/i;

function fileLabel(reference?: string | null): string {
  if (!reference) return "File";
  const m = reference.toLowerCase().match(/\.([a-z0-9]+)$/);
  return m ? m[1].toUpperCase() : "File";
}

export default async function DrawingsPage({ searchParams }: { searchParams: Promise<{ q?: string; company?: string; building?: string; all?: string }> }) {
  const access = await requireSectionAccess("projects");
  if (access === "none") return <AccessDenied section="Drawings" />;
  const { q = "", company = "", building = "", all } = await searchParams;

  const [drawings, projects, buildings, clients, inbound] = await Promise.all([listProjectDrawings(), listProjects(), listBuildings(), listClientCompanies(), listInboundEmails()]);
  const projectById = new Map(projects.map((p) => [p.id, p]));
  const buildingById = new Map(buildings.map((b) => [b.id, b]));
  const clientById = new Map(clients.map((c) => [c.id, c]));

  const rows = drawings
    .filter((d) => all === "1" || d.is_current_version)
    .map((d) => {
      const p = projectById.get(d.project_id);
      const b = p ? buildingById.get(p.building_id) : undefined;
      const c = b ? clientById.get(b.client_company_id) : undefined;
      return {
        d,
        project: p,
        building: b,
        client: c,
        jobName: p ? `${b?.name ?? p.name}${p.unit_number ? ` — Unit ${p.unit_number}` : ""}` : "Unknown job",
        hay: [d.drawing_name, d.drawing_number, d.uploaded_by, d.notes, b?.name, b?.address, p?.unit_number, p?.name, c?.name].filter(Boolean).join(" ").toLowerCase(),
      };
    })
    .filter((r) => !q || r.hay.includes(q.toLowerCase()))
    .filter((r) => !company || r.client?.id === company)
    .filter((r) => !building || r.building?.id === building)
    .sort((a, b) => b.d.uploaded_at.localeCompare(a.d.uploaded_at));

  // Drawings still waiting in Email Inbox (no building named in the email).
  const waiting = inbound
    .filter((e) => (e.status === "unfiled" || e.status === "matched") && e.attachments.some((a) => a.storage_path && DRAWING_LIKE.test(a.filename)) && e.kind !== "invoice")
    .filter((e) => !q || `${e.subject ?? ""} ${e.from_email ?? ""} ${e.attachments.map((a) => a.filename).join(" ")}`.toLowerCase().includes(q.toLowerCase()))
    .filter(() => !company && !building);

  // Signed URLs are independent storage calls — batched with bounded
  // concurrency instead of one sequential await per file (see the
  // performance audit report). Neither helper ever throws (missing/broken
  // files just resolve to no URL), so a bad file can't take down the page.
  const drawingsNeedingUrls = rows.slice(0, 120).filter((r) => r.d.file_reference && !r.d.storage_unavailable);
  const urlResults = await mapWithConcurrency(drawingsNeedingUrls, 10, async (r) => [r.d.id, await drawingFileUrl(r.d.file_reference!)] as const);
  const urls = new Map(urlResults.filter((([, url]) => url !== null)) as [string, string][]);

  const waitingAttachments = waiting.flatMap((e) => e.attachments.filter((a) => a.storage_path && DRAWING_LIKE.test(a.filename)).map((a) => ({ e, a })));
  const waitingUrlResults = await mapWithConcurrency(waitingAttachments, 10, async ({ e, a }) => [`${e.id}:${a.id}`, await signedFileUrl(`inbound-email:${a.storage_path}`, "inbound-email")] as const);
  const waitingUrls = new Map(waitingUrlResults.filter((([, url]) => url !== null)) as [string, string][]);

  const companyMap = new Map<string, (typeof clients)[number]>();
  const buildingMap = new Map<string, (typeof buildings)[number]>();
  for (const d of drawings) {
    const p = projectById.get(d.project_id);
    const b = p ? buildingById.get(p.building_id) : undefined;
    const c = b ? clientById.get(b.client_company_id) : undefined;
    if (b) buildingMap.set(b.id, b);
    if (c) companyMap.set(c.id, c);
  }
  const companiesWithDrawings = [...companyMap.values()].sort((a, b) => a.name.localeCompare(b.name));
  const buildingsWithDrawings = [...buildingMap.values()].sort((a, b) => a.name.localeCompare(b.name));

  const input = "rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm";

  return (
    <div>
      <PageHeader title="Drawings" subtitle="Every drawing across every job, in one place. Each one still lives on its job page too." />

      <form method="get" className="flex flex-wrap gap-2 mb-4">
        <input name="q" defaultValue={q} placeholder="Search by building, unit, drawing name, or who sent it…" className={`${input} flex-1 min-w-[240px]`} aria-label="Search drawings" />
        <select name="company" defaultValue={company} className={input} aria-label="Management company">
          <option value="">All companies</option>
          {companiesWithDrawings.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        <select name="building" defaultValue={building} className={input} aria-label="Building">
          <option value="">All buildings</option>
          {buildingsWithDrawings.map((b) => (
            <option key={b.id} value={b.id}>{b.name}</option>
          ))}
        </select>
        <select name="all" defaultValue={all ?? ""} className={input} aria-label="Versions">
          <option value="">Current versions</option>
          <option value="1">All versions</option>
        </select>
        <button type="submit" className="rounded-lg bg-sky-600 text-white px-4 py-2 text-sm font-medium hover:bg-sky-700">Search</button>
        {(q || company || building || all) && (
          <Link href="/drawings" className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50">Clear</Link>
        )}
      </form>

      {waiting.length > 0 && (
        <div className="mb-5">
          <div className="flex items-center gap-2 mb-2 text-xs">
            <span className="rounded-full bg-amber-100 text-amber-900 px-2.5 py-1 font-semibold">{waiting.length} not filed to a job yet</span>
            <span className="text-slate-500">Came in by email without a building name. File them from Email Inbox.</span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {waiting.flatMap((e) =>
              e.attachments
                .filter((a) => a.storage_path && DRAWING_LIKE.test(a.filename))
                .map((a) => {
                  const url = waitingUrls.get(`${e.id}:${a.id}`);
                  return (
                    <Card key={`${e.id}:${a.id}`} className="border-amber-300 bg-amber-50 overflow-hidden">
                      <div className="h-20 bg-amber-100 flex items-center justify-center text-[11px] font-bold text-amber-900">{fileLabel(a.filename)}</div>
                      <div className="p-3 space-y-1">
                        <div className="text-sm font-semibold text-slate-900 truncate" title={a.filename}>{a.filename}</div>
                        <div className="text-xs font-medium text-amber-900">Not filed to a job</div>
                        <div className="text-[11px] text-slate-500 truncate">From {e.from_email ?? "unknown"} · {formatDateShort(e.received_at.slice(0, 10))}</div>
                        <div className="flex gap-2 pt-1">
                          <Link href="/inbox" className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs font-medium text-slate-800 hover:bg-slate-50">File to a job</Link>
                          {url && <a href={url} target="_blank" rel="noreferrer" className="text-xs text-sky-700 hover:underline self-center">Open</a>}
                        </div>
                      </div>
                    </Card>
                  );
                })
            )}
          </div>
        </div>
      )}

      {rows.length === 0 ? (
        <Card className="p-6"><EmptyState message={q || company || building ? "No drawings match that search." : "No drawings yet. Upload one on a job page, or forward one by email."} /></Card>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
          {rows.map((r) => {
            const url = urls.get(r.d.id);
            return (
              <Card key={r.d.id} className="overflow-hidden">
                {url ? (
                  <a href={url} target="_blank" rel="noreferrer" className="block h-20 bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-[11px] font-bold text-slate-600">
                    {fileLabel(r.d.file_reference)} · open
                  </a>
                ) : (
                  <div className="h-20 bg-slate-100 flex items-center justify-center text-[11px] font-bold text-slate-400">{r.d.storage_unavailable ? "Not stored" : fileLabel(r.d.file_reference)}</div>
                )}
                <div className="p-3 space-y-0.5">
                  <div className="text-sm font-semibold text-slate-900 truncate" title={r.d.drawing_name}>
                    {r.d.drawing_name}{r.d.drawing_number ? ` (${r.d.drawing_number})` : ""}
                  </div>
                  <Link href={`/projects/${r.d.project_id}`} className="block text-xs text-sky-700 hover:underline truncate">
                    {r.project && <span className="font-mono text-slate-500">{formatJobNumber(r.project.job_number)} </span>}
                    {r.jobName}
                  </Link>
                  <div className="text-[11px] text-slate-500 truncate">
                    {r.client?.name ?? "No company"} · v{r.d.version}{r.d.is_current_version ? "" : " (old)"} · {formatDateShort(r.d.uploaded_at.slice(0, 10))}
                  </div>
                  {r.d.uploaded_by && <div className="text-[11px] text-slate-400 truncate">by {r.d.uploaded_by}</div>}
                </div>
              </Card>
            );
          })}
        </div>
      )}
      <p className="text-xs text-slate-500 mt-3">Filing a drawing to a job puts it on that job page&apos;s Drawings card. It is the same file, so a newer version uploaded on the job shows here as the current one.</p>
    </div>
  );
}
