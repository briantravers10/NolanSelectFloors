import Link from "next/link";
import {
  listActualLaborEntries,
  listBuildingContacts,
  listBuildings,
  listClientCompanies,
  listContacts,
  listDailyScheduleConfirmations,
  listEmployees,
  listProjectScheduleDays,
  listProjects,
  listScheduleAssignments,
  listWorkTypes,
} from "@/lib/db";
import { Card, PageHeader, Button } from "@/components/ui";
import { buildScheduleJobRows } from "@/lib/schedule";
import { addDays, dayLabel, formatDateShort, isoDate, todayIso } from "@/lib/dates";
import { ScheduleSubNav } from "@/components/schedule/ScheduleSubNav";
import { DailyList } from "@/components/schedule/DailyList";
import { ActualHoursSection } from "@/components/schedule/ActualHoursSection";
import { ConfirmDayForm } from "@/components/schedule/ConfirmDayForm";

export default async function ReviewPage({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  const { date: dateParam } = await searchParams;
  const today = todayIso();
  const date = dateParam ?? today;

  const [projects, buildings, clients, contacts, buildingContacts, employees, assignments, scheduleDays, workTypes, actualLaborEntries, confirmations] =
    await Promise.all([
      listProjects(),
      listBuildings(),
      listClientCompanies(),
      listContacts(),
      listBuildingContacts(),
      listEmployees(),
      listScheduleAssignments(),
      listProjectScheduleDays(),
      listWorkTypes(),
      listActualLaborEntries(),
      listDailyScheduleConfirmations(),
    ]);

  const rows = buildScheduleJobRows(date, { projects, buildings, clients, contacts, buildingContacts, employees, assignments, scheduleDays, workTypes });
  const activeProjects = projects.filter((p) => rows.some((r) => r.projectId === p.id));
  const confirmation = confirmations.find((c) => c.work_date === date);

  return (
    <div>
      <PageHeader title="End of Day Review" subtitle="Confirm who worked, how many hours, and note any schedule changes." />
      <ScheduleSubNav active="review" />

      <div className="flex items-center gap-2 mb-4">
        <Link href={`/schedule/review?date=${isoDate(addDays(new Date(date + "T00:00:00"), -1))}`}><Button variant="secondary">← Prev Day</Button></Link>
        <Link href={`/schedule/review?date=${today}`}><Button variant="secondary">Today</Button></Link>
        <Link href={`/schedule/review?date=${isoDate(addDays(new Date(date + "T00:00:00"), 1))}`}><Button variant="secondary">Next Day →</Button></Link>
        <div className="ml-2 font-medium text-slate-900">{dayLabel(date)} <span className="text-slate-400 font-normal">{formatDateShort(date)}</span></div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        <div className="xl:col-span-2 space-y-4">
          <Card className="p-4">
            <h2 className="text-sm font-semibold text-slate-900 uppercase tracking-wide mb-3">Today&apos;s Jobs — Confirm Crew &amp; Status</h2>
            <DailyList rows={rows} />
          </Card>
          <ActualHoursSection date={date} entries={actualLaborEntries} employees={employees.filter((e) => e.active)} projects={activeProjects.length > 0 ? activeProjects : projects} />
        </div>
        <div className="space-y-4">
          <ConfirmDayForm date={date} confirmation={confirmation} />
        </div>
      </div>
    </div>
  );
}
