import Link from "next/link";
import { listBuildings, listClientCompanies, listProjectMaterials, listProjects } from "@/lib/db";
import { Card, PageHeader, EmptyState } from "@/components/ui";
import { formatCurrency, isActiveProjectStage } from "@/lib/calculations";
import { formatDateShort } from "@/lib/dates";
import { requireSectionAccess, canEdit } from "@/lib/permissions";
import { AccessDenied } from "@/components/AccessDenied";
import { isFileStorageConfigured } from "@/lib/storage";
import { summarizeSuppliers, supplierSlug, totalSuppliers, NO_SUPPLIER } from "@/lib/suppliers";
import { AddSupplierInvoiceForm } from "@/components/suppliers/AddSupplierInvoiceForm";

/**
 * SUPPLIERS — where the money went, by supplier. Every figure comes from
 * the same materials/invoice lines the job pages use (one record each), so
 * a supplier total and a job total can both show the same invoice without
 * it ever being added twice. Amber = invoices not linked to any job.
 */
export default async function SuppliersPage() {
  const access = await requireSectionAccess("materials");
  if (access === "none") return <AccessDenied section="Suppliers" />;
  const [materials, projects, buildings, clients, editable] = await Promise.all([listProjectMaterials(), listProjects(), listBuildings(), listClientCompanies(), canEdit("materials")]);

  const rows = summarizeSuppliers(materials);
  const totals = totalSuppliers(rows);
  const supplierNames = rows.map((r) => r.name).filter((n) => n !== NO_SUPPLIER);

  const buildingById = new Map(buildings.map((b) => [b.id, b]));
  const clientById = new Map(clients.map((c) => [c.id, c]));
  const jobs = projects
    .filter((p) => isActiveProjectStage(p))
    .map((p) => {
      const b = buildingById.get(p.building_id);
      const c = b ? clientById.get(b.client_company_id) : undefined;
      return { id: p.id, label: `${b?.name ?? p.name}${p.unit_number ? ` — Unit ${p.unit_number}` : ""}${c ? ` · ${c.name}` : ""}` };
    })
    .sort((a, b) => a.label.localeCompare(b.label));

  return (
    <div>
      <PageHeader
        title="Suppliers"
        subtitle="Every invoice is stored once. It counts toward the supplier here and toward a job only if it is linked to one."
        action={editable ? <AddSupplierInvoiceForm suppliers={supplierNames} jobs={jobs} storageConfigured={isFileStorageConfigured()} /> : undefined}
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        <Card className="p-4">
          <div className="text-xs font-medium text-slate-500 uppercase tracking-wide">Total spent</div>
          <div className="text-2xl font-semibold mt-1">{formatCurrency(totals.total)}</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs font-medium text-slate-500 uppercase tracking-wide">Linked to jobs</div>
          <div className="text-2xl font-semibold mt-1">{formatCurrency(totals.linked)}</div>
        </Card>
        <Card className={`p-4 ${totals.unlinkedCount > 0 ? "border-amber-300 bg-amber-50" : ""}`}>
          <div className={`text-xs font-medium uppercase tracking-wide ${totals.unlinkedCount > 0 ? "text-amber-800" : "text-slate-500"}`}>Not linked to a job</div>
          <div className={`text-2xl font-semibold mt-1 ${totals.unlinkedCount > 0 ? "text-amber-800" : ""}`}>{formatCurrency(totals.unlinked)}</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs font-medium text-slate-500 uppercase tracking-wide">Invoices &amp; lines</div>
          <div className="text-2xl font-semibold mt-1">{totals.count}</div>
        </Card>
      </div>

      <Card className="overflow-hidden">
        {rows.length === 0 ? (
          <div className="p-6"><EmptyState message="No supplier spend yet. Add an invoice here, on a job's Materials, or file one from Email Inbox." /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wide">
                  <th className="px-4 py-2.5">Supplier</th>
                  <th className="px-4 py-2.5 text-right">Total spent</th>
                  <th className="px-4 py-2.5 text-right">Linked to jobs</th>
                  <th className="px-4 py-2.5 text-right">Not linked</th>
                  <th className="px-4 py-2.5 text-right">Invoices</th>
                  <th className="px-4 py-2.5 text-right">Last invoice</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.name} className="border-t border-slate-100 hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <Link href={`/suppliers/${supplierSlug(r.name)}`} className="font-medium text-sky-700 hover:underline">{r.name}</Link>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">{formatCurrency(r.total)}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{formatCurrency(r.linked)}</td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {r.unlinkedCount > 0 ? (
                        <span className="font-semibold text-amber-800">
                          {formatCurrency(r.unlinked)}
                          <span className="ml-1.5 rounded-full bg-amber-100 px-1.5 py-0.5 text-[11px]">{r.unlinkedCount}</span>
                        </span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">{r.count}</td>
                    <td className="px-4 py-3 text-right text-slate-500">{r.lastDate ? formatDateShort(r.lastDate) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      <p className="text-xs text-slate-500 mt-3">
        Tap a supplier to see every invoice. Amber amounts are invoices with no job yet: they count in the supplier total and in the company materials total, but in no job.
      </p>
    </div>
  );
}
