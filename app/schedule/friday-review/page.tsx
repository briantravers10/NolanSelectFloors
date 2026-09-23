import Link from "next/link";
import {
  listBuildingContacts,
  listBuildings,
  listClientCompanies,
  listContacts,
  listEmployees,
  listProjectNotes,
  listProjectScheduleDays,
  listProjects,
  listScheduleAssignments,
  listSchedulePickupItems,
  listWorkTypes,
} from "@/lib/db";
import { listOfficeUsersCached } from "@/lib/request-cache";
import { Card, PageHeader, Button, EmptyState } from "@/components/ui";
import { buildScheduleJobRows, scheduleNoteDate } from "@/lib/schedule";
import { addDays, dayLabel, formatDateLong, formatDateShort, isoDate, startOfWeek, todayIso } from "@/lib/dates";
import { ScheduleSubNav } from "@/components/schedule/ScheduleSubNav";
import { PrintButton } from "@/components/PrintButton";
import { ListSearchBox } from "@/components/ListSearchBox";
import { formatJobNumber } from "@/lib/calculations";
import { requireSectionAccess } from "@/lib/permissions";
import { AccessDenied } from "@/components/AccessDenied";
import { markInvoiceSentAction } from "@/app/dashboard/actions";
import { InvoiceAssigneeSelect } from "@/components/dashboard/InvoiceAssigneeSelect";
import { AssigneeFilterSelect } from "@/components/schedule/AssigneeFilterSelect";
import type { Project, ProjectNote } from "@/lib/types";
import { addWeeklyReviewNoteAction } from "./actions";

/**
 * WEEKLY (FRIDAY) REVIEW — every job worked this week, grouped by property
 * manager and then by building (a building can have several units worked
 * the same week). Each job shows its notes, a way to add more, and — right
 * on the job — who's sending the invoice, with a "Needs Invoice" flag once
 * the job is done and nobody's sent it yet. Sits under Schedule in the nav
 * per the client's ask.
 */
export default async function FridayReviewPage({ searchParams }: { searchParams: Promise<{ week?: string; assignee?: string; q?: string }> }) {
  const access = await requireSectionAccess("schedule");
  if (access === "none") return <AccessDenied section="Schedule" />;
  const canEditSchedule = access === "edit";

  const { week, assignee, q = "" } = await searchParams;
  const monday = startOfWeek(week ? new Date(week + "T00:00:00") : new Date());
  const weekDates = Array.from({ length: 7 }, (_, i) => isoDate(addDays(monday, i)));
  const thisWeek = isoDate(startOfWeek(new Date(todayIso() + "T00:00:00")));

  const [projects, buildings, clients, contacts, buildingContacts, employees, assignments, scheduleDays, workTypes, pickupItems, allNotes, officeUsers] =
    await Promise.all([
      listProjects(),
      listBuildings(),
      listClientCompanies(),
      listContacts(),
      listBuildingContacts(),
      listEmployees(),
      listScheduleAssignments({ maxDate: weekDates[weekDates.length - 1] }),
      listProjectScheduleDays({ maxDate: weekDates[weekDates.length - 1] }),
      listWorkTypes(),
      listSchedulePickupItems(),
      listProjectNotes(),
      listOfficeUsersCached(),
    ]);
  const input = { projects, buildings, clients, contacts, buildingContacts, employees, assignments, scheduleDays, workTypes, pickupItems };

  const senders = officeUsers
    .filter((u) => u.active && (u.access_role === "office_staff" || u.access_role === "owner_admin"))
    .map((u) => ({ id: u.id, name: u.full_name }))
    .sort((a, b) => a.name.localeCompare(b.name));

  // One entry per job worked this week — the same aggregation as Weekly
  // Summary, plus the project record itself so invoice status/assignee can
  // be shown and edited right here, and building/client identity kept
  // separate (rather than baked into one display string) so jobs can be
  // grouped by property manager, then by building.
  type Entry = {
    projectId: string;
    jobNumber: number;
    jobLabel: string; // just the unit/job part, without the building name
    address?: string;
    clientId: string;
    clientName: string;
    buildingKey: string;
    buildingName: string;
    days: string[];
    project: Project;
  };
  const byProject = new Map<string, Entry>();
  for (const date of weekDates) {
    for (const row of buildScheduleJobRows(date, input)) {
      if (row.weekendOff) continue;
      // Meetings aren't jobs — they never need invoicing or job notes here.
      // They stay tracked in the Meetings tab/history instead of cluttering
      // this review (or a completed meeting-only entry falsely flagging
      // "Needs Invoice").
      if (row.isMeeting) continue;
      const building = buildings.find((b) => b.id === row.project.building_id);
      const e = byProject.get(row.projectId) ?? {
        projectId: row.projectId,
        jobNumber: row.project.job_number,
        jobLabel: row.unitNumber ? `Unit ${row.unitNumber}` : row.buildingName ?? row.project.name,
        address: row.address,
        clientId: building?.client_company_id ?? "",
        clientName: row.clientName ?? "No management company",
        buildingKey: row.project.building_id ?? row.projectId,
        buildingName: row.buildingName ?? row.project.name,
        days: [],
        project: row.project,
      };
      e.days.push(date);
      byProject.set(row.projectId, e);
    }
  }
  const allEntries = [...byProject.values()];

  // Filter down to one invoice assignee (or Unassigned) for printing just
  // that person's list — see AssigneeFilterSelect.
  const byAssignee = !assignee
    ? allEntries
    : assignee === "unassigned"
      ? allEntries.filter((e) => !e.project.invoice_assigned_to)
      : allEntries.filter((e) => e.project.invoice_assigned_to === assignee);

  // Search box: job number, building/unit, address, or management company.
  const needle = q.trim().toLowerCase();
  const entries = !needle
    ? byAssignee
    : byAssignee.filter((e) =>
        [String(e.jobNumber), e.jobLabel, e.buildingName, e.address, e.clientName].filter(Boolean).join(" ").toLowerCase().includes(needle)
      );

  // Notes ABOUT this specific week, per job (by the schedule date they're
  // for, not necessarily when they were saved — see scheduleNoteDate).
  // Older history stays on the job page's own Notes section rather than
  // cluttering this review.
  const notesByProject = new Map<string, ProjectNote[]>();
  for (const n of allNotes) {
    if (!byProject.has(n.project_id)) continue;
    if (!weekDates.includes(scheduleNoteDate(n))) continue;
    notesByProject.set(n.project_id, [...(notesByProject.get(n.project_id) ?? []), n]);
  }
  for (const list of notesByProject.values()) list.sort((a, b) => scheduleNoteDate(a).localeCompare(scheduleNoteDate(b)));

  // Property manager -> building -> jobs.
  const clientGroups = new Map<string, Map<string, Entry[]>>();
  for (const e of entries) {
    const buildingGroups = clientGroups.get(e.clientName) ?? new Map<string, Entry[]>();
    buildingGroups.set(e.buildingKey, [...(buildingGroups.get(e.buildingKey) ?? []), e]);
    clientGroups.set(e.clientName, buildingGroups);
  }
  const clientGroupList = [...clientGroups.entries()].sort((a, b) => a[0].localeCompare(b[0]));

  const needsInvoiceCount = entries.filter((e) => e.project.pipeline_stage === "Complete" && !e.project.invoice_sent_at).length;

  return (
    <div>
      <PageHeader
        title="Weekly Review"
        subtitle="Every job worked this week, grouped by property manager and building — notes logged so far, room to add more, and who's invoicing what."
        action={<PrintButton label="Print" />}
      />
      <ScheduleSubNav active="friday-review" />

      <ListSearchBox
        action="/schedule/friday-review"
        q={q}
        placeholder="Search jobs by number, building, address, or company…"
        extraParams={{ week, assignee }}
        className="no-print"
      />

      <div className="flex flex-wrap items-center gap-2 mb-4 no-print">
        {(() => {
          const kept = { ...(assignee ? { assignee } : {}), ...(q ? { q } : {}) };
          const weekHref = (w: string) => `/schedule/friday-review?${new URLSearchParams({ week: w, ...kept }).toString()}`;
          return (
            <>
              <Link href={weekHref(isoDate(addDays(monday, -7)))}><Button variant="secondary">← Prev Week</Button></Link>
              <Link href={weekHref(thisWeek)}><Button variant="secondary">This Week</Button></Link>
              <Link href={weekHref(isoDate(addDays(monday, 7)))}><Button variant="secondary">Next Week →</Button></Link>
            </>
          );
        })()}
        <div className="ml-2 font-medium text-slate-900">Week of {formatDateShort(weekDates[0])} – {formatDateShort(weekDates[6])}</div>
        <div className="flex items-center gap-1.5 no-print">
          <span className="text-xs text-slate-500">Invoicing assigned to</span>
          <AssigneeFilterSelect people={senders} value={assignee ?? ""} />
        </div>
        {needsInvoiceCount > 0 && (
          <span className="inline-flex items-center rounded-full bg-amber-100 text-amber-900 border border-amber-300 px-2.5 py-0.5 text-xs font-medium">
            {needsInvoiceCount} {needsInvoiceCount === 1 ? "job needs" : "jobs need"} invoicing
          </span>
        )}
      </div>

      {clientGroupList.length === 0 ? (
        <Card className="p-6">
          <EmptyState message={assignee ? "No jobs match this filter for this week." : "Nothing was on the schedule this week."} />
        </Card>
      ) : (
        clientGroupList.map(([clientName, buildingGroups]) => {
          const buildingGroupList = [...buildingGroups.entries()].sort((a, b) => a[1][0].buildingName.localeCompare(b[1][0].buildingName));
          const clientId = buildingGroupList[0]?.[1][0]?.clientId;
          return (
            <div key={clientName} className="mb-6 print-break">
              <h2 className="text-sm font-semibold text-slate-900 uppercase tracking-wide mb-2 pb-1 border-b border-slate-300">
                {clientId ? <Link href={`/clients/${clientId}`} className="hover:text-sky-700">{clientName}</Link> : clientName}
              </h2>
              {buildingGroupList.map(([buildingKey, jobs]) => (
                <div key={buildingKey} className="mb-4 last:mb-0">
                  {jobs.length > 1 && (
                    <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5 ml-1">
                      {jobs[0].buildingName} · {jobs.length} jobs
                    </h3>
                  )}
                  <div className="space-y-3">
                    {jobs
                      .sort((a, b) => a.jobLabel.localeCompare(b.jobLabel))
                      .map((e) => {
                        const notes = notesByProject.get(e.projectId) ?? [];
                        const needsInvoice = e.project.pipeline_stage === "Complete" && !e.project.invoice_sent_at;
                        return (
                          <Card key={e.projectId} className={`p-4 ${needsInvoice ? "border-amber-300" : ""}`}>
                            <div className="flex flex-wrap items-start justify-between gap-2 mb-1">
                              <div>
                                <Link href={`/projects/${e.projectId}`} className="font-medium text-sky-700 hover:underline">
                                  <span className="font-mono text-xs text-slate-500">{formatJobNumber(e.jobNumber)}</span>{" "}
                                  {jobs.length > 1 ? e.jobLabel : e.buildingName}
                                </Link>
                                <div className="text-xs text-slate-500">
                                  {e.address ?? ""}
                                  {e.address ? " · " : ""}
                                  Worked {e.days.map((d) => dayLabel(d).slice(0, 3)).join(", ")}
                                </div>
                              </div>
                              <div className="flex items-center gap-2 text-xs">
                                <span
                                  className={`inline-flex rounded-full px-2 py-0.5 font-medium ${
                                    e.project.pipeline_stage === "Complete" ? "bg-emerald-100 text-emerald-800" : "bg-sky-100 text-sky-800"
                                  }`}
                                >
                                  {e.project.pipeline_stage === "Complete" ? "Completed" : "Ongoing"}
                                </span>
                                {needsInvoice && (
                                  <span className="inline-flex rounded-full bg-amber-100 text-amber-900 border border-amber-300 px-2 py-0.5 font-medium">
                                    Needs Invoice
                                  </span>
                                )}
                              </div>
                            </div>

                            <div className="flex flex-wrap items-center gap-2 mb-3">
                              {e.project.invoice_sent_at ? (
                                <span className="inline-flex rounded-full bg-emerald-100 text-emerald-800 px-2 py-0.5 text-xs font-medium">
                                  Invoice sent{e.project.invoice_sent_by ? ` by ${e.project.invoice_sent_by}` : ""} · {formatDateLong(e.project.invoice_sent_at.slice(0, 10))}
                                </span>
                              ) : (
                                <>
                                  <InvoiceAssigneeSelect projectId={e.projectId} assignedTo={e.project.invoice_assigned_to ?? null} people={senders} />
                                  {e.project.pipeline_stage === "Complete" && (
                                    <form action={markInvoiceSentAction.bind(null, e.projectId, true)}>
                                      <Button type="submit" variant="secondary" className="text-xs py-1">Mark Sent</Button>
                                    </form>
                                  )}
                                </>
                              )}
                            </div>

                            <div>
                              <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Notes this week</h4>
                              {notes.length === 0 ? (
                                <p className="text-xs text-slate-400 mb-2">No notes logged yet this week.</p>
                              ) : (
                                <div className="space-y-2 mb-3">
                                  {notes.map((n) => {
                                    const isScheduleNote = n.author_name?.startsWith("Schedule Note (");
                                    return (
                                      <div key={n.id} className="text-sm border-l-2 border-slate-200 pl-3">
                                        <div className="text-slate-700">{n.body}</div>
                                        <div className="text-xs text-slate-400 mt-0.5">
                                          {isScheduleNote ? "From the schedule" : n.author_name} · {formatDateLong(scheduleNoteDate(n))}
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                              {canEditSchedule && (
                                <form action={addWeeklyReviewNoteAction.bind(null, e.projectId)} className="flex flex-wrap gap-2 no-print">
                                  <textarea name="body" placeholder="Add a note…" rows={2} required className="flex-1 min-w-[200px] rounded-lg border border-slate-300 px-2 py-1.5 text-sm" />
                                  <Button type="submit" className="text-xs py-1.5">Add Note</Button>
                                </form>
                              )}
                            </div>
                          </Card>
                        );
                      })}
                  </div>
                </div>
              ))}
            </div>
          );
        })
      )}
    </div>
  );
}
