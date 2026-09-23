import Link from "next/link";
import {
  listActualLaborEntries,
  listAgendaEvents,
  listOfficeUsers,
  listBuildingContacts,
  listBuildings,
  listClientCompanies,
  listContacts,
  listDailyScheduleConfirmations,
  listEmployees,
  listProjectScheduleDays,
  listProjects,
  listScheduleAssignments,
  listSchedulePickupItems,
  listWorkTypes,
} from "@/lib/db";
import { Card, PageHeader, Button, Stat } from "@/components/ui";
import { buildScheduleJobRows } from "@/lib/schedule";
import { dayLaborCostTotal, dayPlannedLaborCostTotal } from "@/lib/labor-cost";
import { canViewLaborCost, getActingUser } from "@/lib/current-user";
import { formatCurrency } from "@/lib/calculations";
import { addDays, dayLabel, formatDateShort, isoDate, todayIso } from "@/lib/dates";
import { UNASSIGNED_CLIENT_NAME } from "@/lib/types";
import { ScheduleSubNav } from "@/components/schedule/ScheduleSubNav";
import { JobReviewCard } from "@/components/schedule/JobReviewCard";
import { AgendaDoneToggle } from "@/components/agenda/AgendaDoneToggle";
import { ConfirmDayForm } from "@/components/schedule/ConfirmDayForm";
import { QuickJobForm } from "@/components/schedule/QuickJobForm";

export default async function ReviewPage({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  const { date: dateParam } = await searchParams;
  const today = todayIso();
  const date = dateParam ?? today;

  const [projects, buildings, clients, contacts, buildingContacts, employees, assignments, scheduleDays, workTypes, actualLaborEntries, confirmations, actingUser, pickupItems, agendaEvents, officeUsers] =
    await Promise.all([
      listProjects(),
      listBuildings(),
      listClientCompanies(),
      listContacts(),
      listBuildingContacts(),
      listEmployees(),
      listScheduleAssignments({ maxDate: date }),
      listProjectScheduleDays({ maxDate: date }),
      listWorkTypes(),
      listActualLaborEntries(),
      listDailyScheduleConfirmations(),
      getActingUser(),
      listSchedulePickupItems(),
      listAgendaEvents(),
      listOfficeUsers(),
    ]);

  const rows = buildScheduleJobRows(date, { projects, buildings, clients, contacts, buildingContacts, employees, assignments, scheduleDays, workTypes, pickupItems });
  const workingRows = rows.filter((r) => !r.weekendOff);
  // How many jobs each person is on today — a double-booked person is paid
  // one day rate, so the review cards split their hours instead of doubling.
  const jobsToday: Record<string, number> = {};
  for (const r of workingRows) for (const c of r.crew) jobsToday[c.employeeId] = (jobsToday[c.employeeId] ?? 0) + 1;
  // Everyone's agenda items for the day, grouped by whose agenda.
  const userName = new Map(officeUsers.map((u) => [u.id, u.full_name]));
  const dayAgendaMap = new Map<string, typeof agendaEvents>();
  for (const e of agendaEvents.filter((x) => x.event_date === date)) {
    const name = userName.get(e.owner_user_id) ?? (e.owner_user_id === "owner" ? "Owner" : "Agenda");
    dayAgendaMap.set(name, [...(dayAgendaMap.get(name) ?? []), e]);
  }
  const dayAgenda = [...dayAgendaMap.entries()].map(([n, items]) => [n, items.sort((a, b) => (a.start_time ?? "").localeCompare(b.start_time ?? ""))] as const);
  const confirmation = confirmations.find((c) => c.work_date === date);
  const canViewCost = canViewLaborCost(actingUser);
  const dayCost = dayLaborCostTotal(date, actualLaborEntries);
  const plannedCost = dayPlannedLaborCostTotal(date, assignments);

  const clientById = new Map(clients.map((c) => [c.id, c]));
  const quickBuildings = buildings
    .filter((b) => b.active)
    .map((b) => ({ name: b.name, clientName: clientById.get(b.client_company_id)?.name }))
    .sort((a, b) => a.name.localeCompare(b.name));
  const quickClients = clients.filter((c) => c.name !== UNASSIGNED_CLIENT_NAME).map((c) => ({ name: c.name })).sort((a, b) => a.name.localeCompare(b.name));
  const quickContacts = contacts
    .map((c) => ({ name: `${c.first_name} ${c.last_name}`.trim(), clientName: c.client_company_id ? clientById.get(c.client_company_id)?.name : undefined }))
    .filter((c) => c.name)
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div>
      <PageHeader title="End of Day Review" subtitle="Confirm who worked, how many hours, and note any schedule changes." />
      <ScheduleSubNav active="review" />

      <div className="flex flex-wrap items-center gap-2 mb-4">
        <Link href={`/schedule/review?date=${isoDate(addDays(new Date(date + "T00:00:00"), -1))}`}><Button variant="secondary">← Prev Day</Button></Link>
        <Link href={`/schedule/review?date=${today}`}><Button variant="secondary">Today</Button></Link>
        <Link href={`/schedule/review?date=${isoDate(addDays(new Date(date + "T00:00:00"), 1))}`}><Button variant="secondary">Next Day →</Button></Link>
        <div className="ml-2 font-medium text-slate-900">{dayLabel(date)} <span className="text-slate-400 font-normal">{formatDateShort(date)}</span></div>
        <div className="ml-auto">
          <QuickJobForm date={date} buildings={quickBuildings} clients={quickClients} contacts={quickContacts} />
        </div>
      </div>

      {canViewCost && (
        <div className="mb-4 flex flex-wrap gap-3">
          <Stat label="Total Labor Cost — This Day (Actual)" value={formatCurrency(dayCost)} />
          <Stat label="Planned From Schedule (Estimate)" value={formatCurrency(plannedCost)} />
        </div>
      )}
      {canViewCost && dayCost < plannedCost && (
        <p className="text-xs text-slate-500 -mt-3 mb-4">
          Actual only counts hours confirmed below for each job — it rises as you fill in &quot;who worked&quot; and Save hours. Planned is what today&apos;s scheduled crew would cost if nothing changes.
        </p>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        <div className="xl:col-span-2 space-y-4">
          <div className="flex items-baseline justify-between">
            <h2 className="text-sm font-semibold text-slate-900 uppercase tracking-wide">Today&apos;s Jobs — status, who worked, hours</h2>
            <span className="text-xs text-slate-500">{workingRows.length} {workingRows.length === 1 ? "job" : "jobs"}</span>
          </div>
          {workingRows.length === 0 ? (
            <Card className="p-6 text-sm text-slate-500">Nothing on the schedule for this day.</Card>
          ) : (
            workingRows.map((row) => (
              <JobReviewCard
                key={row.key}
                row={row}
                employees={employees.filter((e) => e.active)}
                entries={actualLaborEntries.filter((e) => e.project_id === row.projectId && e.work_date === date)}
                canViewCost={canViewCost}
                jobsToday={jobsToday}
              />
            ))
          )}
        </div>
        <div className="space-y-4">
          <Card className="p-4">
            <h2 className="text-sm font-semibold text-slate-900 uppercase tracking-wide mb-2">Agenda — {dayLabel(date)}</h2>
            {dayAgenda.length === 0 ? (
              <p className="text-xs text-slate-500">Nothing on anyone&apos;s agenda for this day.</p>
            ) : (
              <div className="space-y-3">
                {dayAgenda.map(([ownerName, items]) => (
                  <div key={ownerName}>
                    <div className="text-[11px] font-semibold text-slate-600 uppercase tracking-wide mb-1">{ownerName}</div>
                    <div className="divide-y divide-slate-100">
                      {items.map((e) => (
                        <div key={e.id} className={`py-1.5 flex items-start gap-2 text-sm ${e.completed_at ? "opacity-60" : ""}`}>
                          <AgendaDoneToggle id={e.id} done={Boolean(e.completed_at)} />
                          <div className="min-w-0">
                            <div className={`text-slate-800 ${e.completed_at ? "line-through" : ""}`}>{e.title}</div>
                            <div className="text-xs text-slate-500">
                              {e.start_time ? `${e.start_time}${e.end_time ? `–${e.end_time}` : ""}` : "All day"}
                              {e.location ? ` · ${e.location}` : ""}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
            <Link href="/agenda" className="mt-2 inline-block text-xs text-sky-600 hover:text-sky-800">Open agenda →</Link>
          </Card>
          <ConfirmDayForm date={date} confirmation={confirmation} />
        </div>
      </div>
    </div>
  );
}
