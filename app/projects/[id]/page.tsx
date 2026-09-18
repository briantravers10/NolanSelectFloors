import { notFound } from "next/navigation";
import Link from "next/link";
import {
  listActivityLog,
  listActualLaborEntries,
  listBuildings,
  listClientCompanies,
  listCrewRequirements,
  listEmployees,
  listEmployeeSkills,
  listMaterialRateItems,
  listOfficeUsers,
  listPricingFormulaComponents,
  listPricingFormulas,
  listProjectMaterials,
  listProjectScheduleDays,
  listSchedulePickupItems,
  listProjectNotes,
  listProjects,
  listProjectWorkTypes,
  listScheduleAssignments,
  listTasks,
} from "@/lib/db";
import { canManageQuickBooksDocuments, canViewJobFinancials, canViewLaborCost, canViewQuickBooks, getActingUser } from "@/lib/current-user";
import { jobLaborSummary } from "@/lib/labor-cost";
import { Card, StatusBadge, Button, EmptyState, Stat } from "@/components/ui";
import { EditableTitle } from "@/components/projects/EditableTitle";
import { CrewRequirementForm } from "@/components/projects/CrewRequirementForm";
import { AddMaterialForm } from "@/components/projects/AddMaterialForm";
import { isFileStorageConfigured, materialInvoiceUrl } from "@/lib/storage";
import { canEdit } from "@/lib/permissions";
import { EstimateCalculator } from "@/components/EstimateCalculator";
import { QuickBooksDocumentList } from "@/components/quickbooks/QuickBooksDocumentList";
import { FinancialSummaryCard } from "@/components/quickbooks/FinancialSummaryCard";
import { computeFinancialSummary } from "@/lib/financials";
import { isQuickBooksConnected } from "@/lib/quickbooks";
import { getQuickBooksConnection, listQuickBooksDocumentsForProject } from "@/lib/db";
import {
  compareCrewForProjectDate,
  computeProjectCosting,
  formatCurrency,
  formatPercent,
  isMissingDriver,
} from "@/lib/calculations";
import { formatDateLong } from "@/lib/dates";
import { PIPELINE_STAGES } from "@/lib/types";
import {
  deleteCrewRequirementAction,
  deleteProjectMaterialAction,
  addProjectDrawingAction,
  setPickupItemCostAction,
  addProjectNoteAction,
  addProjectPhotoAction,
  addProjectTaskAction,
  movePipelineStageFormAction,
  saveProjectEstimateAction,
} from "../actions";
import { PHOTO_CATEGORIES } from "@/lib/types";
import { listPhotos, listProjectDrawings } from "@/lib/db";
import { isPhotoStorageConfigured } from "@/lib/storage";

export default async function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [
    projects,
    buildings,
    clients,
    workTypes,
    assignments,
    employees,
    employeeSkills,
    crewRequirements,
    materials,
    scheduleDays,
    pickupItemsAll,
    tasks,
    notes,
    ,
    actingUser,
    activityLog,
    photos,
    drawings,
    pricingFormulas,
    formulaComponents,
    materialRateItems,
    actualLaborEntries,
    qbDocuments,
    qbConnection,
  ] = await Promise.all([
    listProjects(),
    listBuildings(),
    listClientCompanies(),
    listProjectWorkTypes(),
    listScheduleAssignments(),
    listEmployees(),
    listEmployeeSkills(),
    listCrewRequirements(),
    listProjectMaterials(),
    listProjectScheduleDays(),
    listSchedulePickupItems(),
    listTasks(),
    listProjectNotes(),
    listOfficeUsers(),
    getActingUser(),
    listActivityLog(),
    listPhotos(),
    listProjectDrawings(),
    listPricingFormulas(),
    listPricingFormulaComponents(),
    listMaterialRateItems(),
    listActualLaborEntries(),
    listQuickBooksDocumentsForProject(id),
    getQuickBooksConnection(),
  ]);

  const project = projects.find((p) => p.id === id);
  const canEditProjects = await canEdit("projects");
  if (!project) notFound();

  const building = buildings.find((b) => b.id === project.building_id);
  const client = building ? clients.find((c) => c.id === building.client_company_id) : undefined;
  const projectWorkTypes = workTypes.filter((wt) => wt.project_id === id);
  const projectWorkTypeSet = new Set(projectWorkTypes.map((wt) => wt.work_type));
  const matchingFormulas = pricingFormulas.filter((f) => f.active && projectWorkTypeSet.has(f.work_type));
  const calculatorFormulas = matchingFormulas.length > 0 ? matchingFormulas : pricingFormulas.filter((f) => f.active);
  const projectAssignments = assignments.filter((a) => a.project_id === id).sort((a, b) => a.schedule_date.localeCompare(b.schedule_date));
  const scheduledDates = Array.from(new Set(projectAssignments.map((a) => a.schedule_date))).sort();
  const projectCrewReqs = crewRequirements.filter((r) => r.project_id === id);
  const projectMaterialsList = materials.filter((m) => m.project_id === id);
  // Quick "Items to Order / Collect" added on the schedule for this job —
  // listed here so a price can be put against them.
  const dayById = new Map(scheduleDays.filter((d) => d.project_id === id).map((d) => [d.id, d]));
  const projectPickupItems = pickupItemsAll
    .filter((i) => dayById.has(i.project_schedule_day_id))
    .map((i) => ({ ...i, date: dayById.get(i.project_schedule_day_id)!.schedule_date }))
    .sort((a, b) => a.date.localeCompare(b.date) || a.created_at.localeCompare(b.created_at));
  const pickupCostTotal = projectPickupItems.reduce((sum, i) => sum + (i.cost ?? 0), 0);
  const projectTasks = tasks.filter((t) => t.related_type === "project" && t.related_id === id);
  const projectNotes = notes.filter((n) => n.project_id === id);
  const employeeById = new Map(employees.map((e) => [e.id, e]));
  const projectActivity = activityLog.filter((a) => a.related_type === "project" && a.related_id === id);
  const projectPhotos = photos
    .filter((ph) => ph.related_type === "project" && ph.related_id === id)
    .sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
  const photoStorageConfigured = isPhotoStorageConfigured();
  const projectDrawings = drawings.filter((d) => d.project_id === id).sort((a, b) => (a.uploaded_at < b.uploaded_at ? 1 : -1));
  const currentDrawings = projectDrawings.filter((d) => d.is_current_version);
  const drawingsByName = new Map<string, typeof projectDrawings>();
  for (const d of projectDrawings) {
    const key = `${d.drawing_name}__${d.drawing_number ?? ""}`;
    if (!drawingsByName.has(key)) drawingsByName.set(key, []);
    drawingsByName.get(key)!.push(d);
  }

  const costing = computeProjectCosting(project, assignments, materials, id, pickupCostTotal);
  const canEditMaterials = await canEdit("materials");
  const canViewRates = canViewLaborCost(actingUser);
  const storageConfigured = isFileStorageConfigured();
  const supplierNames = [...new Set(materials.map((m) => m.supplier?.trim()).filter((x): x is string => Boolean(x)))].sort();
  const invoiceUrls = new Map<string, string>();
  for (const m of projectMaterialsList) {
    if (m.invoice_path) {
      const url = await materialInvoiceUrl(m.invoice_path);
      if (url) invoiceUrls.set(m.id, url);
    }
  }
  const skillsByEmployee = new Map<string, string[]>();
  for (const sk of employeeSkills) skillsByEmployee.set(sk.employee_id, [...(skillsByEmployee.get(sk.employee_id) ?? []), sk.capability]);
  const crewPicks = employees
    .filter((e) => e.active)
    .map((e) => ({ id: e.id, first_name: e.first_name, last_name: e.last_name, nickname: e.nickname, capabilities: skillsByEmployee.get(e.id) ?? [], dayRate: canViewRates ? e.day_rate ?? null : null }));
  const crewEstimateTotal = projectCrewReqs.reduce((sum, r) => {
    const perDay = (r.employee_ids ?? []).reduce((s2, eid) => s2 + (employeeById.get(eid)?.day_rate ?? 0), 0);
    return sum + perDay * (r.estimated_days ?? 0);
  }, 0);
  const canViewCost = canViewLaborCost(actingUser);
  const laborSummary = jobLaborSummary(id, actualLaborEntries, employees);
  const canQBView = canViewQuickBooks(actingUser);
  const canQBManage = canManageQuickBooksDocuments(actingUser);
  const canFinancials = canViewJobFinancials(actingUser);
  const qbConnected = isQuickBooksConnected(qbConnection);
  const financialSummary = computeFinancialSummary(project, assignments, materials, qbDocuments, qbConnected);

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3 mb-5">
        <div>
          <EditableTitle projectId={project.id} name={project.name} canEdit={canEditProjects} />
          {building && <p className="text-sm text-slate-500 mt-0.5">{building.name} · {client?.name ?? ""}</p>}
        </div>
        <div className="flex flex-wrap gap-1.5 justify-end">
          <StatusBadge status={project.pipeline_stage} />
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <Stat label="Project Value" value={formatCurrency(costing.projectValue)} />
        <Stat label={laborSummary.rows.length > 0 ? "Labor Cost (actual hours)" : "Labor Cost (planned)"} value={formatCurrency(laborSummary.rows.length > 0 ? laborSummary.totalLaborCost : costing.laborCost)} />
        <Stat label="Total Cost" value={formatCurrency(costing.totalCost)} />
        <Stat label="Gross Margin" value={formatPercent(costing.grossMarginPct)} tone={costing.grossMarginPct !== null && costing.grossMarginPct < 20 ? "bad" : "good"} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 space-y-5">
          <Card className="p-4">
            <h2 className="text-sm font-semibold text-slate-900 uppercase tracking-wide mb-2">Overview</h2>
            <p className="text-sm text-slate-700 mb-3">{project.description}</p>
            <div className="grid grid-cols-2 gap-4 text-sm mb-3">
              <div><div className="text-xs text-slate-500 uppercase">Unit</div><div>{project.unit_number ?? "—"}</div></div>
              <div><div className="text-xs text-slate-500 uppercase">Start</div><div>{formatDateLong(project.start_date)}</div></div>
              <div><div className="text-xs text-slate-500 uppercase">Target End</div><div>{formatDateLong(project.target_end_date)}</div></div>
              <div><div className="text-xs text-slate-500 uppercase">Transportation Needed</div><div>{project.needs_transportation ? "Yes" : "No"}</div></div>
            </div>
            <div className="flex flex-wrap gap-1.5 mb-4">
              {projectWorkTypes.map((wt) => (
                <span key={wt.id} className="text-xs bg-slate-100 rounded-full px-2.5 py-1 text-slate-600">{wt.work_type}</span>
              ))}
            </div>
            <div className="text-xs font-semibold text-slate-500 uppercase mb-2">Pipeline Stage</div>
            <form action={movePipelineStageFormAction.bind(null, project.id)} className="flex flex-wrap items-center gap-2 mb-4">
              <select name="stage" defaultValue={project.pipeline_stage} className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm">
                {PIPELINE_STAGES.map((s) => (
                  <option key={s} value={s}>{s}{s === project.pipeline_stage ? " (current)" : ""}</option>
                ))}
              </select>
              <Button type="submit" variant="secondary">Move</Button>
              <span className="text-xs text-slate-400">Can move forward or backward — e.g. to undo an accidental advance.</span>
            </form>
          </Card>

          <Card className="p-4">
            <div className="flex items-baseline justify-between mb-1">
              <h2 className="text-sm font-semibold text-slate-900 uppercase tracking-wide">Crew Estimate</h2>
              {canViewRates && projectCrewReqs.length > 0 && (
                <div className="text-sm text-slate-700">Estimated labor: <span className="font-semibold text-slate-900">{formatCurrency(crewEstimateTotal)}</span></div>
              )}
            </div>
            <p className="text-xs text-slate-500 mb-3">Who you&apos;d send and for how long — their day rates give the labor number for the quote.</p>
            {canEditProjects && <CrewRequirementForm projectId={project.id} employees={crewPicks} canViewRates={canViewRates} />}
            {projectCrewReqs.length === 0 ? (
              <EmptyState message="No crew estimated yet." />
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-slate-500 uppercase border-b border-slate-200">
                    <th className="py-1.5">Role</th>
                    <th className="py-1.5">Who</th>
                    <th className="py-1.5 text-right">Days</th>
                    {canViewRates && <th className="py-1.5 text-right">Per day</th>}
                    {canViewRates && <th className="py-1.5 text-right">Estimate</th>}
                    <th className="py-1.5" />
                  </tr>
                </thead>
                <tbody>
                  {projectCrewReqs.map((r) => {
                    const people = (r.employee_ids ?? []).map((eid) => employeeById.get(eid)).filter(Boolean);
                    const perDay = people.reduce((sum, e) => sum + (e!.day_rate ?? 0), 0);
                    const days = r.estimated_days ?? 0;
                    return (
                      <tr key={r.id} className="border-b border-slate-100 last:border-0 align-top">
                        <td className="py-1.5">{r.quantity} × {r.role}{r.schedule_date ? <div className="text-[11px] text-slate-500">{r.schedule_date}</div> : null}</td>
                        <td className="py-1.5 text-slate-700">{people.length ? people.map((e) => `${e!.first_name} ${e!.last_name}`).join(", ") : <span className="text-slate-400">nobody picked</span>}</td>
                        <td className="py-1.5 text-right">{days || "—"}</td>
                        {canViewRates && <td className="py-1.5 text-right tabular-nums">{formatCurrency(perDay)}</td>}
                        {canViewRates && <td className="py-1.5 text-right tabular-nums font-medium">{formatCurrency(perDay * days)}</td>}
                        <td className="py-1.5 text-right">
                          {canEditProjects && (
                            <form action={deleteCrewRequirementAction.bind(null, project.id, r.id)}>
                              <button type="submit" className="text-slate-400 hover:text-rose-600" aria-label="Remove">✕</button>
                            </form>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </Card>

          <Card className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-slate-900 uppercase tracking-wide">Schedule</h2>
              <Link href="/schedule" className="text-sm text-sky-600 hover:underline">Open schedule →</Link>
            </div>
            {scheduledDates.length === 0 ? (
              <EmptyState message="No crew scheduled for this project yet." />
            ) : (
              <div className="space-y-3">
                {scheduledDates.map((date) => {
                  const dayAssignments = projectAssignments.filter((a) => a.schedule_date === date);
                  const crewComparison = compareCrewForProjectDate(crewRequirements, assignments, id, date);
                  const missingDriver = isMissingDriver(project, assignments, employees, id, date);
                  const dayCost = dayAssignments.reduce((s, a) => s + a.assignment_cost, 0);
                  return (
                    <div key={date} className="border border-slate-100 rounded-lg p-3">
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="text-sm font-medium">{formatDateLong(date)}</div>
                        <div className="text-xs text-slate-500">{dayAssignments.length} crew · {formatCurrency(dayCost)}</div>
                      </div>
                      <div className="flex flex-wrap gap-1.5 mb-1.5">
                        {dayAssignments.map((a) => {
                          const emp = employeeById.get(a.employee_id);
                          return (
                            <span key={a.id} className="text-[11px] bg-slate-100 rounded px-1.5 py-0.5 text-slate-600">
                              {emp ? `${emp.first_name} ${emp.last_name}` : "?"} · {a.role_on_job}{a.time_and_half ? " · 1.5x" : ""}
                            </span>
                          );
                        })}
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {crewComparison.map((c) => (
                          <span key={c.role} className={`text-[11px] rounded px-1.5 py-0.5 ${c.complete ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}>
                            {c.complete ? "✓" : "⚠"} {c.role} {c.assigned}/{c.required}
                          </span>
                        ))}
                        {missingDriver && <span className="text-[11px] rounded px-1.5 py-0.5 bg-rose-50 text-rose-700 font-medium">⚠ NO DRIVER ASSIGNED</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>

          {canViewCost && (
            <Card className="p-4">
              <div className="flex items-center justify-between mb-1">
                <h2 className="text-sm font-semibold text-slate-900 uppercase tracking-wide">Job Labor Summary — Actual Cost</h2>
                <Link href="/schedule/completed" className="text-sm text-sky-600 hover:underline">Completed jobs →</Link>
              </div>
              <p className="text-xs text-slate-500 mb-3">
                Computed from actual hours logged on the Schedule&apos;s End-of-Day Review — not the planned crew above. Answers &quot;how much did we
                actually spend on labor here.&quot;
              </p>
              {laborSummary.rows.length === 0 ? (
                <EmptyState message="No actual hours logged for this job yet." />
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-slate-500 uppercase border-b border-slate-200">
                      <th className="py-1.5">Employee</th>
                      <th className="py-1.5 text-right">Days Worked</th>
                      <th className="py-1.5 text-right">Actual Hours</th>
                      <th className="py-1.5 text-right">Labor Cost</th>
                    </tr>
                  </thead>
                  <tbody>
                    {laborSummary.rows.map((r) => (
                      <tr key={r.employee_id} className="border-b border-slate-100 last:border-0">
                        <td className="py-1.5">{r.employeeName}</td>
                        <td className="py-1.5 text-right">{r.daysWorked}</td>
                        <td className="py-1.5 text-right">{r.totalHours}</td>
                        <td className="py-1.5 text-right">{formatCurrency(r.totalCost)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="font-semibold text-slate-900">
                      <td className="py-1.5">Total</td>
                      <td className="py-1.5 text-right">—</td>
                      <td className="py-1.5 text-right">{laborSummary.totalManHours}</td>
                      <td className="py-1.5 text-right">{formatCurrency(laborSummary.totalLaborCost)}</td>
                    </tr>
                  </tfoot>
                </table>
              )}
            </Card>
          )}

          {canQBView && (
            <Card className="p-4">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold text-slate-900 uppercase tracking-wide">QuickBooks</h2>
                {!qbConnected && <span className="text-xs text-slate-400">Not connected</span>}
              </div>
              <QuickBooksDocumentList documents={qbDocuments} />
              {canQBManage && (
                <div className="flex flex-wrap gap-2 mt-3">
                  <Link href={`/projects/${project.id}/quickbooks/prepare-estimate`}>
                    <Button variant="secondary">Prepare Estimate</Button>
                  </Link>
                  <Link href={`/projects/${project.id}/quickbooks/prepare-invoice`}>
                    <Button variant="secondary">Prepare Invoice</Button>
                  </Link>
                  <Link href={`/projects/${project.id}/quickbooks/link`}>
                    <Button variant="secondary">Link Existing Document</Button>
                  </Link>
                </div>
              )}
              {project.pipeline_stage === "Complete" && qbDocuments.filter((d) => d.entity_type === "Invoice").length === 0 && canQBManage && (
                <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mt-3">
                  This job is complete with no invoice prepared yet.{" "}
                  <Link href={`/projects/${project.id}/quickbooks/prepare-invoice`} className="underline font-medium">Prepare QuickBooks Invoice →</Link>
                </p>
              )}
            </Card>
          )}

          <Card className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-slate-900 uppercase tracking-wide">Materials</h2>
              <Link href="/materials" className="text-sm text-sky-600 hover:underline">All materials →</Link>
            </div>
            {canEditMaterials && <AddMaterialForm projectId={project.id} suppliers={supplierNames} storageConfigured={storageConfigured} />}
            {projectPickupItems.length > 0 && (
              <div className="mb-4 rounded-lg border border-slate-200 bg-slate-50 p-3">
                <div className="flex items-center justify-between mb-1.5">
                  <div className="text-xs font-semibold text-slate-700 uppercase tracking-wide">Items to Order / Collect (from the schedule)</div>
                  <div className="text-xs text-slate-600">Total {formatCurrency(pickupCostTotal)}</div>
                </div>
                <div className="divide-y divide-slate-200">
                  {projectPickupItems.map((item) => (
                    <div key={item.id} className="py-1.5 flex flex-wrap items-center gap-2 text-sm">
                      <span className={`flex-1 min-w-[160px] ${item.status === "Collected" ? "line-through text-slate-500" : "text-slate-800"}`}>
                        {item.description}
                        <span className="ml-2 text-xs text-slate-500">{item.date}</span>
                      </span>
                      <span className={`text-xs font-medium ${item.status === "Collected" ? "text-emerald-700" : "text-amber-700"}`}>
                        {item.status === "Collected" ? "✓ Collected" : "Needed"}
                      </span>
                      <form action={setPickupItemCostAction.bind(null, project.id, item.id)} className="flex items-center gap-1">
                        <span className="text-slate-500 text-xs">$</span>
                        <input
                          name="cost"
                          type="number"
                          step="0.01"
                          min="0"
                          defaultValue={item.cost ?? ""}
                          placeholder="0.00"
                          className="w-24 rounded-lg border border-slate-300 px-2 py-1 text-sm text-right"
                        />
                        <button type="submit" className="text-xs rounded-lg border border-slate-300 bg-white px-2 py-1 hover:bg-slate-100">Save</button>
                      </form>
                    </div>
                  ))}
                </div>
                <p className="text-[11px] text-slate-500 mt-1.5">Prices here are included in the Materials cost below.</p>
              </div>
            )}
            {projectMaterialsList.length === 0 ? (
              <EmptyState message="No materials added for this job yet." />
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-slate-500 uppercase border-b border-slate-200">
                    <th className="py-1.5">Item</th>
                    <th className="py-1.5 text-right">Units</th>
                    <th className="py-1.5 text-right">Per unit</th>
                    <th className="py-1.5 text-right">Total</th>
                    <th className="py-1.5">Supplier</th>
                    <th className="py-1.5">Date</th>
                    <th className="py-1.5">Invoice</th>
                    <th className="py-1.5" />
                  </tr>
                </thead>
                <tbody>
                  {projectMaterialsList.map((m) => (
                    <tr key={m.id} className="border-b border-slate-100 last:border-0">
                      <td className="py-1.5 text-slate-800">{m.description}</td>
                      <td className="py-1.5 text-right tabular-nums">{m.quantity}</td>
                      <td className="py-1.5 text-right tabular-nums">{m.unit_price != null ? formatCurrency(m.unit_price) : "—"}</td>
                      <td className="py-1.5 text-right tabular-nums font-medium">{formatCurrency(m.cost)}</td>
                      <td className="py-1.5 text-slate-600">{m.supplier ?? "—"}</td>
                      <td className="py-1.5 text-slate-600">{m.ordered_at ? m.ordered_at.slice(0, 10) : "—"}</td>
                      <td className="py-1.5">
                        {m.invoice_path ? (
                          invoiceUrls.get(m.id) ? (
                            <a href={invoiceUrls.get(m.id)!} target="_blank" rel="noreferrer" className="text-sky-700 hover:underline text-xs">{m.invoice_name ?? "View"}</a>
                          ) : (
                            <span className="text-xs text-slate-400">{m.invoice_name ?? "attached"}</span>
                          )
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>
                      <td className="py-1.5 text-right">
                        {canEditMaterials && (
                          <form action={deleteProjectMaterialAction.bind(null, project.id, m.id)}>
                            <button type="submit" className="text-slate-400 hover:text-rose-600" aria-label="Remove">✕</button>
                          </form>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t border-slate-200">
                    <td className="py-1.5 text-xs text-slate-600" colSpan={3}>Materials total (incl. schedule pickups)</td>
                    <td className="py-1.5 text-right font-semibold tabular-nums">{formatCurrency(costing.materialCost)}</td>
                    <td colSpan={4} />
                  </tr>
                </tfoot>
              </table>
            )}
          </Card>

          <Card className="p-4">
            <h2 className="text-sm font-semibold text-slate-900 uppercase tracking-wide mb-3">Tasks</h2>
            <form action={addProjectTaskAction.bind(null, project.id)} className="flex flex-wrap gap-2 mb-4">
              <input name="title" placeholder="New task…" required className="flex-1 min-w-[160px] rounded-lg border border-slate-300 px-2 py-1.5 text-sm" />
              <input name="due_date" type="date" className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm" />
              <Button type="submit">Add Task</Button>
            </form>
            {projectTasks.length === 0 ? (
              <EmptyState message="No tasks linked to this project." />
            ) : (
              <div className="divide-y divide-slate-100">
                {projectTasks.map((t) => (
                  <div key={t.id} className="py-2 flex items-center justify-between gap-3">
                    <div className="text-sm text-slate-800">{t.title}</div>
                    <div className="flex items-center gap-2 shrink-0">
                      {t.due_date && <span className="text-xs text-slate-500">{t.due_date}</span>}
                      <StatusBadge status={t.status} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card className="p-4">
            <h2 className="text-sm font-semibold text-slate-900 uppercase tracking-wide mb-3">Notes</h2>
            <form action={addProjectNoteAction.bind(null, project.id)} className="flex flex-wrap gap-2 mb-4">
              <textarea name="body" placeholder="Add a note…" rows={2} required className="flex-1 min-w-[200px] rounded-lg border border-slate-300 px-2 py-1.5 text-sm" />
              <Button type="submit">Add Note</Button>
            </form>
            {projectNotes.length === 0 ? (
              <EmptyState message="No notes yet." />
            ) : (
              <div className="space-y-2.5">
                {projectNotes.map((n) => (
                  <div key={n.id} className="text-sm border-l-2 border-slate-200 pl-3">
                    <div className="text-slate-700">{n.body}</div>
                    <div className="text-xs text-slate-400 mt-0.5">{n.author_name} · {formatDateLong(n.created_at.slice(0, 10))}</div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card className="p-4">
            <h2 className="text-sm font-semibold text-slate-900 uppercase tracking-wide mb-3">Photos &amp; Progress</h2>
            <p className="text-xs text-slate-500 mb-3">Organized into albums by category, Procore-style. Titles are optional.</p>
            {!photoStorageConfigured && (
              <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-3">
                Photo storage isn&apos;t configured yet — entries below are saved without an image until Supabase Storage credentials are set (see README).
              </p>
            )}
            <form action={addProjectPhotoAction.bind(null, project.id)} className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-4">
              <input name="title" placeholder="Title (optional)" className="sm:col-span-2 rounded-lg border border-slate-300 px-2 py-1.5 text-sm" />
              <input name="caption" placeholder="Caption / note" required className="sm:col-span-2 rounded-lg border border-slate-300 px-2 py-1.5 text-sm" />
              <select name="category" defaultValue="Progress" className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm">
                {PHOTO_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
              <input name="taken_at" type="date" defaultValue={new Date().toISOString().slice(0, 10)} className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm" />
              <input name="photo" type="file" accept="image/*" className="sm:col-span-2 text-sm" />
              <Button type="submit" className="sm:col-span-2">Add Entry</Button>
            </form>
            {projectPhotos.length === 0 ? (
              <EmptyState message="No photos or progress entries yet." />
            ) : (
              <div className="space-y-4">
                {PHOTO_CATEGORIES.filter((cat) => projectPhotos.some((ph) => (ph.category ?? "Other") === cat)).map((cat) => (
                  <div key={cat}>
                    <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                      {cat} album ({projectPhotos.filter((ph) => (ph.category ?? "Other") === cat).length})
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {projectPhotos
                        .filter((ph) => (ph.category ?? "Other") === cat)
                        .map((ph) => (
                          <div key={ph.id} className="border border-slate-100 rounded-lg p-3">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-[11px] font-semibold uppercase text-sky-700 bg-sky-50 rounded-full px-2 py-0.5">{ph.category ?? "Other"}</span>
                              <span className="text-xs text-slate-400">{formatDateLong(ph.taken_at?.slice(0, 10) ?? ph.created_at.slice(0, 10))}</span>
                            </div>
                            {ph.title && <div className="text-sm font-medium text-slate-900 mb-0.5">{ph.title}</div>}
                            <p className="text-sm text-slate-700 mb-1">{ph.caption}</p>
                            {ph.storage_unavailable || !ph.storage_path ? (
                              <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1">
                                Photo storage isn&apos;t configured yet — this entry was saved without an image.
                              </div>
                            ) : (
                              <div className="text-xs text-slate-500">Stored at {ph.storage_path}</div>
                            )}
                            <div className="text-[11px] text-slate-400 mt-1">{ph.uploaded_by ?? "—"}</div>
                          </div>
                        ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card className="p-4">
            <h2 className="text-sm font-semibold text-slate-900 uppercase tracking-wide mb-1">Drawings</h2>
            <p className="text-xs text-slate-500 mb-3">
              Plans and drawings with version history, Procore-style — uploading against an existing drawing supersedes it.
            </p>
            {!photoStorageConfigured && (
              <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-3">
                File storage isn&apos;t configured yet — entries below are saved without a file until Supabase Storage credentials are set (see README).
              </p>
            )}
            <form action={addProjectDrawingAction.bind(null, project.id)} className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-4">
              <select name="supersedes_id" defaultValue="" className="sm:col-span-2 rounded-lg border border-slate-300 px-2 py-1.5 text-sm">
                <option value="">New drawing…</option>
                {currentDrawings.map((d) => (
                  <option key={d.id} value={d.id}>
                    Upload new version of: {d.drawing_name}{d.drawing_number ? ` (${d.drawing_number})` : ""} — currently v{d.version}
                  </option>
                ))}
              </select>
              <input name="drawing_name" placeholder="Drawing name (e.g. Lobby Floor Plan)" className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm" />
              <input name="drawing_number" placeholder="Drawing # (optional, e.g. A-101)" className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm" />
              <input name="notes" placeholder="Notes (optional)" className="sm:col-span-2 rounded-lg border border-slate-300 px-2 py-1.5 text-sm" />
              <input name="file" type="file" accept="application/pdf,image/*" className="sm:col-span-2 text-sm" />
              <Button type="submit" className="sm:col-span-2">Upload Drawing</Button>
            </form>
            {currentDrawings.length === 0 ? (
              <EmptyState message="No drawings uploaded yet." />
            ) : (
              <div className="space-y-3">
                {currentDrawings.map((d) => {
                  const history = (drawingsByName.get(`${d.drawing_name}__${d.drawing_number ?? ""}`) ?? []).filter((h) => h.id !== d.id);
                  return (
                    <div key={d.id} className="border border-slate-100 rounded-lg p-3">
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <div>
                          <div className="text-sm font-medium text-slate-900">
                            {d.drawing_name}{d.drawing_number ? ` · ${d.drawing_number}` : ""}
                          </div>
                          <div className="text-xs text-slate-500">Current — v{d.version} · {formatDateLong(d.uploaded_at.slice(0, 10))} · {d.uploaded_by ?? "—"}</div>
                        </div>
                        <span className="text-[11px] font-semibold uppercase text-emerald-700 bg-emerald-50 rounded-full px-2 py-0.5 shrink-0">Current</span>
                      </div>
                      {d.notes && <p className="text-sm text-slate-700 mb-1">{d.notes}</p>}
                      {d.storage_unavailable || !d.file_reference ? (
                        <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1 mb-1">
                          File storage isn&apos;t configured yet — this entry was saved without a file.
                        </div>
                      ) : (
                        <div className="text-xs text-slate-500 mb-1">Stored at {d.file_reference}</div>
                      )}
                      {history.length > 0 && (
                        <details className="mt-1">
                          <summary className="text-xs text-sky-600 hover:underline cursor-pointer">Version History ({history.length})</summary>
                          <div className="mt-2 space-y-1.5 pl-3 border-l-2 border-slate-200">
                            {history
                              .sort((a, b) => b.version - a.version)
                              .map((h) => (
                                <div key={h.id} className="text-xs text-slate-500">
                                  v{h.version} · {formatDateLong(h.uploaded_at.slice(0, 10))} · {h.uploaded_by ?? "—"}
                                  {h.notes ? ` — ${h.notes}` : ""}
                                </div>
                              ))}
                          </div>
                        </details>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </Card>

          <Card className="p-4">
            <h2 className="text-sm font-semibold text-slate-900 uppercase tracking-wide mb-3">Activity</h2>
            {projectActivity.length === 0 ? (
              <EmptyState message="No activity logged yet." />
            ) : (
              <div className="space-y-2.5 max-h-96 overflow-y-auto">
                {projectActivity.map((a) => (
                  <div key={a.id} className="text-sm border-l-2 border-slate-200 pl-3">
                    <div className="text-slate-700">{a.action}</div>
                    {a.detail && <div className="text-xs text-slate-500 mt-0.5">{a.detail}</div>}
                    <div className="text-xs text-slate-400 mt-0.5">{a.actor_name ?? "System"} · {formatDateLong(a.created_at.slice(0, 10))}</div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>

        <Card className="p-4 h-fit space-y-3">
          <h2 className="text-sm font-semibold text-slate-900 uppercase tracking-wide mb-1">Costing</h2>
          <CostRow label="Labor" value={costing.laborCost} />
          <CostRow label="Materials" value={costing.materialCost} />
          <CostRow label="Other" value={costing.otherCost} />
          <div className="border-t border-slate-200 pt-2">
            <CostRow label="Total Cost" value={costing.totalCost} bold />
          </div>
          <CostRow label="Project Value" value={costing.projectValue} />
          <div className="border-t border-slate-200 pt-2">
            <CostRow label="Gross Profit" value={costing.grossProfit} bold tone={costing.grossProfit >= 0 ? "good" : "bad"} />
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-slate-500">Gross Margin</span>
            <span className={`font-semibold ${costing.grossMarginPct !== null && costing.grossMarginPct < 20 ? "text-rose-600" : "text-emerald-600"}`}>
              {formatPercent(costing.grossMarginPct)}
            </span>
          </div>
          {building && (
            <Link href={`/buildings/${building.id}`} className="block text-sm text-sky-600 hover:underline pt-2">
              View building profile →
            </Link>
          )}
        </Card>

        {canFinancials && <FinancialSummaryCard summary={financialSummary} canViewLaborCost={canViewCost} />}

        <Card className="p-4 space-y-3 lg:col-span-3">
          <h2 className="text-sm font-semibold text-slate-900 uppercase tracking-wide mb-1">Estimate Calculator</h2>
          <EstimateCalculator
            formulas={calculatorFormulas}
            components={formulaComponents}
            materialRateItems={materialRateItems}
            onSave={saveProjectEstimateAction.bind(null, project.id)}
            saveLabel="Save as Project Value"
            currentValue={project.project_value}
            currentValueLabel="Current project value"
          />
        </Card>
      </div>
    </div>
  );
}

function CostRow({ label, value, bold, tone }: { label: string; value: number; bold?: boolean; tone?: "good" | "bad" }) {
  const toneClass = tone === "good" ? "text-emerald-600" : tone === "bad" ? "text-rose-600" : "text-slate-800";
  return (
    <div className="flex justify-between text-sm">
      <span className="text-slate-500">{label}</span>
      <span className={`${bold ? "font-semibold" : ""} ${toneClass}`}>{formatCurrency(value)}</span>
    </div>
  );
}
