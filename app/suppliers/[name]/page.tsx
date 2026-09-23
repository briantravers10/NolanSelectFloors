import Link from "next/link";
import { listBuildings, listClientCompanies, listProjectMaterials, listProjects } from "@/lib/db";
import { Card, PageHeader, EmptyState } from "@/components/ui";
import { formatCurrency, formatCurrencyPrecise, isActiveProjectStage, projectDisplayName } from "@/lib/calculations";
import { formatDateShort } from "@/lib/dates";
import { requireSectionAccess, canEdit } from "@/lib/permissions";
import { AccessDenied } from "@/components/AccessDenied";
import { isFileStorageConfigured, materialInvoiceUrl } from "@/lib/storage";
import { mapWithConcurrency } from "@/lib/concurrency";
import { materialDate, summarizeSuppliers, supplierKey, NO_SUPPLIER } from "@/lib/suppliers";
import { AddSupplierInvoiceForm } from "@/components/suppliers/AddSupplierInvoiceForm";
import { LinkToJobForm } from "@/components/suppliers/LinkToJobForm";
import { SplitInvoiceForm } from "@/components/suppliers/SplitInvoiceForm";
import { deleteSupplierInvoiceAction } from "../actions";

/** One supplier: every invoice / materials line, newest first, with the job it's linked to (or a picker to link it). */
export default async function SupplierDetailPage({ params }: { params: Promise<{ name: string }> }) {
  const access = await requireSectionAccess("materials");
  if (access === "none") return <AccessDenied section="Suppliers" />;
  const { name: rawName } = await params;
  const name = decodeURIComponent(rawName);

  const [materials, projects, buildings, clients, editable] = await Promise.all([listProjectMaterials(), listProjects(), listBuildings(), listClientCompanies(), canEdit("materials")]);
  const lines = materials.filter((m) => supplierKey(m) === name).sort((a, b) => materialDate(b).localeCompare(materialDate(a)));
  const summary = summarizeSuppliers(lines)[0];

  const projectById = new Map(projects.map((p) => [p.id, p]));
  const buildingById = new Map(buildings.map((b) => [b.id, b]));
  const clientById = new Map(clients.map((c) => [c.id, c]));
  const jobLabel = (projectId: string) => {
    const p = projectById.get(projectId);
    if (!p) return "Unknown job";
    const b = buildingById.get(p.building_id);
    return projectDisplayName(p, b?.name);
  };
  const jobCompany = (projectId: string) => {
    const p = projectById.get(projectId);
    const b = p ? buildingById.get(p.building_id) : undefined;
    return b ? clientById.get(b.client_company_id)?.name : undefined;
  };
  const jobs = projects
    .filter((p) => isActiveProjectStage(p))
    .map((p) => ({ id: p.id, label: `${jobLabel(p.id)}${jobCompany(p.id) ? ` · ${jobCompany(p.id)}` : ""}` }))
    .sort((a, b) => a.label.localeCompare(b.label));

  // Batched with bounded concurrency instead of one sequential await per
  // file — see the performance audit report.
  const linesNeedingUrls = lines.filter((m) => m.invoice_path);
  const linkResults = await mapWithConcurrency(linesNeedingUrls, 10, async (m) => [m.id, await materialInvoiceUrl(m.invoice_path!)] as const);
  const links = new Map(linkResults.filter((([, url]) => url !== null)) as [string, string][]);
  const supplierNames = [...new Set(materials.map((m) => supplierKey(m)))].filter((n) => n !== NO_SUPPLIER).sort();

  return (
    <div>
      <PageHeader
        title={name}
        subtitle={summary ? `${summary.count} invoice${summary.count === 1 ? "" : "s"} · ${formatCurrency(summary.total)} total${summary.unlinkedCount ? ` · ${summary.unlinkedCount} not linked to a job` : ""}` : "No invoices yet"}
        action={editable && name !== NO_SUPPLIER ? <AddSupplierInvoiceForm suppliers={supplierNames} jobs={jobs} storageConfigured={isFileStorageConfigured()} defaultSupplier={name} /> : undefined}
      />

      {summary && (
        <div className="grid grid-cols-3 gap-3 mb-5">
          <Card className="p-4">
            <div className="text-xs font-medium text-slate-500 uppercase tracking-wide">Total spent</div>
            <div className="text-2xl font-semibold mt-1">{formatCurrency(summary.total)}</div>
          </Card>
          <Card className="p-4">
            <div className="text-xs font-medium text-slate-500 uppercase tracking-wide">Linked to jobs</div>
            <div className="text-2xl font-semibold mt-1">{formatCurrency(summary.linked)}</div>
          </Card>
          <Card className={`p-4 ${summary.unlinkedCount > 0 ? "border-amber-300 bg-amber-50" : ""}`}>
            <div className={`text-xs font-medium uppercase tracking-wide ${summary.unlinkedCount > 0 ? "text-amber-800" : "text-slate-500"}`}>Not linked to a job</div>
            <div className={`text-2xl font-semibold mt-1 ${summary.unlinkedCount > 0 ? "text-amber-800" : ""}`}>{formatCurrency(summary.unlinked)}</div>
          </Card>
        </div>
      )}

      <Card className="overflow-hidden">
        {lines.length === 0 ? (
          <div className="p-6"><EmptyState message="No invoices from this supplier yet." /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wide">
                  <th className="px-4 py-2.5">Date</th>
                  <th className="px-4 py-2.5">Invoice / item</th>
                  <th className="px-4 py-2.5">Job</th>
                  <th className="px-4 py-2.5 text-right">Amount</th>
                  <th className="px-4 py-2.5 text-right">File</th>
                  {editable && <th className="px-2 py-2.5" />}
                </tr>
              </thead>
              <tbody>
                {lines.map((m) => {
                  const unlinked = !m.project_id;
                  const url = links.get(m.id);
                  return (
                    <tr key={m.id} className={`border-t border-slate-100 ${unlinked ? "bg-amber-50/60" : ""}`}>
                      <td className="px-4 py-3 whitespace-nowrap">{formatDateShort(materialDate(m))}</td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-900">{m.description}</div>
                        {m.quantity !== 1 || (m.unit && m.unit !== "invoice" && m.unit !== "unit") ? (
                          <div className="text-xs text-slate-500">{m.quantity} {m.unit ?? "unit"}{m.unit_price != null ? ` × ${formatCurrencyPrecise(m.unit_price)}` : ""}</div>
                        ) : null}
                      </td>
                      <td className="px-4 py-3">
                        {editable ? (
                          <div className="flex flex-col gap-1">
                            <LinkToJobForm materialId={m.id} projectId={m.project_id} jobs={jobs} />
                            {m.project_id && (
                              <Link href={`/projects/${m.project_id}`} className="text-xs text-sky-700 hover:underline">{jobLabel(m.project_id)} →</Link>
                            )}
                            {m.cost > 0 && jobs.length > 1 && <SplitInvoiceForm materialId={m.id} total={m.cost} jobs={jobs} />}
                            {m.split_from_id && <span className="text-[10px] text-slate-400">Part of a split invoice</span>}
                          </div>
                        ) : m.project_id ? (
                          <Link href={`/projects/${m.project_id}`} className="text-sky-700 hover:underline">{jobLabel(m.project_id)}</Link>
                        ) : (
                          <span className="rounded-full bg-amber-100 text-amber-900 px-2 py-0.5 text-xs font-medium">Not linked</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold tabular-nums whitespace-nowrap">{formatCurrencyPrecise(m.cost)}</td>
                      <td className="px-4 py-3 text-right">
                        {url ? (
                          <a href={url} target="_blank" rel="noreferrer" className="text-sky-700 hover:underline text-xs">{m.invoice_name ?? "Invoice"}</a>
                        ) : (
                          <span className="text-slate-400 text-xs">—</span>
                        )}
                      </td>
                      {editable && (
                        <td className="px-2 py-3 text-right">
                          <form action={deleteSupplierInvoiceAction.bind(null, m.id, m.project_id)}>
                            <button type="submit" className="text-slate-400 hover:text-rose-600 text-sm" aria-label="Delete this invoice line" title="Delete">✕</button>
                          </form>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      <p className="text-xs text-slate-500 mt-3">
        Linking an invoice to a job moves it from &quot;Not linked&quot; into that job&apos;s materials cost. The supplier total does not change, because it is the same invoice.
      </p>
    </div>
  );
}
