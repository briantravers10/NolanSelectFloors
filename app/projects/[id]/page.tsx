import { notFound } from "next/navigation";
import Link from "next/link";
import {
  listActivityLog,
  listBuildings,
  listClientCompanies,
  listCrewRequirements,
  listEmployees,
  listOfficeUsers,
  listProjectMaterials,
  listProjectNotes,
  listProjects,
  listProjectWorkTypes,
  listScheduleAssignments,
  listTasks,
} from "@/lib/db";
import { getActingUser } from "@/lib/current-user";
import { Card, PageHeader, StatusBadge, Button, EmptyState, Stat } from "@/components/ui";
import { BidOwnership } from "@/components/BidOwnership";
import {
  compareCrewForProjectDate,
  computeProjectCosting,
  formatCurrency,
  formatPercent,
  isMissingDriver,
} from "@/lib/calculations";
import { formatDateLong } from "@/lib/dates";
import { PIPELINE_STAGES, PROJECT_STATUSES, STAFF_CAPABILITIES } from "@/lib/types";
import {
  addCrewRequirementAction,
  addProjectMaterialAction,
  addProjectNoteAction,
  addProjectTaskAction,
  setPipelineStageAction,
  setProjectStatusAction,
} from "../actions";

export default async function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [
    projects,
    buildings,
    clients,
    workTypes,
    assignments,
    employees,
    crewRequirements,
    materials,
    tasks,
    notes,
    officeUsers,
    actingUser,
    activityLog,
  ] = await Promise.all([
    listProjects(),
    listBuildings(),
    listClientCompanies(),
    listProjectWorkTypes(),
    listScheduleAssignments(),
    listEmployees(),
    listCrewRequirements(),
    listProjectMaterials(),
    listTasks(),
    listProjectNotes(),
    listOfficeUsers(),
    getActingUser(),
    listActivityLog(),
  ]);

  const project = projects.find((p) => p.id === id);
  if (!project) notFound();

  const building = buildings.find((b) => b.id === project.building_id);
  const client = building ? clients.find((c) => c.id === building.client_company_id) : undefined;
  const projectWorkTypes = workTypes.filter((wt) => wt.project_id === id);
  const projectAssignments = assignments.filter((a) => a.project_id === id).sort((a, b) => a.schedule_date.localeCompare(b.schedule_date));
  const scheduledDates = Array.from(new Set(projectAssignments.map((a) => a.schedule_date))).sort();
  const projectCrewReqs = crewRequirements.filter((r) => r.project_id === id);
  const projectMaterialsList = materials.filter((m) => m.project_id === id);
  const projectTasks = tasks.filter((t) => t.related_type === "project" && t.related_id === id);
  const projectNotes = notes.filter((n) => n.project_id === id);
  const employeeById = new Map(employees.map((e) => [e.id, e]));
  const projectActivity = activityLog.filter((a) => a.related_type === "project" && a.related_id === id);

  const costing = computeProjectCosting(project, assignments, materials, id);

  return (
    <div>
      <PageHeader
        title={project.name}
        subtitle={building ? `${building.name} · ${client?.name ?? ""}` : undefined}
        action={
          <div className="flex flex-wrap gap-1.5 justify-end">
            <StatusBadge status={project.pipeline_stage} />
            <StatusBadge status={project.bid_status} />
            <StatusBadge status={project.status} />
          </div>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <Stat label="Project Value" value={formatCurrency(costing.projectValue)} />
        <Stat label="Labor Cost" value={formatCurrency(costing.laborCost)} />
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
            <div className="text-xs font-semibold text-slate-500 uppercase mb-2">Move to Pipeline Stage</div>
            <div className="flex flex-wrap gap-2 mb-4">
              {PIPELINE_STAGES.filter((s) => s !== project.pipeline_stage).map((s) => (
                <form key={s} action={setPipelineStageAction.bind(null, project.id, s)}>
                  <button type="submit" className="text-xs rounded-full border border-slate-300 px-3 py-1 text-slate-600 hover:bg-slate-100">{s}</button>
                </form>
              ))}
            </div>
            <div className="text-xs font-semibold text-slate-500 uppercase mb-2">Move to Detailed Status</div>
            <div className="flex flex-wrap gap-2">
              {PROJECT_STATUSES.filter((s) => s !== project.status).map((s) => (
                <form key={s} action={setProjectStatusAction.bind(null, project.id, s)}>
                  <button type="submit" className="text-xs rounded-full border border-slate-300 px-3 py-1 text-slate-600 hover:bg-slate-100">{s}</button>
                </form>
              ))}
            </div>
          </Card>

          <BidOwnership project={project} officeUsers={officeUsers} actingUser={actingUser} />

          <Card className="p-4">
            <h2 className="text-sm font-semibold text-slate-900 uppercase tracking-wide mb-3">Crew Requirements</h2>
            <form action={addCrewRequirementAction.bind(null, project.id)} className="flex flex-wrap gap-2 mb-4 items-end">
              <div>
                <label className="block text-[11px] text-slate-500 uppercase mb-1">Role</label>
                <select name="role" className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm">
                  {STAFF_CAPABILITIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[11px] text-slate-500 uppercase mb-1">Qty</label>
                <input name="quantity" type="number" min={1} defaultValue={1} className="w-16 rounded-lg border border-slate-300 px-2 py-1.5 text-sm" />
              </div>
              <div>
                <label className="block text-[11px] text-slate-500 uppercase mb-1">Date (blank = every day)</label>
                <input name="schedule_date" type="date" className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm" />
              </div>
              <Button type="submit">Add Requirement</Button>
            </form>
            {projectCrewReqs.length === 0 ? (
              <EmptyState message="No crew requirements defined yet." />
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-slate-500 uppercase border-b border-slate-200">
                    <th className="py-1.5">Role</th><th className="py-1.5">Qty</th><th className="py-1.5">Applies To</th>
                  </tr>
                </thead>
                <tbody>
                  {projectCrewReqs.map((r) => (
                    <tr key={r.id} className="border-b border-slate-100 last:border-0">
                      <td className="py-1.5">{r.role}</td>
                      <td className="py-1.5">{r.quantity}</td>
                      <td className="py-1.5">{r.schedule_date ?? "Every scheduled day"}</td>
                    </tr>
                  ))}
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

          <Card className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-slate-900 uppercase tracking-wide">Materials</h2>
              <Link href="/materials" className="text-sm text-sky-600 hover:underline">All materials →</Link>
            </div>
            <form action={addProjectMaterialAction.bind(null, project.id)} className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-4">
              <input name="description" placeholder="Description" required className="col-span-2 sm:col-span-1 rounded-lg border border-slate-300 px-2 py-1.5 text-sm" />
              <input name="quantity" type="number" step="0.01" defaultValue={1} className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm" />
              <input name="unit" placeholder="unit" className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm" />
              <input name="cost" type="number" step="0.01" placeholder="Cost $" className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm" />
              <select name="status" className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm">
                <option>Needed</option><option>Quote Requested</option><option>Ordered</option><option>Partially Delivered</option><option>Delivered</option><option>Problem</option><option>Returned</option>
              </select>
              <input name="supplier" placeholder="Supplier" className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm" />
              <input name="expected_delivery" type="date" className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm" />
              <Button type="submit">Add Material</Button>
            </form>
            {projectMaterialsList.length === 0 ? (
              <EmptyState message="No materials tracked for this project yet." />
            ) : (
              <div className="divide-y divide-slate-100">
                {projectMaterialsList.map((m) => (
                  <div key={m.id} className="py-2 flex items-center justify-between gap-3">
                    <div>
                      <div className="text-sm text-slate-800">{m.description}</div>
                      <div className="text-xs text-slate-500">{m.quantity} {m.unit} · {m.supplier ?? "—"}{m.expected_delivery ? ` · expected ${m.expected_delivery}` : ""}</div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-sm">{formatCurrency(m.cost)}</div>
                      <StatusBadge status={m.status} />
                    </div>
                  </div>
                ))}
              </div>
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
