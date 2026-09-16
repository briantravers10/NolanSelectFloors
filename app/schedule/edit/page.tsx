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
} from "@/lib/db";
import { Card, PageHeader, EmptyState } from "@/components/ui";
import { buildScheduleJobRows } from "@/lib/schedule";
import { dayLabel, formatDateShort, todayIso } from "@/lib/dates";
import { ScheduleSubNav } from "@/components/schedule/ScheduleSubNav";
import { ScheduleEditForm } from "@/components/schedule/ScheduleEditForm";
import { SCHEDULE_COLOR_DOT } from "@/components/schedule/badges";

/**
 * CREATE / EDIT SCHEDULE — the one place all schedule controls live, per
 * the client's hard split. Left column: pick an existing job/day entry to
 * edit (filterable by date). Right column: a single, large, clearly
 * labeled single-column form covering every schedule-specific field. On
 * save, the user lands back on View Schedule for that date.
 */
export default async function ScheduleEditPage({
  searchParams,
}: {
  searchParams: Promise<{ project?: string; date?: string }>;
}) {
  const { project: projectParam, date: dateParam } = await searchParams;
  const date = dateParam ?? todayIso();

  const [projects, buildings, clients, contacts, buildingContacts, employees, assignments, scheduleDays, workTypes, timeOffEntries, pickupItems] = await Promise.all([
    listProjects(),
    listBuildings(),
    listClientCompanies(),
    listContacts(),
    listBuildingContacts(),
    listEmployees(),
    listScheduleAssignments(),
    listProjectScheduleDays(),
    listWorkTypes(),
    listTimeOffEntries(),
    listSchedulePickupItems(),
  ]);

  const buildingById = new Map(buildings.map((b) => [b.id, b]));
  const clientById = new Map(clients.map((c) => [c.id, c]));
  const activeEmployees = employees.filter((e) => e.active);

  // Every project, labeled with its building/unit/management company so
  // office staff can find the right job in one glance — "select the job
  // from existing projects" per spec.
  const jobOptions = [...projects]
    .map((p) => {
      const building = buildingById.get(p.building_id);
      const client = building ? clientById.get(building.client_company_id) : undefined;
      const label = `${building?.name ?? p.name}${p.unit_number ? ` — Unit ${p.unit_number}` : ""}${client ? ` · ${client.name}` : ""}`;
      return { id: p.id, label };
    })
    .sort((a, b) => a.label.localeCompare(b.label));

  // "Select an existing entry to edit" — every job already on the
  // schedule for the chosen date.
  const rowsForDate = buildScheduleJobRows(date, { projects, buildings, clients, contacts, buildingContacts, employees, assignments, scheduleDays, workTypes });

  const selectedProjectId = projectParam && projects.some((p) => p.id === projectParam) ? projectParam : undefined;
  const selectedDay = selectedProjectId ? scheduleDays.find((d) => d.project_id === selectedProjectId && d.schedule_date === date) : undefined;
  const selectedCrew = selectedProjectId
    ? assignments.filter((a) => a.project_id === selectedProjectId && a.schedule_date === date).map((a) => a.employee_id)
    : [];
  const selectedPickupItems = selectedDay ? pickupItems.filter((i) => i.project_schedule_day_id === selectedDay.id) : [];

  return (
    <div>
      <PageHeader
        title="Create / Edit Schedule"
        subtitle="All schedule controls live here — color, crew, COI, materials, work type and notes. View Schedule is read-only."
      />
      <ScheduleSubNav active="edit" />

      <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-5 items-start">
        <Card className="p-4">
          <h2 className="text-sm font-semibold text-slate-900 uppercase tracking-wide mb-3">Load an Existing Entry</h2>
          <form className="space-y-2 mb-4">
            <label className="block text-[11px] text-slate-500 uppercase">Date</label>
            <input type="date" name="date" defaultValue={date} className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm" />
            <button type="submit" className="w-full rounded-lg bg-sky-600 text-white px-3.5 py-1.5 text-sm font-medium hover:bg-sky-700">
              Show Jobs For This Date
            </button>
          </form>

          <div className="text-[11px] font-semibold text-slate-500 uppercase mb-1">
            {dayLabel(date)}, {formatDateShort(date)}
          </div>
          {rowsForDate.length === 0 ? (
            <EmptyState message="No jobs on the schedule for this date yet." />
          ) : (
            <div className="space-y-1">
              {rowsForDate.map((row) => (
                <Link
                  key={row.key}
                  href={`/schedule/edit?project=${row.projectId}&date=${date}`}
                  className={`flex items-center gap-2 rounded-lg px-2.5 py-2 text-sm hover:bg-slate-50 border ${
                    row.projectId === selectedProjectId ? "border-sky-400 bg-sky-50" : "border-transparent"
                  }`}
                >
                  <span className={`w-2 h-2 rounded-full shrink-0 ${SCHEDULE_COLOR_DOT[row.scheduleColor]}`} />
                  <span className="truncate flex-1 text-slate-800">
                    {row.buildingName}
                    {row.unitNumber ? ` — Unit ${row.unitNumber}` : ""}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </Card>

        <ScheduleEditForm
          key={`${selectedProjectId ?? "new"}-${date}`}
          date={date}
          jobOptions={jobOptions}
          employees={activeEmployees}
          workTypes={workTypes.filter((w) => w.active)}
          selectedProjectId={selectedProjectId}
          selectedDay={selectedDay}
          selectedCrewEmployeeIds={selectedCrew}
          timeOffEntries={timeOffEntries.map((t) => ({ employee_id: t.employee_id, start_date: t.start_date, end_date: t.end_date, type: t.type }))}
          pickupItems={selectedPickupItems}
        />
      </div>
    </div>
  );
}
