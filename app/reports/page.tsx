import Link from "next/link";
import {
  listBuildings,
  listClientCompanies,
  listContacts,
  listEmployees,
  listProjectMaterials,
  listProjects,
  listScheduleAssignments,
  listActualLaborEntries,
} from "@/lib/db";
import { Card, PageHeader } from "@/components/ui";
import { computeProjectCosting, formatCurrency, formatPercent, isActiveProjectStage, summarizeWeek } from "@/lib/calculations";
import { computeActualLaborCosts } from "@/lib/labor-cost";
import { addDays, isoDate, startOfWeek } from "@/lib/dates";
import { requireSectionAccess } from "@/lib/permissions";
import { AccessDenied } from "@/components/AccessDenied";

const TABS = ["labor", "materials", "projects", "clients"] as const;
type Tab = (typeof TABS)[number];

export default async function ReportsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const access = await requireSectionAccess("reports");
  if (access === "none") return <AccessDenied section="Reports" />;

  const { tab: tabParam } = await searchParams;
  const tab: Tab = TABS.includes(tabParam as Tab) ? (tabParam as Tab) : "labor";

  const [projects, buildings, clients, contacts, employees, assignments, projectMaterials, actualEntries] = await Promise.all([
    listProjects(),
    listBuildings(),
    listClientCompanies(),
    listContacts(),
    listEmployees(),
    listScheduleAssignments(),
    listProjectMaterials(),
    listActualLaborEntries(),
  ]);

  return (
    <div>
      <PageHeader title="Reports" subtitle="Labor, materials, project profitability, and client activity." />
      <div className="flex gap-2 mb-5">
        {TABS.map((t) => (
          <Link key={t} href={`/reports?tab=${t}`} className={`text-sm font-medium rounded-full px-4 py-1.5 border capitalize ${tab === t ? "bg-slate-900 text-white border-slate-900" : "border-slate-300 text-slate-600"}`}>
            {t}
          </Link>
        ))}
      </div>

      {tab === "labor" && <LaborReport assignments={assignments} employees={employees} projects={projects} buildings={buildings} actualEntries={actualEntries} />}
      {tab === "materials" && <MaterialsReport projects={projects} buildings={buildings} projectMaterials={projectMaterials} />}
      {tab === "projects" && <ProjectsReport projects={projects} buildings={buildings} clients={clients} assignments={assignments} projectMaterials={projectMaterials} />}
      {tab === "clients" && <ClientsReport projects={projects} buildings={buildings} clients={clients} contacts={contacts} />}
    </div>
  );
}

function LaborReport({
  assignments,
  employees,
  projects,
  buildings,
  actualEntries,
}: {
  assignments: Awaited<ReturnType<typeof listScheduleAssignments>>;
  employees: Awaited<ReturnType<typeof listEmployees>>;
  projects: Awaited<ReturnType<typeof listProjects>>;
  buildings: Awaited<ReturnType<typeof listBuildings>>;
  actualEntries: Awaited<ReturnType<typeof listActualLaborEntries>>;
}) {
  const monday = startOfWeek(new Date());
  const weekDates = Array.from({ length: 7 }, (_, i) => isoDate(addDays(monday, i)));
  const week = summarizeWeek(assignments, weekDates);
  const buildingById = new Map(buildings.map((b) => [b.id, b]));

  // All-time labor by project / employee from ACTUAL hours logged on End
  // of Day Review (the real spend), not the planned schedule cost.
  const byProject = new Map<string, number>();
  const byEmployee = new Map<string, number>();
  const entryById = new Map(actualEntries.map((e) => [e.id, e]));
  for (const c of computeActualLaborCosts(actualEntries)) {
    const e = entryById.get(c.entryId);
    if (!e) continue;
    byProject.set(e.project_id, (byProject.get(e.project_id) ?? 0) + c.cost);
    byEmployee.set(e.employee_id, (byEmployee.get(e.employee_id) ?? 0) + c.cost);
  }
  const projectRows = Array.from(byProject.entries())
    .map(([id, cost]) => ({ project: projects.find((p) => p.id === id), cost }))
    .filter((r) => r.project)
    .sort((a, b) => b.cost - a.cost);
  const employeeRows = Array.from(byEmployee.entries())
    .map(([id, cost]) => ({ employee: employees.find((e) => e.id === id), cost }))
    .filter((r) => r.employee)
    .sort((a, b) => b.cost - a.cost);

  const maxCost = Math.max(...week.days.map((d) => d.laborCost), 1);

  return (
    <div className="space-y-5">
      <Card className="p-4">
        <h2 className="text-sm font-semibold text-slate-900 uppercase tracking-wide mb-3">This Week — Daily Man Count &amp; Labor Cost</h2>
        <div className="space-y-2">
          {week.days.map((d) => (
            <div key={d.date} className="flex items-center gap-3">
              <div className="w-24 text-xs text-slate-500 shrink-0">{d.date}</div>
              <div className="flex-1 bg-slate-100 rounded h-5 relative overflow-hidden">
                <div className="bg-sky-500 h-5 rounded" style={{ width: `${(d.laborCost / maxCost) * 100}%` }} />
              </div>
              <div className="w-40 text-xs text-slate-600 text-right shrink-0">{d.manCount} crew · {formatCurrency(d.laborCost)}</div>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-3 gap-3 mt-4 text-sm">
          <div><div className="text-xs text-slate-500 uppercase">Total Man-Days</div><div className="font-semibold">{week.totalManDays}</div></div>
          <div><div className="text-xs text-slate-500 uppercase">Normal Rate Cost</div><div className="font-semibold">{formatCurrency(week.totalNormalCost)}</div></div>
          <div><div className="text-xs text-slate-500 uppercase">Time-and-Half Cost</div><div className="font-semibold text-amber-600">{formatCurrency(week.totalTimeAndHalfCost)}</div></div>
        </div>
      </Card>

      <Card className="p-4">
        <h2 className="text-sm font-semibold text-slate-900 uppercase tracking-wide mb-3">Labor Cost by Project (actual hours, all time)</h2>
        <table className="w-full text-sm">
          <tbody>
            {projectRows.map(({ project, cost }) => (
              <tr key={project!.id} className="border-b border-slate-100 last:border-0">
                <td className="py-2">{project!.name}</td>
                <td className="py-2 text-xs text-slate-500">{buildingById.get(project!.building_id)?.name}</td>
                <td className="py-2 text-right font-medium">{formatCurrency(cost)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <Card className="p-4">
        <h2 className="text-sm font-semibold text-slate-900 uppercase tracking-wide mb-3">Labor Cost by Employee (actual hours, all time)</h2>
        <table className="w-full text-sm">
          <tbody>
            {employeeRows.map(({ employee, cost }) => (
              <tr key={employee!.id} className="border-b border-slate-100 last:border-0">
                <td className="py-2">{employee!.first_name} {employee!.last_name}</td>
                <td className="py-2 text-xs text-slate-500">{employee!.title}</td>
                <td className="py-2 text-right font-medium">{formatCurrency(cost)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

function ProjectsReport({
  projects,
  buildings,
  clients,
  assignments,
  projectMaterials,
}: {
  projects: Awaited<ReturnType<typeof listProjects>>;
  buildings: Awaited<ReturnType<typeof listBuildings>>;
  clients: Awaited<ReturnType<typeof listClientCompanies>>;
  assignments: Awaited<ReturnType<typeof listScheduleAssignments>>;
  projectMaterials: Awaited<ReturnType<typeof listProjectMaterials>>;
}) {
  const buildingById = new Map(buildings.map((b) => [b.id, b]));
  const clientById = new Map(clients.map((c) => [c.id, c]));
  const active = projects.filter(isActiveProjectStage);
  const completed = projects.filter((p) => !isActiveProjectStage(p));

  const byClient = new Map<string, { value: number; count: number }>();
  for (const p of projects) {
    const building = buildingById.get(p.building_id);
    if (!building) continue;
    const entry = byClient.get(building.client_company_id) ?? { value: 0, count: 0 };
    entry.value += p.project_value;
    entry.count += 1;
    byClient.set(building.client_company_id, entry);
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3">
        <Card className="p-4"><div className="text-xs text-slate-500 uppercase">Active Projects</div><div className="text-2xl font-semibold">{active.length}</div></Card>
        <Card className="p-4"><div className="text-xs text-slate-500 uppercase">Completed Projects</div><div className="text-2xl font-semibold">{completed.length}</div></Card>
      </div>

      <Card className="p-4">
        <h2 className="text-sm font-semibold text-slate-900 uppercase tracking-wide mb-3">Value by Management Company</h2>
        <table className="w-full text-sm">
          <tbody>
            {Array.from(byClient.entries()).sort((a, b) => b[1].value - a[1].value).map(([id, { value, count }]) => (
              <tr key={id} className="border-b border-slate-100 last:border-0">
                <td className="py-2">{clientById.get(id)?.name}</td>
                <td className="py-2 text-xs text-slate-500">{count} jobs</td>
                <td className="py-2 text-right font-medium">{formatCurrency(value)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <Card className="p-4">
        <h2 className="text-sm font-semibold text-slate-900 uppercase tracking-wide mb-3">Project Profitability</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-slate-500 uppercase border-b border-slate-200">
                <th className="py-2 pr-3">Project</th>
                <th className="py-2 pr-3 text-right">Value</th>
                <th className="py-2 pr-3 text-right">Labor</th>
                <th className="py-2 pr-3 text-right">Material</th>
                <th className="py-2 pr-3 text-right">Profit</th>
                <th className="py-2 text-right">Margin</th>
              </tr>
            </thead>
            <tbody>
              {projects.map((p) => {
                const costing = computeProjectCosting(p, assignments, projectMaterials, p.id);
                return (
                  <tr key={p.id} className="border-b border-slate-100 last:border-0">
                    <td className="py-2 pr-3">{p.name}</td>
                    <td className="py-2 pr-3 text-right">{formatCurrency(costing.projectValue)}</td>
                    <td className="py-2 pr-3 text-right">{formatCurrency(costing.laborCost)}</td>
                    <td className="py-2 pr-3 text-right">{formatCurrency(costing.materialCost)}</td>
                    <td className={`py-2 pr-3 text-right font-medium ${costing.grossProfit >= 0 ? "text-emerald-600" : "text-rose-600"}`}>{formatCurrency(costing.grossProfit)}</td>
                    <td className="py-2 text-right">{formatPercent(costing.grossMarginPct)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function ClientsReport({
  projects,
  buildings,
  clients,
  contacts,
}: {
  projects: Awaited<ReturnType<typeof listProjects>>;
  buildings: Awaited<ReturnType<typeof listBuildings>>;
  clients: Awaited<ReturnType<typeof listClientCompanies>>;
  contacts: Awaited<ReturnType<typeof listContacts>>;
}) {
  return (
    <div className="space-y-5">
      <Card className="p-4">
        <h2 className="text-sm font-semibold text-slate-900 uppercase tracking-wide mb-3">Jobs by Management Company</h2>
        <table className="w-full text-sm">
          <tbody>
            {clients.map((c) => {
              const buildingIds = new Set(buildings.filter((b) => b.client_company_id === c.id).map((b) => b.id));
              const count = projects.filter((p) => buildingIds.has(p.building_id)).length;
              return (
                <tr key={c.id} className="border-b border-slate-100 last:border-0">
                  <td className="py-2">{c.name}</td>
                  <td className="py-2 text-right font-medium">{count} jobs</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>

      <Card className="p-4">
        <h2 className="text-sm font-semibold text-slate-900 uppercase tracking-wide mb-3">Jobs by Building</h2>
        <table className="w-full text-sm">
          <tbody>
            {buildings.map((b) => {
              const count = projects.filter((p) => p.building_id === b.id).length;
              if (count === 0) return null;
              return (
                <tr key={b.id} className="border-b border-slate-100 last:border-0">
                  <td className="py-2">{b.name}</td>
                  <td className="py-2 text-right font-medium">{count} jobs</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>

      <Card className="p-4">
        <h2 className="text-sm font-semibold text-slate-900 uppercase tracking-wide mb-3">Property Managers</h2>
        <table className="w-full text-sm">
          <tbody>
            {contacts.map((ct) => {
              const managed = buildings.filter((b) => b.primary_contact_id === ct.id);
              if (managed.length === 0) return null;
              return (
                <tr key={ct.id} className="border-b border-slate-100 last:border-0">
                  <td className="py-2">{ct.first_name} {ct.last_name}</td>
                  <td className="py-2 text-xs text-slate-500">{managed.map((b) => b.name).join(", ")}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

function MaterialsReport({
  projects,
  buildings,
  projectMaterials,
}: {
  projects: Awaited<ReturnType<typeof listProjects>>;
  buildings: Awaited<ReturnType<typeof listBuildings>>;
  projectMaterials: Awaited<ReturnType<typeof listProjectMaterials>>;
}) {
  const buildingById = new Map(buildings.map((b) => [b.id, b]));
  const projectById = new Map(projects.map((p) => [p.id, p]));

  // Every spend line: materials added on a job, priced schedule pickups,
  // and supplier-only invoices (no job). One record each, so the company
  // total here is complete and nothing is counted twice.
  const lines = projectMaterials.map((m) => ({
    projectId: m.project_id,
    supplier: m.supplier?.trim() || "No supplier",
    cost: m.cost,
    date: m.ordered_at?.slice(0, 10) ?? m.created_at.slice(0, 10),
    description: m.description,
  }));

  const bySupplier = new Map<string, { cost: number; count: number }>();
  const byProject = new Map<string, number>();
  let unlinked = 0;
  for (const l of lines) {
    const sup = bySupplier.get(l.supplier) ?? { cost: 0, count: 0 };
    sup.cost += l.cost;
    sup.count += 1;
    bySupplier.set(l.supplier, sup);
    if (l.projectId) byProject.set(l.projectId, (byProject.get(l.projectId) ?? 0) + l.cost);
    else unlinked += l.cost;
  }
  const supplierRows = [...bySupplier.entries()].sort((a, b) => b[1].cost - a[1].cost);
  const projectRows = [...byProject.entries()].map(([id, cost]) => ({ project: projectById.get(id), cost })).filter((r) => r.project).sort((a, b) => b.cost - a.cost);
  const total = lines.reduce((s, l) => s + l.cost, 0);
  const recent = [...lines].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 25);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="p-4"><div className="text-xs text-slate-500 uppercase">Materials spend (all time)</div><div className="text-2xl font-semibold">{formatCurrency(total)}</div></Card>
        <Card className="p-4"><div className="text-xs text-slate-500 uppercase">Not linked to a job</div><div className="text-2xl font-semibold">{formatCurrency(unlinked)}</div><Link href="/suppliers" className="text-xs text-sky-600 hover:underline">Suppliers →</Link></Card>
        <Card className="p-4"><div className="text-xs text-slate-500 uppercase">Suppliers used</div><div className="text-2xl font-semibold">{supplierRows.filter(([n]) => n !== "No supplier" && n !== "Schedule pickups").length}</div></Card>
        <Card className="p-4"><div className="text-xs text-slate-500 uppercase">Lines recorded</div><div className="text-2xl font-semibold">{lines.length}</div></Card>
      </div>

      <Card className="p-4">
        <h2 className="text-sm font-semibold text-slate-900 uppercase tracking-wide mb-3">Spend by Supplier</h2>
        {supplierRows.length === 0 ? (
          <p className="text-sm text-slate-500">No materials recorded yet. Add them on a job under Materials — with a supplier name to see it here.</p>
        ) : (
          <table className="w-full text-sm">
            <tbody>
              {supplierRows.map(([name, v]) => (
                <tr key={name} className="border-b border-slate-100 last:border-0">
                  <td className="py-2">{name}</td>
                  <td className="py-2 text-xs text-slate-500">{v.count} line{v.count === 1 ? "" : "s"}</td>
                  <td className="py-2 text-right font-medium">{formatCurrency(v.cost)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <Card className="p-4">
        <h2 className="text-sm font-semibold text-slate-900 uppercase tracking-wide mb-3">Spend by Job</h2>
        {projectRows.length === 0 ? (
          <p className="text-sm text-slate-500">Nothing yet.</p>
        ) : (
          <table className="w-full text-sm">
            <tbody>
              {projectRows.map(({ project, cost }) => (
                <tr key={project!.id} className="border-b border-slate-100 last:border-0">
                  <td className="py-2"><Link href={`/projects/${project!.id}`} className="text-sky-700 hover:underline">{project!.name}</Link></td>
                  <td className="py-2 text-xs text-slate-500">{buildingById.get(project!.building_id)?.name}</td>
                  <td className="py-2 text-right font-medium">{formatCurrency(cost)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <Card className="p-4">
        <h2 className="text-sm font-semibold text-slate-900 uppercase tracking-wide mb-3">Recent Purchases</h2>
        {recent.length === 0 ? (
          <p className="text-sm text-slate-500">Nothing yet.</p>
        ) : (
          <table className="w-full text-sm">
            <tbody>
              {recent.map((l, i) => (
                <tr key={i} className="border-b border-slate-100 last:border-0">
                  <td className="py-1.5 text-xs text-slate-500 w-24">{l.date}</td>
                  <td className="py-1.5">{l.description}</td>
                  <td className="py-1.5 text-xs text-slate-500">{l.projectId ? projectById.get(l.projectId)?.name : <span className="text-amber-700">No job</span>}</td>
                  <td className="py-1.5 text-xs text-slate-500">{l.supplier}</td>
                  <td className="py-1.5 text-right font-medium">{formatCurrency(l.cost)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
