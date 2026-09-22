import Link from "next/link";
import { listBuildings, listClientCompanies, listInboundEmails, listProjects } from "@/lib/db";
import { Card, PageHeader, EmptyState } from "@/components/ui";
import { formatDateLong } from "@/lib/dates";
import { requireSectionAccess, canEdit } from "@/lib/permissions";
import { AccessDenied } from "@/components/AccessDenied";
import { signedFileUrl } from "@/lib/storage";
import { mapWithConcurrency } from "@/lib/concurrency";
import { unfileInboundAction } from "@/app/inbox/actions";

/**
 * PURCHASE ORDERS — customer POs filed from Email Inbox, each linked to
 * its job. The email is the record; nothing is copied.
 */
export default async function PurchaseOrdersPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const access = await requireSectionAccess("projects");
  if (access === "none") return <AccessDenied section="Purchase Orders" />;
  const { q = "" } = await searchParams;
  const [emails, projects, buildings, clients, editable] = await Promise.all([listInboundEmails(), listProjects(), listBuildings(), listClientCompanies(), canEdit("projects")]);
  const projectById = new Map(projects.map((p) => [p.id, p]));
  const buildingById = new Map(buildings.map((b) => [b.id, b]));
  const clientById = new Map(clients.map((c) => [c.id, c]));

  const rows = emails
    .filter((e) => e.status === "filed" && e.filed_kind === "purchase_order")
    .map((e) => {
      const p = e.filed_project_id ? projectById.get(e.filed_project_id) : undefined;
      const b = p ? buildingById.get(p.building_id) : undefined;
      const c = b ? clientById.get(b.client_company_id) : undefined;
      const jobName = p ? `${b?.name ?? p.name}${p.unit_number ? ` — Unit ${p.unit_number}` : ""}` : "Job no longer exists";
      return { e, p, c, jobName, hay: `${e.subject ?? ""} ${e.from_email ?? ""} ${e.from_name ?? ""} ${jobName} ${c?.name ?? ""} ${e.attachments.map((a) => a.filename).join(" ")}`.toLowerCase() };
    })
    .filter((r) => !q || r.hay.includes(q.toLowerCase()))
    .sort((a, b) => b.e.received_at.localeCompare(a.e.received_at));

  // Batched with bounded concurrency instead of one sequential await per
  // file — see the performance audit report.
  const poAttachments = rows.flatMap((r) => r.e.attachments.filter((a) => a.storage_path).map((a) => ({ e: r.e, a })));
  const poLinkResults = await mapWithConcurrency(poAttachments, 10, async ({ e, a }) => [`${e.id}:${a.id}`, await signedFileUrl(`inbound-email:${a.storage_path}`, "inbound-email")] as const);
  const links = new Map(poLinkResults.filter((([, url]) => url !== null)) as [string, string][]);

  return (
    <div>
      <PageHeader title="Purchase Orders" subtitle="Customer POs filed from Email Inbox, each linked to its job. File a new one from the inbox with “File as Purchase Order”." />
      <form method="get" className="flex gap-2 mb-4">
        <input name="q" defaultValue={q} placeholder="Search by job, company, sender or file…" className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm flex-1 min-w-[240px]" aria-label="Search purchase orders" />
        <button type="submit" className="rounded-lg bg-sky-600 text-white px-4 py-2 text-sm font-medium hover:bg-sky-700">Search</button>
        {q && <Link href="/purchase-orders" className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700">Clear</Link>}
      </form>
      <Card className="overflow-hidden">
        {rows.length === 0 ? (
          <div className="p-6"><EmptyState message={q ? "No purchase orders match that search." : "No purchase orders filed yet. When one arrives by email, file it from Email Inbox as a Purchase Order."} /></div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wide">
                <th className="px-4 py-2.5">Received</th>
                <th className="px-4 py-2.5">Purchase order</th>
                <th className="px-4 py-2.5">Job</th>
                <th className="px-4 py-2.5">Files</th>
                {editable && <th className="px-2 py-2.5" />}
              </tr>
            </thead>
            <tbody>
              {rows.map(({ e, p, c, jobName }) => (
                <tr key={e.id} className="border-t border-slate-100 align-top">
                  <td className="px-4 py-3 whitespace-nowrap text-xs text-slate-600">{formatDateLong(e.received_at.slice(0, 10))}</td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-900">{e.subject || "(no subject)"}</div>
                    <div className="text-xs text-slate-500">From {e.from_name ? `${e.from_name} <${e.from_email}>` : e.from_email ?? "unknown"}</div>
                    {e.text_preview && <div className="text-xs text-slate-500 mt-0.5 line-clamp-2">{e.text_preview}</div>}
                    <div className="text-[11px] text-slate-400 mt-0.5">filed by {e.filed_by}</div>
                  </td>
                  <td className="px-4 py-3">
                    {p ? (
                      <>
                        <Link href={`/projects/${p.id}`} className="text-sky-700 hover:underline font-medium">{jobName} →</Link>
                        <div className="text-xs text-slate-500">{c?.name ?? "No company"}</div>
                        <Link href={`/schedule/edit?project=${p.id}&date=${p.start_date ?? ""}`} className="text-xs text-sky-700 hover:underline">View on schedule</Link>
                      </>
                    ) : (
                      <span className="text-slate-400">{jobName}</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1.5">
                      {e.attachments.map((a) => {
                        const url = links.get(`${e.id}:${a.id}`);
                        return url ? (
                          <a key={a.id} href={url} target="_blank" rel="noreferrer" className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs text-sky-700 hover:bg-slate-50">📎 {a.filename}</a>
                        ) : (
                          <span key={a.id} className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-xs text-slate-500">📎 {a.filename}</span>
                        );
                      })}
                    </div>
                  </td>
                  {editable && (
                    <td className="px-2 py-3 text-right">
                      <form action={unfileInboundAction.bind(null, e.id)}>
                        <button type="submit" className="text-xs text-slate-400 hover:text-rose-600" title="Send back to Email Inbox as unfiled">Unfile</button>
                      </form>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
