import Link from "next/link";
import { listBuildings, listClientCompanies, listInboundEmails, listProjectMaterials, listProjects, getNavSectionLastSeen, markNavSectionSeen } from "@/lib/db";
import { Card, PageHeader, EmptyState, Button } from "@/components/ui";
import { daysBetween, formatDateLong, todayIso } from "@/lib/dates";
import { signedFileUrl } from "@/lib/storage";
import { mapWithConcurrency } from "@/lib/concurrency";
import { requireSectionAccess, canEdit } from "@/lib/permissions";
import { AccessDenied } from "@/components/AccessDenied";
import { confirmAllMatchedAction, ignoreAllUnfiledAction, ignoreInboundAction, reopenInboundAction } from "./actions";
import { InboxFilingBlock } from "@/components/inbox/InboxFilingBlock";
import type { FileKind } from "@/components/inbox/FileInboundForm";
import { supplierKey, NO_SUPPLIER } from "@/lib/suppliers";
import { INBOUND_KIND_LABELS, UNASSIGNED_CLIENT_NAME, type InboundKind } from "@/lib/types";
import { projectDisplayName } from "@/lib/calculations";
import { getActingUser } from "@/lib/current-user";
import { NewPill } from "@/components/NewPill";

const NAV_SECTION = "/inbox";

/**
 * EMAIL INBOX — drawings and invoices forwarded from the office Gmail.
 * Anything the app couldn't file on its own waits here: pick the job,
 * confirm drawing vs invoice, File. Filed and ignored ones stay listed
 * underneath for the record.
 */
export default async function InboxPage({ searchParams }: { searchParams: Promise<{ show?: string }> }) {
  const access = await requireSectionAccess("projects");
  if (access === "none") return <AccessDenied section="Email Inbox" />;
  const { show } = await searchParams;
  const actingUser = await getActingUser();
  // Read BEFORE marking seen below, so this render can still tell which
  // unfiled emails are new since the last visit.
  const lastSeen = await getNavSectionLastSeen(actingUser.id, NAV_SECTION);
  const [emails, projects, buildings, clients, editable, materials] = await Promise.all([listInboundEmails(), listProjects(), listBuildings(), listClientCompanies(), canEdit("projects"), listProjectMaterials()]);
  const supplierNames = [...new Set(materials.map((m) => supplierKey(m)))].filter((n) => n !== NO_SUPPLIER).sort();
  // Best guess at the supplier from the sender: display name, else the
  // part of the domain before the dot ("orders@homedepotpro.com" → "homedepotpro").
  const guessSupplier = (fromName?: string | null, fromEmail?: string | null) => {
    if (fromName?.trim()) return fromName.trim();
    const domain = fromEmail?.split("@")[1]?.split(".")[0];
    return domain ? domain.charAt(0).toUpperCase() + domain.slice(1) : "";
  };
  const buildingById = new Map(buildings.map((b) => [b.id, b]));
  const clientById = new Map(clients.map((c) => [c.id, c]));
  const projectById = new Map(projects.map((p) => [p.id, p]));

  // Every job, any pipeline stage — a completed job still needs its final
  // invoice/change order/COI filed against it, so it must stay pickable.
  const jobOptions = projects
    .map((p) => {
      const b = buildingById.get(p.building_id);
      const c = b ? clientById.get(b.client_company_id) : undefined;
      return { id: p.id, buildingId: p.building_id, label: `${projectDisplayName(p, b?.name)}${c ? ` · ${c.name}` : ""}` };
    })
    .sort((a, b) => a.label.localeCompare(b.label));

  const quickBuildings = buildings
    .filter((b) => b.active)
    .map((b) => ({ name: b.name, clientName: clientById.get(b.client_company_id)?.name }))
    .sort((a, b) => a.name.localeCompare(b.name));
  const quickClients = clients.filter((c) => c.name !== UNASSIGNED_CLIENT_NAME).map((c) => ({ name: c.name })).sort((a, b) => a.name.localeCompare(b.name));
  const initialKind = (k: InboundKind): FileKind => (k === "unknown" ? "drawing" : k);
  const kindLabel = (k?: string | null) => INBOUND_KIND_LABELS[(k ?? "unknown") as InboundKind] ?? k ?? "Filed";

  const matched = emails.filter((e) => e.status === "matched");
  const unfiled = emails.filter((e) => e.status === "unfiled");
  const done = emails.filter((e) => e.status !== "unfiled" && e.status !== "matched").slice(0, show === "all" ? undefined : 20);

  // Opening this page marks it seen — the sidebar badge (unfiled count)
  // and the "New" highlight below only reflect what's arrived since.
  await markNavSectionSeen(actingUser.id, NAV_SECTION);

  // Signed download links (1 hour) for every stored attachment shown —
  // batched with bounded concurrency instead of one sequential await per
  // file (see the performance audit report). signedFileUrl never throws
  // (a broken file just resolves to no URL), so this can't take the page
  // down.
  const attachmentsNeedingLinks = [...matched, ...unfiled, ...done].flatMap((e) => e.attachments.filter((a) => a.storage_path).map((a) => ({ e, a })));
  const linkResults = await mapWithConcurrency(attachmentsNeedingLinks, 10, async ({ e, a }) => [`${e.id}:${a.id}`, await signedFileUrl(`inbound-email:${a.storage_path}`, "inbound-email")] as const);
  const links = new Map(linkResults.filter((([, url]) => url !== null)) as [string, string][]);

  const jobName = (id?: string | null) => {
    const p = id ? projectById.get(id) : undefined;
    if (!p) return null;
    const b = buildingById.get(p.building_id);
    return projectDisplayName(p, b?.name);
  };

  return (
    <div>
      <PageHeader
        title="Email Inbox"
        subtitle="Everything forwarded from the office email: drawings, inbound and outbound invoices, purchase orders, potential bids and COIs. Anything the app couldn't match to a job on its own waits here for you to file."
      />

      {(() => {
        const last = emails.map((e) => e.received_at).sort().at(-1) ?? null;
        const days = last ? Math.max(0, daysBetween(last.slice(0, 10), todayIso())) : null;
        const stale = days !== null && days >= 7;
        return (
          <Card className={`p-3 mb-5 text-xs ${stale ? "border-rose-300 bg-rose-50 text-rose-900" : "text-slate-600"}`}>
            <span className="font-semibold uppercase tracking-wide mr-2">Forwarding status</span>
            {last ? (
              <>
                Last email arrived {formatDateLong(last.slice(0, 10))}{days !== null && days > 0 ? ` (${days} day${days === 1 ? "" : "s"} ago)` : " (today)"}.
                {stale && " That's a while — if mail is still reaching Gmail, check that the forwarding filter is still on and Google hasn't asked Aidan to re-verify it."}
              </>
            ) : (
              "Nothing has arrived yet. Emails with attachments sent to the office Gmail should show up here within a minute."
            )}
          </Card>
        );
      })()}

      {matched.length > 0 && (
        <div className="mb-6">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
            <div>
              <h2 className="text-sm font-semibold text-slate-900 uppercase tracking-wide">Matched automatically — {matched.length}</h2>
              <p className="text-xs text-slate-500">The app is confident about these. Check the job, then Confirm. Change the job first if it&apos;s wrong.</p>
            </div>
            {editable && (
              <form action={confirmAllMatchedAction}>
                <Button type="submit">✓ Confirm all {matched.length}</Button>
              </form>
            )}
          </div>
          <div className="space-y-3">
            {matched.map((e) => (
              <Card key={e.id} className="p-4 border-emerald-200 bg-emerald-50/40">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-slate-900">{e.subject || "(no subject)"}</div>
                    <div className="text-xs text-slate-500">
                      From {e.from_name ? `${e.from_name} <${e.from_email}>` : e.from_email ?? "unknown"} · {formatDateLong(e.received_at.slice(0, 10))}
                    </div>
                    <div className="mt-1 text-xs">
                      <span className="rounded-full bg-emerald-100 text-emerald-900 px-2 py-0.5 font-medium">{kindLabel(e.kind)}</span>
                      <span className="ml-2 text-slate-700">→ <span className="font-medium">{jobName(e.suggested_project_id) ?? "Unknown job"}</span></span>
                    </div>
                    {e.text_preview && <p className="text-xs text-slate-600 mt-1 line-clamp-2">{e.text_preview}</p>}
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
                  </div>
                  {editable && (
                    <div className="flex flex-col gap-2 min-w-[300px]">
                      <InboxFilingBlock
                        emailId={e.id}
                        initialKind={initialKind(e.kind)}
                        jobs={jobOptions}
                        defaultProjectId={e.suggested_project_id ?? ""}
                        suppliers={supplierNames}
                        defaultSupplier={guessSupplier(e.from_name, e.from_email)}
                        defaultDate={e.received_at.slice(0, 10)}
                        submitLabel="✓ Confirm"
                      />
                      <form action={ignoreInboundAction.bind(null, e.id)} className="text-right">
                        <button type="submit" className="text-xs text-slate-500 hover:text-slate-800 underline">Nothing to file — ignore</button>
                      </form>
                    </div>
                  )}
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
        <h2 className="text-sm font-semibold text-slate-900 uppercase tracking-wide">Unfiled — {unfiled.length}</h2>
        {editable && unfiled.length > 0 && (
          <form action={ignoreAllUnfiledAction}>
            <Button type="submit" variant="secondary">Ignore all {unfiled.length}</Button>
          </form>
        )}
      </div>
      {unfiled.length === 0 ? (
        <Card className="p-6 mb-6"><EmptyState message="Nothing waiting. New emails with attachments will show up here within a minute of arriving." /></Card>
      ) : (
        <div className="space-y-3 mb-6">
          {unfiled.map((e) => {
            const suggestedBuilding = e.suggested_building_id ? buildingById.get(e.suggested_building_id) : undefined;
            const defaultProject = e.suggested_project_id ?? jobOptions.find((j) => j.buildingId === e.suggested_building_id)?.id ?? "";
            return (
              <Card key={e.id} className="p-4 border-amber-200">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <div className="text-sm font-semibold text-slate-900">{e.subject || "(no subject)"}</div>
                      {(!lastSeen || e.received_at > lastSeen) && <NewPill />}
                    </div>
                    <div className="text-xs text-slate-500">
                      From {e.from_name ? `${e.from_name} <${e.from_email}>` : e.from_email ?? "unknown"} · {formatDateLong(e.received_at.slice(0, 10))}
                      {suggestedBuilding && <span className="ml-2 text-sky-700">Looks like {suggestedBuilding.name}</span>}
                    </div>
                    {e.text_preview && <p className="text-xs text-slate-600 mt-1 line-clamp-2">{e.text_preview}</p>}
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {e.attachments.length === 0 && <span className="text-xs text-slate-400">No attachments</span>}
                      {e.attachments.map((a) => {
                        const url = links.get(`${e.id}:${a.id}`);
                        return url ? (
                          <a key={a.id} href={url} target="_blank" rel="noreferrer" className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs text-sky-700 hover:bg-slate-50">
                            📎 {a.filename}
                          </a>
                        ) : (
                          <span key={a.id} className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-xs text-slate-500" title="File wasn't stored">📎 {a.filename}</span>
                        );
                      })}
                    </div>
                  </div>
                  {editable && (
                    <div className="flex flex-col gap-2 min-w-[300px]">
                      <InboxFilingBlock
                        emailId={e.id}
                        initialKind={initialKind(e.kind)}
                        jobs={jobOptions}
                        defaultProjectId={defaultProject}
                        suppliers={supplierNames}
                        defaultSupplier={guessSupplier(e.from_name, e.from_email)}
                        defaultDate={e.received_at.slice(0, 10)}
                        showNewJob
                        quickBuildings={quickBuildings}
                        quickClients={quickClients}
                        defaultQuickDate={todayIso()}
                        defaultQuickBuilding={suggestedBuilding?.name}
                        defaultQuickDescription={e.subject ?? ""}
                      />
                      <form action={ignoreInboundAction.bind(null, e.id)} className="text-right">
                        <button type="submit" className="text-xs text-slate-500 hover:text-slate-800 underline">Nothing to file — ignore</button>
                      </form>
                    </div>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <h2 className="text-sm font-semibold text-slate-900 uppercase tracking-wide mb-2">Filed &amp; ignored</h2>
      <Card className="p-3">
        {done.length === 0 ? (
          <EmptyState message="Nothing filed yet." />
        ) : (
          <table className="w-full text-sm">
            <tbody>
              {done.map((e) => (
                <tr key={e.id} className="border-b border-slate-100 last:border-0">
                  <td className="py-2 px-2 text-xs text-slate-500 w-28">{formatDateLong(e.received_at.slice(0, 10))}</td>
                  <td className="py-2 px-2">
                    <div className="text-slate-800">{e.subject || "(no subject)"}</div>
                    <div className="text-xs text-slate-500">{e.from_email}</div>
                  </td>
                  <td className="py-2 px-2 text-xs">
                    {e.status === "filed" ? (
                      <>
                        <span className="rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 px-2 py-0.5">{kindLabel(e.filed_kind)}</span>
                        {e.filed_project_id ? (
                          <Link href={`/projects/${e.filed_project_id}`} className="ml-2 text-sky-700 hover:underline">{jobName(e.filed_project_id)}</Link>
                        ) : e.filed_kind === "invoice" ? (
                          <Link href="/suppliers" className="ml-2 text-amber-800 hover:underline">Supplier only, no job</Link>
                        ) : e.filed_kind === "bid" ? (
                          <Link href="/bids" className="ml-2 text-sky-700 hover:underline">In Bids</Link>
                        ) : null}
                        <div className="text-slate-400 mt-0.5">by {e.filed_by}</div>
                      </>
                    ) : (
                      <span className="rounded-full bg-slate-100 text-slate-600 px-2 py-0.5">Ignored</span>
                    )}
                  </td>
                  <td className="py-2 px-2 text-right">
                    {editable && e.status === "ignored" && (
                      <form action={reopenInboundAction.bind(null, e.id)}>
                        <button type="submit" className="text-xs text-sky-600 hover:underline">Reopen</button>
                      </form>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {show !== "all" && emails.filter((e) => e.status !== "unfiled").length > 20 && (
          <div className="text-right mt-2"><Link href="/inbox?show=all" className="text-xs text-sky-600 hover:underline">Show all</Link></div>
        )}
      </Card>
    </div>
  );
}
