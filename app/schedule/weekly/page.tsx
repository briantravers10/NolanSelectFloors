import Link from "next/link";
import {
  listBuildingContacts,
  listBuildings,
  listClientCompanies,
  listContacts,
  listEmployees,
  listProjectScheduleDays,
  listProjects,
  listScheduleAssignments,
  listSchedulePickupItems,
  listWorkTypes,
} from "@/lib/db";
import { Card, PageHeader, Button, EmptyState, PhoneLink } from "@/components/ui";
import { buildScheduleJobRows } from "@/lib/schedule";
import { addDays, dayLabel, formatDateShort, isoDate, startOfWeek, todayIso } from "@/lib/dates";
import { ScheduleSubNav } from "@/components/schedule/ScheduleSubNav";
import { PrintButton } from "@/components/PrintButton";
import { formatJobNumber } from "@/lib/calculations";
import { requireSectionAccess } from "@/lib/permissions";
import { AccessDenied } from "@/components/AccessDenied";

/**
 * WEEKLY SUMMARY — every job worked in the week, grouped by management
 * company (with the building's point of contact), marked Completed or
 * Ongoing, with the days it was on and who was on it. Each job links to
 * its project page.
 */
export default async function WeeklySummaryPage({ searchParams }: { searchParams: Promise<{ week?: string }> }) {
  const access = await requireSectionAccess("schedule");
  if (access === "none") return <AccessDenied section="Schedule" />;
  const { week } = await searchParams;
  const monday = startOfWeek(week ? new Date(week + "T00:00:00") : new Date());
  const weekDates = Array.from({ length: 7 }, (_, i) => isoDate(addDays(monday, i)));
  const thisWeek = isoDate(startOfWeek(new Date(todayIso() + "T00:00:00")));

  const [projects, buildings, clients, contacts, buildingContacts, employees, assignments, scheduleDays, workTypes, pickupItems] = await Promise.all([
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
  ]);
  const input = { projects, buildings, clients, contacts, buildingContacts, employees, assignments, scheduleDays, workTypes, pickupItems };

  // One entry per job worked this week, with the days it was on.
  type Entry = {
    projectId: string;
    jobNumber: number;
    name: string;
    address?: string;
    clientId: string;
    clientName: string;
    contactName?: string;
    contactPhone?: string;
    days: string[];
    crew: Set<string>;
    completed: boolean;
    completedOn?: string;
    cancelledDays?: string[];
    notes?: string;
  };
  const byProject = new Map<string, Entry>();
  for (const date of weekDates) {
    for (const row of buildScheduleJobRows(date, input)) {
      if (row.weekendOff) continue;
      const building = buildings.find((b) => b.id === row.project.building_id);
      const e = byProject.get(row.projectId) ?? {
        projectId: row.projectId,
        jobNumber: row.project.job_number,
        name: `${row.buildingName ?? row.project.name}${row.unitNumber ? ` — Unit ${row.unitNumber}` : ""}`,
        address: row.address,
        clientId: building?.client_company_id ?? "",
        clientName: row.clientName ?? "No management company",
        contactName: row.contactName,
        contactPhone: row.contactPhone,
        days: [],
        crew: new Set<string>(),
        completed: row.project.pipeline_stage === "Complete",
        notes: row.notes,
      };
      e.days.push(date);
      for (const c of row.crew) e.crew.add(c.name);
      if (row.jobStatus === "Complete") {
        e.completed = true;
        e.completedOn = e.completedOn ?? date;
      }
      if (row.jobStatus === "Cancelled") e.cancelledDays = [...(e.cancelledDays ?? []), date];
      byProject.set(row.projectId, e);
    }
  }

  const groups = new Map<string, Entry[]>();
  for (const e of byProject.values()) groups.set(e.clientName, [...(groups.get(e.clientName) ?? []), e]);
  const groupList = [...groups.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  const all = [...byProject.values()];
  const completedCount = all.filter((e) => e.completed).length;

  return (
    <div>
      <PageHeader
        title="Weekly Summary"
        subtitle="Every job worked this week, grouped by management company, with what's finished and what's still going."
        action={<PrintButton label="Print" />}
      />
      <ScheduleSubNav active="weekly" />

      <div className="flex flex-wrap items-center gap-2 mb-4 no-print">
        <Link href={`/schedule/weekly?week=${isoDate(addDays(monday, -7))}`}><Button variant="secondary">← Prev Week</Button></Link>
        <Link href={`/schedule/weekly?week=${thisWeek}`}><Button variant="secondary">This Week</Button></Link>
        <Link href={`/schedule/weekly?week=${isoDate(addDays(monday, 7))}`}><Button variant="secondary">Next Week →</Button></Link>
        <div className="ml-2 font-medium text-slate-900">Week of {formatDateShort(weekDates[0])} – {formatDateShort(weekDates[6])}</div>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-5">
        <Card className="p-4"><div className="text-xs text-slate-500 uppercase">Jobs worked</div><div className="text-2xl font-semibold">{all.length}</div></Card>
        <Card className="p-4"><div className="text-xs text-slate-500 uppercase">Completed</div><div className="text-2xl font-semibold text-emerald-700">{completedCount}</div></Card>
        <Card className="p-4"><div className="text-xs text-slate-500 uppercase">Ongoing</div><div className="text-2xl font-semibold text-sky-700">{all.length - completedCount}</div></Card>
      </div>

      {groupList.length === 0 ? (
        <Card className="p-6"><EmptyState message="Nothing was on the schedule this week." /></Card>
      ) : (
        groupList.map(([clientName, entries]) => (
          <Card key={clientName} className="p-4 mb-4 print-break">
            <div className="flex items-baseline justify-between mb-2">
              <h2 className="text-sm font-semibold text-slate-900 uppercase tracking-wide">
                {entries[0].clientId ? <Link href={`/clients/${entries[0].clientId}`} className="hover:text-sky-700">{clientName}</Link> : clientName}
              </h2>
              <span className="text-xs text-slate-500">
                {entries.length} {entries.length === 1 ? "job" : "jobs"} · {entries.filter((e) => e.completed).length} completed
              </span>
            </div>
            <table className="w-full text-sm table-fixed">
              <colgroup>
                <col className="w-[32%]" />
                <col className="w-[18%]" />
                <col className="w-[14%]" />
                <col className="w-[24%]" />
                <col className="w-[12%]" />
              </colgroup>
              <thead>
                <tr className="text-left text-xs text-slate-500 uppercase tracking-wide border-b border-slate-200">
                  <th className="py-1.5 pr-2">Job</th>
                  <th className="py-1.5 pr-2">Point of contact</th>
                  <th className="py-1.5 pr-2">Days this week</th>
                  <th className="py-1.5 pr-2">Crew</th>
                  <th className="py-1.5 text-right">Status</th>
                </tr>
              </thead>
              <tbody>
                {entries
                  .sort((a, b) => Number(a.completed) - Number(b.completed) || a.name.localeCompare(b.name))
                  .map((e) => (
                    <tr key={e.projectId} className="border-b border-slate-100 last:border-0 align-top">
                      <td className="py-2 pr-2">
                        <Link href={`/projects/${e.projectId}`} className="font-medium text-sky-700 hover:underline break-words">
                          <span className="font-mono text-xs text-slate-500">{formatJobNumber(e.jobNumber)}</span> {e.name}
                        </Link>
                        {e.address && <div className="text-xs text-slate-500">{e.address}</div>}
                        {e.notes && <div className="text-xs text-slate-600 mt-0.5 line-clamp-2">{e.notes}</div>}
                      </td>
                      <td className="py-2 pr-2 text-slate-700">
                        {e.contactName ?? <span className="text-slate-400">—</span>}
                        {e.contactPhone && <div><PhoneLink phone={e.contactPhone} className="text-xs" /></div>}
                      </td>
                      <td className="py-2 pr-2 text-slate-700">
                        {e.days.map((d) => dayLabel(d).slice(0, 3)).join(", ")}
                        <div className="text-xs text-slate-500">{e.days.length} {e.days.length === 1 ? "day" : "days"}</div>
                      </td>
                      <td className="py-2 pr-2 text-slate-700 text-xs">
                        {e.crew.size === 0 ? (
                          "—"
                        ) : (
                          <ul className="space-y-0.5">
                            {[...e.crew].sort().map((name) => (
                              <li key={name}>{name}</li>
                            ))}
                          </ul>
                        )}
                      </td>
                      <td className="py-2 text-right">
                        {e.completed ? (
                          <span className="inline-flex rounded-full bg-emerald-100 text-emerald-800 px-2 py-0.5 text-xs font-medium">
                            Completed{e.completedOn ? ` on ${formatDateShort(e.completedOn)}` : ""}
                          </span>
                        ) : e.cancelledDays && e.cancelledDays.length === e.days.length ? (
                          <span className="inline-flex rounded-full bg-rose-100 text-rose-800 px-2 py-0.5 text-xs font-medium">Cancelled</span>
                        ) : (
                          <span className="inline-flex rounded-full bg-sky-100 text-sky-800 px-2 py-0.5 text-xs font-medium">Ongoing</span>
                        )}
                        {e.cancelledDays && e.cancelledDays.length > 0 && e.cancelledDays.length < e.days.length && (
                          <div className="text-[10px] text-rose-700 mt-0.5">Cancelled {e.cancelledDays.map((d) => dayLabel(d).slice(0, 3)).join(", ")}</div>
                        )}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </Card>
        ))
      )}
    </div>
  );
}
