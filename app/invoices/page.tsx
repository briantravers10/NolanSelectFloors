import Link from "next/link";
import { listBuildings, listInvoices, listProjects } from "@/lib/db";
import { Card, EmptyState, LinkButton, PageHeader, StatusBadge } from "@/components/ui";
import { Icon } from "@/components/Icon";
import { formatCurrencyPrecise } from "@/lib/calculations";
import { INVOICE_STATUSES } from "@/lib/types";

export default async function InvoicesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; supplier?: string; group?: string }>;
}) {
  const { status, supplier, group } = await searchParams;
  const [invoices, projects, buildings] = await Promise.all([listInvoices(), listProjects(), listBuildings()]);
  const projectById = new Map(projects.map((p) => [p.id, p]));
  const buildingById = new Map(buildings.map((b) => [b.id, b]));

  const suppliers = Array.from(new Set(invoices.map((i) => i.supplier))).sort();

  const filtered = invoices
    .filter((i) => !status || i.status === status)
    .filter((i) => !supplier || i.supplier === supplier);

  const groupBy = group === "supplier" || group === "address" ? group : undefined;

  const groupLabel = (inv: (typeof invoices)[number]) => {
    if (groupBy === "supplier") return inv.supplier;
    if (groupBy === "address") {
      const building = inv.related_building_id ? buildingById.get(inv.related_building_id) : undefined;
      return building ? `${building.name} — ${building.address}` : "No building linked";
    }
    return undefined;
  };

  const groups = groupBy
    ? Array.from(new Set(filtered.map(groupLabel))).sort((a, b) => (a ?? "").localeCompare(b ?? ""))
    : [undefined];

  return (
    <div>
      <PageHeader
        title="Invoices"
        subtitle="Supplier invoices — entered manually today, routed automatically once Gmail is connected."
        action={<LinkButton href="/invoices/new"><Icon name="plus" className="w-4 h-4" />New Invoice</LinkButton>}
      />

      <div className="flex flex-wrap gap-2 mb-5 border-b border-slate-200 pb-3">
        <Link href="/invoices" className={`text-sm font-medium rounded-lg px-3 py-1.5 ${!group ? "bg-slate-900 text-white" : "text-slate-500 hover:bg-slate-100"}`}>
          All Invoices
        </Link>
        <Link href="/invoices/rules" className="text-sm font-medium rounded-lg px-3 py-1.5 text-slate-500 hover:bg-slate-100">
          Email Routing Rules
        </Link>
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-5">
        <span className="text-xs text-slate-500 uppercase font-medium mr-1">Group by</span>
        <FilterLink href="/invoices" active={!groupBy} label="None" query={{ status, supplier }} />
        <FilterLink href="/invoices" active={groupBy === "supplier"} label="Supplier" query={{ status, supplier, group: "supplier" }} />
        <FilterLink href="/invoices" active={groupBy === "address"} label="Building Address" query={{ status, supplier, group: "address" }} />
        <span className="text-xs text-slate-500 uppercase font-medium ml-3 mr-1">Status</span>
        <FilterLink href="/invoices" active={!status} label="All" query={{ supplier, group }} />
        {INVOICE_STATUSES.map((s) => (
          <FilterLink key={s} href="/invoices" active={status === s} label={s} query={{ status: s, supplier, group }} />
        ))}
        <span className="text-xs text-slate-500 uppercase font-medium ml-3 mr-1">Supplier</span>
        <FilterLink href="/invoices" active={!supplier} label="All" query={{ status, group }} />
        {suppliers.map((s) => (
          <FilterLink key={s} href="/invoices" active={supplier === s} label={s} query={{ status, supplier: s, group }} />
        ))}
      </div>

      {filtered.length === 0 ? (
        <Card className="p-4"><EmptyState message="No invoices match this filter." /></Card>
      ) : (
        <div className="space-y-6">
          {groups.map((g) => {
            const rows = filtered
              .filter((i) => !groupBy || groupLabel(i) === g)
              .sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
            return (
              <div key={g ?? "all"}>
                {groupBy && <h2 className="text-sm font-semibold text-slate-900 uppercase tracking-wide mb-2">{g}</h2>}
                <Card>
                  <div className="divide-y divide-slate-100">
                    {rows.map((inv) => {
                      const project = inv.related_project_id ? projectById.get(inv.related_project_id) : undefined;
                      const building = inv.related_building_id ? buildingById.get(inv.related_building_id) : undefined;
                      return (
                        <div key={inv.id} className="px-4 py-3 flex flex-wrap items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium text-slate-900 truncate">{inv.supplier}</span>
                              {inv.source === "Email Auto-Routed" && (
                                <span className="text-[10px] font-semibold uppercase text-sky-700 bg-sky-50 rounded-full px-1.5 py-0.5 shrink-0">Auto-Routed</span>
                              )}
                            </div>
                            <div className="text-xs text-slate-500">
                              {building ? `${building.name}${project ? ` · ${project.name}` : ""}` : project ? project.name : "No project/building linked"}
                            </div>
                            {inv.notes && <p className="text-sm text-slate-600 mt-1 line-clamp-1">{inv.notes}</p>}
                            {!inv.file_reference && (
                              <div className="text-[11px] text-amber-700 mt-1">No file on record{inv.source === "Manual Entry" ? " — file storage isn't configured yet" : ""}.</div>
                            )}
                          </div>
                          <div className="text-right shrink-0">
                            <div className="text-sm font-medium text-slate-900">{formatCurrencyPrecise(inv.amount)}</div>
                            <StatusBadge status={inv.status} />
                            <div className="text-[11px] text-slate-400 mt-1">
                              {inv.invoice_date ? `Invoiced ${inv.invoice_date}` : "No invoice date"}{inv.due_date ? ` · Due ${inv.due_date}` : ""}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </Card>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function FilterLink({
  href,
  active,
  label,
  query,
}: {
  href: string;
  active: boolean;
  label: string;
  query: Record<string, string | undefined>;
}) {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) if (v) params.set(k, v);
  const qs = params.toString();
  return (
    <Link
      href={qs ? `${href}?${qs}` : href}
      className={`text-xs font-medium rounded-full px-3 py-1 border ${active ? "bg-slate-900 text-white border-slate-900" : "border-slate-300 text-slate-600"}`}
    >
      {label}
    </Link>
  );
}
