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
  listTimeOffEntries,
  listWorkTypes,
  listProjectOutboundInvoices,
  listActualLaborEntriesForDate,
  ensureDriverWorkingDefaults,
} from "@/lib/db";
import { Card, PageHeader, EmptyState } from "@/components/ui";
import { UNASSIGNED_CLIENT_NAME } from "@/lib/types";
import { buildScheduleJobRows } from "@/lib/schedule";
import { addDays, dayLabel, formatDateShort, isoDate, todayIso } from "@/lib/dates";
import { isEmployeeOffOn, timeOffWarningLabel } from "@/lib/time-off";
import { employeeDisplayName } from "@/lib/employee-name";
import { getActingUser } from "@/lib/current-user";
import { canEdit } from "@/lib/permissions";
import { ScheduleSubNav } from "@/components/schedule/ScheduleSubNav";
import { ScheduleEditForm } from "@/components/schedule/ScheduleEditForm";
import { ScrollToFormOnSmallScreens } from "@/components/schedule/ScrollToFormOnSmallScreens";
import { ScheduleDayRowCard } from "@/components/schedule/ScheduleDayRowCard";
import { DraggableTiles } from "@/components/schedule/DraggableTiles";
import { QuickJobForm } from "@/components/schedule/QuickJobForm";
import { DriverWorkingToggle } from "@/components/schedule/DriverWorkingToggle";
import { PrintButton } from "@/components/PrintButton";

/**
 * CREATE / EDIT SCHEDULE. Layout, top to bottom:
 *   1. Date strip (prev / next / picker) + Quick Job.
 *   2. Left, wide: the day's schedule exactly as View Schedule shows it,
 *      so every save is visible immediately; each block has an Edit link
 *      that loads it into the form. Right: the single-column form.
 *   3. Bottom, compact: who's not on any job that day.
 */
export default async function ScheduleEditPage({
  searchParams,
}: {
  searchParams: Promise<{ project?: string; date?: string; qj?: string; qj_building?: string; qj_unit?: string; qj_contact?: string; qj_phone?: string; qj_desc?: string }>;
}) {
  const { project: projectParam, date: dateParam, qj, qj_building, qj_unit, qj_contact, qj_phone, qj_desc } = await searchParams;
  const date = dateParam ?? todayIso();

  // Drivers Working Today is opt-OUT: the first time this date is opened
  // with edit access, every active driver is auto-marked working (see
  // lib/db.ts#ensureDriverWorkingDefaults) — office staff only need to act
  // to uncheck an exception. Must run before the actual-labor fetch below
  // so the seeded rows show up immediately rather than on the next load.
  if (await canEdit("schedule")) {
    const actingUser = await getActingUser();
    await ensureDriverWorkingDefaults(date, actingUser.fullName);
  }

  const [projects, buildings, clients, contacts, buildingContacts, employees, assignments, scheduleDays, workTypes, timeOffEntries, pickupItems, outboundInvoices, dayLaborEntries] = await Promise.all([
    listProjects(),
    listBuildings(),
    listClientCompanies(),
    listContacts(),
    listBuildingContacts(),
    listEmployees(),
    listScheduleAssignments({ maxDate: date }),
    listProjectScheduleDays({ maxDate: date }),
    listWorkTypes(),
    listTimeOffEntries(),
    listSchedulePickupItems(),
    listProjectOutboundInvoices(),
    listActualLaborEntriesForDate(date),
  ]);

  const buildingById = new Map(buildings.map((b) => [b.id, b]));
  const clientById = new Map(clients.map((c) => [c.id, c]));
  const activeEmployees = employees.filter((e) => e.active);

  // Bug fix (production ReferenceError on this page): must be computed
  // BEFORE jobOptions below, which reads it inside a filter callback.
  // `||` short-circuiting meant this only threw "Cannot access
  // 'selectedProjectId' before initialization" once the filter reached a
  // project whose pipeline_stage IS "Complete" — i.e. intermittently,
  // whenever any completed job existed anywhere in the company, not on
  // every load, which is exactly what the production error log showed.
  const selectedProjectId = projectParam && projects.some((p) => p.id === projectParam) ? projectParam : undefined;

  // Completed jobs are left out of the picker — EXCEPT the one being
  // edited. If it were missing, the browser would silently select the first
  // job in the list and Save would write this entry onto that other job.
  const jobOptions = [...projects]
    .filter((p) => p.pipeline_stage !== "Complete" || p.id === selectedProjectId)
    .map((p) => {
      const building = buildingById.get(p.building_id);
      const client = building ? clientById.get(building.client_company_id) : undefined;
      const label = `#${p.job_number} — ${building?.name ?? p.name}${p.unit_number ? ` — Unit ${p.unit_number}` : ""}${client ? ` · ${client.name}` : ""}`;
      return { id: p.id, label };
    })
    .sort((a, b) => a.label.localeCompare(b.label));

  const quickBuildings = buildings
    .filter((b) => b.active)
    .map((b) => ({ name: b.name, clientName: clientById.get(b.client_company_id)?.name }))
    .sort((a, b) => a.name.localeCompare(b.name));
  const quickClients = clients.filter((c) => c.name !== UNASSIGNED_CLIENT_NAME).map((c) => ({ name: c.name })).sort((a, b) => a.name.localeCompare(b.name));
  const quickContacts = contacts
    .map((c) => ({ name: `${c.first_name} ${c.last_name}`.trim(), clientName: c.client_company_id ? clientById.get(c.client_company_id)?.name : undefined }))
    .filter((c) => c.name)
    .sort((a, b) => a.name.localeCompare(b.name));

  const outboundInvoiceProjectIds = new Set(outboundInvoices.filter((i) => i.is_current).map((i) => i.project_id));
  const rowsForDate = buildScheduleJobRows(date, { projects, buildings, clients, contacts, buildingContacts, employees, assignments, scheduleDays, workTypes, pickupItems, outboundInvoiceProjectIds });

  // Prefill from the row as shown for this date — which, for a job carried
  // over from an earlier day, is that day's entry and crew — so editing a
  // continued job doesn't start from a blank form.
  const selectedRow = selectedProjectId ? rowsForDate.find((r) => r.projectId === selectedProjectId) : undefined;
  const selectedDay = selectedRow?.scheduleDayId ? scheduleDays.find((d) => d.id === selectedRow.scheduleDayId) : undefined;
  const selectedCrew = selectedRow ? selectedRow.crew.map((c) => c.employeeId) : [];
  const selectedPickupItems = selectedDay ? pickupItems.filter((i) => i.project_schedule_day_id === selectedDay.id) : [];

  // Who's busy = everyone on any row shown for this date, including crew
  // carried over with a job from an earlier day (not just rows saved on
  // this exact date).
  const assignedIds = new Set(rowsForDate.filter((r) => !r.weekendOff).flatMap((r) => r.crew.map((c) => c.employeeId)));
  const notOnSchedule = activeEmployees
    .filter((e) => !assignedIds.has(e.id))
    .map((e) => {
      const off = isEmployeeOffOn(timeOffEntries, e.id, date);
      return { id: e.id, name: employeeDisplayName(e), offLabel: off ? timeOffWarningLabel(off.type) : null };
    })
    .sort((a, b) => (a.offLabel ? 1 : 0) - (b.offLabel ? 1 : 0) || a.name.localeCompare(b.name));

  // Daily Driver Working Status — every active driver, whether or not
  // they're on a job today. Marking one Working adds their day rate to
  // payroll (lib/db.ts#setDriverWorkingDay) via the SAME actual_labor_entries
  // row/rate-snapshot every other logged day uses — no job assignment, no
  // separate payroll system. A driver already logged on a job today (any
  // actual_labor_entries row for this date) is shown as already covered
  // instead of an editable checkbox, so their day rate is never counted twice.
  const drivers = activeEmployees
    .filter((e) => e.is_driver)
    .map((e) => {
      const mine = dayLaborEntries.filter((entry) => entry.employee_id === e.id);
      const onJobToday = mine.some((entry) => entry.project_id !== null);
      const driverEntry = mine.find((entry) => entry.project_id === null);
      const timeOff = isEmployeeOffOn(timeOffEntries, e.id, date);
      return {
        id: e.id,
        name: employeeDisplayName(e),
        onJobToday,
        working: Boolean(driverEntry),
        offLabel: timeOff ? timeOffWarningLabel(timeOff.type) : null,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  const prevDate = isoDate(addDays(new Date(date + "T00:00:00"), -1));
  const nextDate = isoDate(addDays(new Date(date + "T00:00:00"), 1));

  return (
    <div>
      <PageHeader title="Create / Edit Schedule" subtitle="Build the day here. Every save shows up in the list on the left straight away." />
      <ScheduleSubNav active="edit" />

      {/* 1. Date strip + Quick Job */}
      <Card className="p-3 mb-4 flex flex-wrap items-center gap-2">
        <Link href={`/schedule/edit?date=${prevDate}`} className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm hover:bg-slate-50" aria-label="Previous day">
          ‹
        </Link>
        <form className="flex items-center gap-2">
          <input type="date" name="date" defaultValue={date} className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm" />
          <button type="submit" className="rounded-lg bg-slate-800 text-white px-3 py-1.5 text-sm font-medium hover:bg-slate-900">
            Go
          </button>
        </form>
        <Link href={`/schedule/edit?date=${nextDate}`} className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm hover:bg-slate-50" aria-label="Next day">
          ›
        </Link>
        <div className="text-sm font-semibold text-slate-800 ml-1">
          {dayLabel(date)}, {formatDateShort(date)}
        </div>
        <div className="ml-auto flex-1 sm:flex-none min-w-[280px] flex justify-end gap-2">
          <PrintButton />
          <Link href={`/schedule/print?date=${date}`} className="no-print inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
            🖨 Print for John
          </Link>
          <QuickJobForm
            date={date}
            buildings={quickBuildings}
            clients={quickClients}
            contacts={quickContacts}
            error={qj}
            prefill={qj ? { building: qj_building, unit: qj_unit, contact: qj_contact, phone: qj_phone, desc: qj_desc } : undefined}
          />
        </div>
      </Card>

      {/* 2. Daily Driver Working Status — quick, one-time-per-day check, up
          top so it's done first thing and out of the way. */}
      {drivers.length > 0 && (
        <Card className="p-3 mb-4">
          <h2 className="text-xs font-semibold text-slate-700 uppercase tracking-wide mb-1.5">Drivers Working Today</h2>
          <div className="flex flex-wrap gap-x-5 gap-y-1.5">
            {drivers.map((d) => (
              <div key={d.id} className="flex items-center gap-2 text-sm">
                <span className="text-slate-800">{d.name}</span>
                {d.offLabel && (
                  <span className="text-[11px] font-medium text-amber-700" title="Auto-unselected because of time off — check the box to override">
                    {d.offLabel}
                  </span>
                )}
                {d.onJobToday ? (
                  <span className="text-[11px] text-slate-500">Already on a job today</span>
                ) : (
                  <DriverWorkingToggle employeeId={d.id} date={date} working={d.working} />
                )}
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* 3. Day's schedule (left) + form (right, scrolls on its own) */}
      <div className="grid grid-cols-1 xl:grid-cols-[1fr_420px] gap-5 items-start">
        <div>
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-semibold text-slate-900 uppercase tracking-wide">
              On the schedule — {rowsForDate.length} {rowsForDate.length === 1 ? "job" : "jobs"}
            </h2>
            {selectedProjectId && (
              <Link href={`/schedule/edit?date=${date}`} className="text-xs text-sky-600 hover:text-sky-800">
                + New entry instead
              </Link>
            )}
          </div>
          {rowsForDate.length === 0 ? (
            <Card className="p-6">
              <EmptyState message="Nothing on the schedule for this day yet. Pick a job in the form, or use Quick Job for a small one-off." />
            </Card>
          ) : (
            <DraggableTiles
              key={rowsForDate.map((r) => `${r.projectId}:${r.weekendOff ? "off" : r.scheduleColor}`).join("|")}
              date={date}
              items={rowsForDate.map((row) => ({
                projectId: row.projectId,
                color: row.weekendOff ? "off" : row.scheduleColor,
                node: (
                  <div className={`rounded-xl ${row.projectId === selectedProjectId ? "ring-2 ring-sky-400" : ""}`}>
                    <ScheduleDayRowCard row={row} editableNotes />
                  </div>
                ),
              }))}
            />
          )}
        </div>

        <div id="schedule-edit-form" className="xl:sticky xl:top-[4.5rem] xl:max-h-[calc(100vh-5.5rem)] xl:overflow-y-auto xl:pr-1">
          <ScrollToFormOnSmallScreens targetId="schedule-edit-form" when={selectedProjectId ?? ""} />
          <ScheduleEditForm
            key={`${selectedProjectId ?? "new"}-${date}`}
            date={date}
            jobOptions={jobOptions}
            employees={activeEmployees}
            selectedProjectId={selectedProjectId}
            selectedDay={selectedDay}
            selectedCrewEmployeeIds={selectedCrew}
            timeOffEntries={timeOffEntries.map((t) => ({ employee_id: t.employee_id, start_date: t.start_date, end_date: t.end_date, type: t.type }))}
            pickupItems={selectedPickupItems}
            selectedUnitNumber={selectedRow?.unitNumber}
          />
        </div>
      </div>

      {/* 4. Not on the schedule — compact, at the bottom */}
      <Card className="p-3 mt-5">
        <div className="flex items-baseline justify-between mb-1.5">
          <h2 className="text-xs font-semibold text-slate-700 uppercase tracking-wide">Not on the schedule</h2>
          <span className="text-[11px] text-slate-500">
            {notOnSchedule.length} of {activeEmployees.length} free on {dayLabel(date)}
          </span>
        </div>
        {notOnSchedule.length === 0 ? (
          <p className="text-xs text-slate-500">Everyone is on a job this day.</p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {notOnSchedule.map((e) => (
              <span
                key={e.id}
                className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] ${
                  e.offLabel ? "border-amber-200 bg-amber-50 text-amber-800" : "border-slate-200 bg-slate-50 text-slate-700"
                }`}
                title={e.offLabel ?? undefined}
              >
                {e.name}
                {e.offLabel && <span className="font-semibold">{e.offLabel}</span>}
              </span>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
