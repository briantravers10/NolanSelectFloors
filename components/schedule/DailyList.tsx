import type { ScheduleJobRow } from "@/lib/schedule";
import type { Employee, WorkTypeRecord } from "@/lib/types";
import { EmptyState } from "@/components/ui";
import { ScheduleDayRowCard } from "./ScheduleDayRowCard";

/** Single full-width vertical list, one job per row — the Daily view's
 * core requirement. NOT a grid, NOT side-by-side cards. */
export function DailyList({ rows, workTypes, employees }: { rows: ScheduleJobRow[]; workTypes: WorkTypeRecord[]; employees: Employee[] }) {
  if (rows.length === 0) return <EmptyState message="No jobs scheduled for this day." />;
  return (
    <div className="flex flex-col gap-2">
      {rows.map((row) => (
        <ScheduleDayRowCard key={row.key} row={row} workTypes={workTypes} employees={employees} />
      ))}
    </div>
  );
}
