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
  listSchedulePickupItems,
  listWorkTypes,
} from "@/lib/db";
import { Card, PageHeader, Button, Stat } from "@/components/ui";
import { buildScheduleJobRows } from "@/lib/schedule";
import { dayLaborCostTotal } from "@/lib/labor-cost";
import { canViewLaborCost, getActingUser } from "@/lib/current-user";
import { formatCurrency } from "@/lib/calculations";
import { addDays, dayLabel, formatDateShort, isoDate, todayIso } from "@/lib/dates";
import { ScheduleSubNav } from "@/components/schedule/ScheduleSubNav";
import { JobReviewCard } from "@/components/schedule/JobReviewCard";
import { ConfirmDayForm } from "@/components/schedule/ConfirmDayForm";

export default async function ReviewPage({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  const { date: dateParam } = await searchParams;
  const today = todayIso();
  const date = dateParam ?? today;

  const [projects, buildings, clients, contacts, buildingContacts, employees, assignments, scheduleDays, workTypes, actualLaborEntries, confirmations, actingUser, pickupItems] =
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
      getActingUser(),
      listSchedulePickupItems(),
    ]);

  const rows = buildScheduleJobRows(date, { projects, buildings, clients, contacts, buildingContacts, employees, assignments, scheduleDays, workTypes, pickupItems });
  const workingRows = rows.filter((r) => !r.weekendOff);
  const confirmation = confirmations.find((c) => c.work_date === date);
  const canViewCost = canViewLaborCost(actingUser);
  const dayCost = dayLaborCostTotal(date, actualLaborEntries);

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

      {canViewCost && (
        <div className="mb-4 max-w-xs">
          <Stat label="Total Labor Cost — This Day (Actual)" value={formatCurrency(dayCost)} />
        </div>
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
              />
            ))
          )}
        </div>
        <div className="space-y-4">
          <ConfirmDayForm date={date} confirmation={confirmation} />
        </div>
      </div>
    </div>
  );
}
