import Link from "next/link";
import { listBuildings, listClientCompanies, listInboundEmails, listProjects } from "@/lib/db";
import { Card, PageHeader, EmptyState, Button } from "@/components/ui";
import { formatDateLong } from "@/lib/dates";
import { formatJobNumber } from "@/lib/calculations";
import { requireSectionAccess, canEdit } from "@/lib/permissions";
import { AccessDenied } from "@/components/AccessDenied";
import { signedFileUrl } from "@/lib/storage";
import { mapWithConcurrency } from "@/lib/concurrency";
import { setBidStatusAction, unfileInboundAction } from "@/app/inbox/actions";
import { BID_EMAIL_STATUSES, type BidEmailStatus } from "@/lib/types";
import { ListSearchBox } from "@/components/ListSearchBox";

const STATUS_LABEL: Record<BidEmailStatus, string> = { open: "To price", quoted: "Quoted — waiting", won: "Won", lost: "Lost" };
const STATUS_CLASS: Record<BidEmailStatus, string> = {
  open: "bg-amber-100 text-amber-900 border-amber-300",
  quoted: "bg-sky-100 text-sky-900 border-sky-300",
  won: "bg-emerald-100 text-emerald-900 border-emerald-300",
  lost: "bg-slate-100 text-slate-600 border-slate-300",
};

/**
 * BIDS — potential jobs that came in by email and were filed as a
 * Potential Bid. Price it, mark it quoted, then won or lost. A won bid
 * becomes a job via New Job (or “New job from this email” in the inbox).
 */
export default async function BidsPage({ searchParams }: { searchParams: Promise<{ show?: string; q?: string }> }) {
  const access = await requireSectionAccess("job_requests");
  if (access === "none") return <AccessDenied section="Bids" />;
  const { show, q = "" } = await searchParams;
  const [emails, projects, buildings, clients, editable] = await Promise.all([listInboundEmails(), listProjects(), listBuildings(), listClientCompanies(), canEdit("job_requests")]);
  const projectById = new Map(projects.map((p) => [p.id, p]));
  const buildingById = new Map(buildings.map((b) => [b.id, b]));
  const clientById = new Map(clients.map((c) => [c.id, c]));

  const all = emails.filter((e) => e.status === "filed" && e.filed_kind === "bid").sort((a, b) => b.received_at.localeCompare(a.received_at));
  const live = all.filter((e) => (e.bid_status ?? "open") === "open" || e.bid_status === "quoted");
  const closed = all.filter((e) => e.bid_status === "won" || e.bid_status === "lost");
  let rows = show === "closed" ? closed : live;
  if (q.trim()) {
    const needle = q.trim().toLowerCase();
    rows = rows.filter((e) => {
      const p = e.filed_project_id ? projectById.get(e.filed_project_id) : e.suggested_project_id ? projectById.get(e.suggested_project_id) : undefined;
      const b = p ? buildingById.get(p.building_id) : e.suggested_building_id ? buildingById.get(e.suggested_building_id) : undefined;
      const c = b ? clientById.get(b.client_company_id) : undefined;
      const hay = `${e.subject ?? ""} ${e.from_name ?? ""} ${e.from_email ?? ""} ${b?.name ?? ""} ${c?.name ?? ""} ${p?.unit_number ?? ""} ${e.bid_notes ?? ""}`.toLowerCase();
      return hay.includes(needle);
    });
  }

  // Batched with bounded concurrency instead of one sequential await per
  // file — see the performance audit report.
  const bidAttachments = rows.flatMap((e) => e.attachments.filter((a) => a.storage_path).map((a) => ({ e, a })));
  const bidLinkResults = await mapWithConcurrency(bidAttachments, 10, async ({ e, a }) => [`${e.id}:${a.id}`, await signedFileUrl(`inbound-email:${a.storage_path}`, "inbound-email")] as const);
  const links = new Map(bidLinkResults.filter((([, url]) => url !== null)) as [string, string][]);
  const input = "rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm";

  return (
    <div>
      <PageHeader
        title="Bids"
        subtitle="Potential jobs that came in by email. Price them, mark them quoted, then won or lost. To add one, file an email in Email Inbox as a Potential Bid."
        action={
          <div className="flex gap-1 text-xs">
            <Link href={q.trim() ? `/bids?q=${encodeURIComponent(q.trim())}` : "/bids"} className={`rounded-full border px-2.5 py-1 font-medium ${show !== "closed" ? "bg-slate-900 text-white border-slate-900" : "border-slate-300 text-slate-600"}`}>Open · {live.length}</Link>
            <Link href={`/bids?show=closed${q.trim() ? `&q=${encodeURIComponent(q.trim())}` : ""}`} className={`rounded-full border px-2.5 py-1 font-medium ${show === "closed" ? "bg-slate-900 text-white border-slate-900" : "border-slate-300 text-slate-600"}`}>Won / lost · {closed.length}</Link>
          </div>
        }
      />
      <ListSearchBox action="/bids" q={q} placeholder="Search by job, company, sender, or notes…" ariaLabel="Search bids" extraParams={{ show }} />
      {rows.length === 0 ? (
        <Card className="p-6"><EmptyState message={q.trim() ? "No bids match that search." : show === "closed" ? "No won or lost bids yet." : "No open bids. When a request comes in by email, file it from Email Inbox as a Potential Bid and it lands here."} /></Card>
      ) : (
        <div className="space-y-3">
          {rows.map((e) => {
            const status = (e.bid_status ?? "open") as BidEmailStatus;
            const p = e.filed_project_id ? projectById.get(e.filed_project_id) : e.suggested_project_id ? projectById.get(e.suggested_project_id) : undefined;
            const b = p ? buildingById.get(p.building_id) : e.suggested_building_id ? buildingById.get(e.suggested_building_id) : undefined;
            const c = b ? clientById.get(b.client_company_id) : undefined;
            return (
              <Card key={e.id} className="p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${STATUS_CLASS[status]}`}>{STATUS_LABEL[status]}</span>
                      <div className="text-sm font-semibold text-slate-900">{e.subject || "(no subject)"}</div>
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5">
                      From {e.from_name ? `${e.from_name} <${e.from_email}>` : e.from_email ?? "unknown"} · {formatDateLong(e.received_at.slice(0, 10))} · filed by {e.filed_by}
                    </div>
                    {(b || c) && (
                      <div className="text-xs text-slate-700 mt-0.5">
                        {p && <span className="font-mono text-slate-500">{formatJobNumber(p.job_number)} · </span>}
                        {b?.name}{p?.unit_number ? ` — Unit ${p.unit_number}` : ""}{c ? ` · ${c.name}` : ""}
                        {p && <Link href={`/projects/${p.id}`} className="ml-2 text-sky-700 hover:underline">View job →</Link>}
                      </div>
                    )}
                    {e.text_preview && <p className="text-sm text-slate-700 mt-1 whitespace-pre-line line-clamp-4">{e.text_preview}</p>}
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {e.attachments.map((a) => {
                        const url = links.get(`${e.id}:${a.id}`);
                        return url ? (
                          <a key={a.id} href={url} target="_blank" rel="noreferrer" className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs text-sky-700 hover:bg-slate-50">📎 {a.filename}</a>
                        ) : (
                          <span key={a.id} className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-xs text-slate-500">📎 {a.filename}</span>
                        );
                      })}
                    </div>
                    {e.bid_notes && !editable && <p className="text-xs text-slate-600 mt-2">Notes: {e.bid_notes}</p>}
                  </div>
                  {editable && (
                    <div className="flex flex-col gap-2 min-w-[260px]">
                      <form action={setBidStatusAction.bind(null, e.id)} className="flex flex-col gap-1.5">
                        <select name="bid_status" defaultValue={status} className={input}>
                          {BID_EMAIL_STATUSES.map((s) => (
                            <option key={s} value={s}>{STATUS_LABEL[s]}</option>
                          ))}
                        </select>
                        <textarea name="bid_notes" defaultValue={e.bid_notes ?? ""} rows={2} placeholder="Price given, who's handling it, follow-up date…" className={`${input} w-full`} />
                        <Button type="submit" variant="secondary" className="text-xs py-1.5">Save</Button>
                      </form>
                      <div className="flex items-center justify-between text-xs">
                        <Link href="/job-requests/new" className="text-sky-700 hover:underline">Turn into a job request →</Link>
                        <form action={unfileInboundAction.bind(null, e.id)}>
                          <button type="submit" className="text-slate-400 hover:text-rose-600" title="Send back to Email Inbox as unfiled">Not a bid</button>
                        </form>
                      </div>
                    </div>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
