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
import { buildScheduleJobRows } from "@/lib/schedule";
import { addDays, dayLabel, formatDateLong, formatDateShort, isoDate, startOfWeek, todayIso } from "@/lib/dates";
import { ScheduleSubNav } from "@/components/schedule/ScheduleSubNav";
import { PrintButton } from "@/components/PrintButton";
import { formatJobNumber } from "@/lib/calculations";
import { requireSectionAccess } from "@/lib/permissions";
import { AccessDenied } from "@/components/AccessDenied";
import { markInvoiceSentAction } from "@/app/dashboard/actions";
import { InvoiceAssigneeSelect } from "@/components/dashboard/InvoiceAssigneeSelect";
import type { Project, ProjectNote } from "@/lib/types";
import { addWeeklyReviewNoteAction } from "./actions";

/**
 * WEEKLY (FRIDAY) REVIEW — every job worked this week in one place, so the
 * office can review the notes crews have logged all week, add anything
 * that's missing, and see in the same view what still needs invoicing and
 * who's picked it up. Sits under Schedule in the nav per the client's ask.
 */
export default async function FridayReviewPage({ searchParams }: { searchParams: Promise<{ week?: string }> }) {
  const access = await requireSectionAccess("schedule");
  if (access === "none") return <AccessDenied section="Schedule" />;
  const canEditSchedule = access === "edit";

  const { week } = await searchParams;
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
  // be shown and edited right here.
  type Entry = {
    projectId: string;
    jobNumber: number;
    name: string;
    address?: string;
    clientName: string;
    days: string[];
    project: Project;
  };
  const byProject = new Map<string, Entry>();
  for (const date of weekDates) {
    for (const row of buildScheduleJobRows(date, input)) {
      if (row.weekendOff) continue;
      const e = byProject.get(row.projectId) ?? {
        projectId: row.projectId,
        jobNumber: row.project.job_number,
        name: `${row.buildingName ?? row.project.name}${row.unitNumber ? ` — Unit ${row.unitNumber}` : ""}`,
        address: row.address,
        clientName: row.clientName ?? "No management company",
        days: [],
        project: row.project,
      };
      e.days.push(date);
      byProject.set(row.projectId, e);
    }
  }

  const entries = [...byProject.values()].sort((a, b) => a.name.localeCompare(b.name));

  // Notes created during this specific week, per job — older history stays
  // on the job page's own Notes section rather than cluttering this review.
  const notesByProject = new Map<string, ProjectNote[]>();
  for (const n of allNotes) {
    if (!byProject.has(n.project_id)) continue;
    if (!weekDates.includes(n.created_at.slice(0, 10))) continue;
    notesByProject.set(n.project_id, [...(notesByProject.get(n.project_id) ?? []), n]);
  }
  for (const list of notesByProject.values()) list.sort((a, b) => a.created_at.localeCompare(b.created_at));

  const needsInvoice = entries.filter((e) => e.project.pipeline_stage === "Complete" && !e.project.invoice_sent_at);

  return (
    <div>
      <PageHeader
        title="Weekly Review"
        subtitle="Every job worked this week — the notes logged so far, room to add more, and what still needs invoicing."
        action={<PrintButton label="Print" />}
      />
      <ScheduleSubNav active="friday-review" />

      <div className="flex flex-wrap items-center gap-2 mb-4 no-print">
        <Link href={`/schedule/friday-review?week=${isoDate(addDays(monday, -7))}`}><Button variant="secondary">← Prev Week</Button></Link>
        <Link href={`/schedule/friday-review?week=${thisWeek}`}><Button variant="secondary">This Week</Button></Link>
        <Link href={`/schedule/friday-review?week=${isoDate(addDays(monday, 7))}`}><Button variant="secondary">Next Week →</Button></Link>
        <div className="ml-2 font-medium text-slate-900">Week of {formatDateShort(weekDates[0])} – {formatDateShort(weekDates[6])}</div>
      </div>

      {needsInvoice.length > 0 && (
        <Card className="p-4 mb-5 border-amber-300 bg-amber-50">
          <h2 className="text-sm font-semibold text-amber-900 uppercase tracking-wide mb-2">
            Needs invoicing — {needsInvoice.length} {needsInvoice.length === 1 ? "job" : "jobs"}
          </h2>
          <div className="divide-y divide-amber-200 rounded-lg border border-amber-200 bg-white/60 px-3">
            {needsInvoice.map((e) => (
              <div key={e.projectId} className="py-2 flex flex-wrap items-center justify-between gap-2">
                <Link href={`/projects/${e.projectId}`} className="text-sm font-medium text-slate-900 hover:text-sky-700">
                  <span className="font-mono text-xs text-slate-500">{formatJobNumber(e.jobNumber)}</span> {e.name}
                </Link>
                <div className="flex items-center gap-2">
                  <InvoiceAssigneeSelect projectId={e.projectId} assignedTo={e.project.invoice_assigned_to ?? null} people={senders} />
                  <form action={markInvoiceSentAction.bind(null, e.projectId, true)}>
                    <Button type="submit" variant="secondary" className="text-xs py-1.5">Mark as Sent</Button>
                  </form>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {entries.length === 0 ? (
        <Card className="p-6"><EmptyState message="Nothing was on the schedule this week." /></Card>
      ) : (
        entries.map((e) => {
          const notes = notesByProject.get(e.projectId) ?? [];
          return (
            <Card key={e.projectId} className="p-4 mb-4 print-break">
              <div className="flex flex-wrap items-start justify-between gap-2 mb-1">
                <div>
                  <Link href={`/projects/${e.projectId}`} className="font-medium text-sky-700 hover:underline">
                    <span className="font-mono text-xs text-slate-500">{formatJobNumber(e.jobNumber)}</span> {e.name}
                  </Link>
                  <div className="text-xs text-slate-500">
                    {e.clientName}
                    {e.address ? ` · ${e.address}` : ""}
                    {" · Worked "}
                    {e.days.map((d) => dayLabel(d).slice(0, 3)).join(", ")}
                  </div>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  {e.project.pipeline_stage === "Complete" ? (
                    e.project.invoice_sent_at ? (
                      <span className="inline-flex rounded-full bg-emerald-100 text-emerald-800 px-2 py-0.5 font-medium">
                        Invoice sent{e.project.invoice_sent_by ? ` by ${e.project.invoice_sent_by}` : ""}
                      </span>
                    ) : (
                      <>
                        <InvoiceAssigneeSelect projectId={e.projectId} assignedTo={e.project.invoice_assigned_to ?? null} people={senders} />
                        <form action={markInvoiceSentAction.bind(null, e.projectId, true)}>
                          <Button type="submit" variant="secondary" className="text-xs py-1">Mark Sent</Button>
                        </form>
                      </>
                    )
                  ) : (
                    <span className="inline-flex rounded-full bg-sky-100 text-sky-800 px-2 py-0.5 font-medium">Ongoing</span>
                  )}
                </div>
              </div>

              <div className="mt-3">
                <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Notes this week</h3>
                {notes.length === 0 ? (
                  <p className="text-xs text-slate-400 mb-2">No notes logged yet this week.</p>
                ) : (
                  <div className="space-y-2 mb-3">
                    {notes.map((n) => (
                      <div key={n.id} className="text-sm border-l-2 border-slate-200 pl-3">
                        <div className="text-slate-700">{n.body}</div>
                        <div className="text-xs text-slate-400 mt-0.5">{n.author_name} · {formatDateLong(n.created_at.slice(0, 10))}</div>
                      </div>
                    ))}
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
        })
      )}
    </div>
  );
}
