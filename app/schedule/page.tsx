import Link from "next/link";
import { employeeDisplayName } from "@/lib/employee-name";
import {
  listBuildingContacts,
  listBuildings,
  listClientCompanies,
  listContacts,
  listEmployees,
  listProjectScheduleDays,
  listProjects,
  listQuickBooksDocuments,
  listScheduleAssignments,
  listSchedulePickupItems,
  listWorkTypes,
} from "@/lib/db";
import { Card, PageHeader, Button } from "@/components/ui";
import { buildScheduleJobRows } from "@/lib/schedule";
import { addDays, dayLabel, formatDateShort, isoDate, startOfWeek, todayIso } from "@/lib/dates";
import { ScheduleSubNav } from "@/components/schedule/ScheduleSubNav";
import { DailyList } from "@/components/schedule/DailyList";
import { WeeklyView } from "@/components/schedule/WeeklyView";
import { MonthlyView } from "@/components/schedule/MonthlyView";
import { SendScheduleButton } from "@/components/schedule/SendScheduleButton";
import { requireSectionAccess } from "@/lib/permissions";
import { AccessDenied } from "@/components/AccessDenied";

type View = "day" | "week" | "month";

export default async function SchedulePage({ searchParams }: { searchParams: Promise<{ date?: string; view?: string }> }) {
  const access = await requireSectionAccess("schedule");
  if (access === "none") return <AccessDenied section="Schedule" />;

  const { date: dateParam, view: viewParam } = await searchParams;
  const view: View = viewParam === "week" || viewParam === "month" ? viewParam : "day";
  const anchor = dateParam ? new Date(dateParam + "T00:00:00") : new Date();
  const today = todayIso();
  const activeDate = dateParam ?? today;

  const [projects, buildings, clients, contacts, buildingContacts, employees, assignments, scheduleDays, workTypes, pickupItems, qbDocuments] = await Promise.all([
    listProjects(),
    listBuildings(),
    listClientCompanies(),
    listContacts(),
    listBuildingContacts(),
    listEmployees(),
    listScheduleAssignments(),
    listProjectScheduleDays(),
    listWorkTypes(),
    listSchedulePickupItems(),
    listQuickBooksDocuments(),
  ]);

  const rowInputs = { projects, buildings, clients, contacts, buildingContacts, employees, assignments, scheduleDays, workTypes, pickupItems, qbDocuments };

  const monday = startOfWeek(anchor);
  const weekDates = Array.from({ length: 7 }, (_, i) => isoDate(addDays(monday, i)));
  const rowsByDate = new Map(weekDates.map((d) => [d, buildScheduleJobRows(d, rowInputs)]));

  const viewHref = (v: View) => `/schedule?view=${v}&date=${activeDate}`;

  // Night-before send preview for the active day (see components/schedule/
  // SendScheduleButton.tsx — preview only, not wired to real delivery yet).
  const activeDateAssignments = assignments.filter((a) => a.schedule_date === activeDate);
  const employeeById = new Map(employees.map((e) => [e.id, e]));
  const projectById = new Map(projects.map((p) => [p.id, p]));
  const buildingById = new Map(buildings.map((b) => [b.id, b]));
  const scheduleMessages = activeDateAssignments.map((a) => {
    const emp = employeeById.get(a.employee_id);
    const project = projectById.get(a.project_id);
    const building = project ? buildingById.get(project.building_id) : undefined;
    const location = building ? `${building.name}, ${building.address}` : "the job site";
    const unitPart = project?.unit_number ? `, Unit ${project.unit_number}` : "";
    const callTime = a.call_time || "7:00 AM";
    const dow = dayLabel(activeDate);
    const dateLabel = formatDateShort(activeDate);
    const work = a.role_on_job + (a.time_and_half ? " (time-and-half)" : "");
    return { employeeName: emp ? employeeDisplayName(emp) : "Crew member", text: `${emp?.first_name ?? "Crew member"}, please go to ${location}${unitPart} at ${callTime} on ${dow}, ${dateLabel}. Work: ${work}.` };
  });
  const scheduleMessage = scheduleMessages.length > 0 ? scheduleMessages.map((m) => m.text).join("\n\n") : `No crew scheduled for ${dayLabel(activeDate)}, ${formatDateShort(activeDate)}.`;

  return (
    <div>
      <PageHeader
        title="Schedule"
        subtitle="Daily, weekly and monthly job schedule"
        action={view === "day" ? <SendScheduleButton message={scheduleMessage} messages={scheduleMessages} /> : undefined}
      />
      <ScheduleSubNav active="view" />

      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="inline-flex rounded-lg border border-slate-300 overflow-hidden">
          {(["day", "week", "month"] as View[]).map((v) => (
            <Link
              key={v}
              href={viewHref(v)}
              className={`px-4 py-2 text-sm font-medium capitalize ${view === v ? "bg-sky-600 text-white" : "bg-white text-slate-700 hover:bg-slate-50"}`}
            >
              {v}
            </Link>
          ))}
        </div>

        {view === "day" && (
          <div className="flex items-center gap-2">
            <Link href={`/schedule?view=day&date=${isoDate(addDays(new Date(activeDate + "T00:00:00"), -1))}`}><Button variant="secondary">← Prev Day</Button></Link>
            <Link href={`/schedule?view=day&date=${today}`}><Button variant="secondary">Today</Button></Link>
            <Link href={`/schedule?view=day&date=${isoDate(addDays(new Date(activeDate + "T00:00:00"), 1))}`}><Button variant="secondary">Next Day →</Button></Link>
          </div>
        )}
        {view === "week" && (
          <div className="flex items-center gap-2">
            <Link href={`/schedule?view=week&date=${isoDate(addDays(monday, -7))}`}><Button variant="secondary">← Prev Week</Button></Link>
            <Link href={`/schedule?view=week&date=${today}`}><Button variant="secondary">This Week</Button></Link>
            <Link href={`/schedule?view=week&date=${isoDate(addDays(monday, 7))}`}><Button variant="secondary">Next Week →</Button></Link>
          </div>
        )}
        {view === "month" && (
          <div className="flex items-center gap-2">
            <Link href={`/schedule?view=month&date=${isoDate(addDays(anchor, -30))}`}><Button variant="secondary">← Prev</Button></Link>
            <Link href={`/schedule?view=month&date=${today}`}><Button variant="secondary">This Month</Button></Link>
            <Link href={`/schedule?view=month&date=${isoDate(addDays(anchor, 30))}`}><Button variant="secondary">Next →</Button></Link>
          </div>
        )}
      </div>

      {view === "day" && (
        <>
          <Card className="p-3 mb-3">
            <div className="font-semibold text-slate-900">{dayLabel(activeDate)} <span className="text-slate-400 font-normal">{formatDateShort(activeDate)}</span></div>
          </Card>
          <DailyList rows={buildScheduleJobRows(activeDate, rowInputs)} />
        </>
      )}

      {view === "week" && (
        <WeeklyView weekDates={weekDates} today={today} rowsByDate={rowsByDate} />
      )}

      {view === "month" && (
        <MonthlyView
          monthAnchor={anchor}
          today={today}
          rowsByDate={new Map(
            Array.from({ length: 42 }, (_, i) => {
              const d = isoDate(addDays(startOfWeek(new Date(anchor.getFullYear(), anchor.getMonth(), 1)), i));
              return [d, buildScheduleJobRows(d, rowInputs)] as const;
            })
          )}
        />
      )}
    </div>
  );
}
