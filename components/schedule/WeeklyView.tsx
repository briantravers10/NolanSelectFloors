import Link from "next/link";
import type { ScheduleJobRow } from "@/lib/schedule";
import { dayLabel, formatDateShort } from "@/lib/dates";
import { Card, EmptyState } from "@/components/ui";
import { SCHEDULE_COLOR_DOT } from "./badges";

/** "See the week at a glance" — compact color-grouped rows per day, not
 * full job detail. Clicking a job opens that day's full Daily view. */
export function WeeklyView({ weekDates, today, rowsByDate }: { weekDates: string[]; today: string; rowsByDate: Map<string, ScheduleJobRow[]> }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-3">
      {weekDates.map((date) => {
        const rows = rowsByDate.get(date) ?? [];
        return (
          <Card key={date} className={`p-3 ${date === today ? "ring-2 ring-sky-400" : ""}`}>
            <div className="flex items-center justify-between mb-2">
              <div className="font-semibold text-sm text-slate-900">{dayLabel(date)} <span className="text-slate-400 font-normal">{formatDateShort(date)}</span></div>
              <span className="text-xs text-slate-500">{rows.length} job{rows.length === 1 ? "" : "s"}</span>
            </div>
            {rows.length === 0 ? (
              <EmptyState message="No jobs scheduled." />
            ) : (
              <div className="space-y-1">
                {rows.map((row) => (
                  <Link
                    key={row.key}
                    href={`/schedule?date=${date}`}
                    className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-slate-50 text-xs"
                  >
                    <span className={`w-2 h-2 rounded-full shrink-0 ${SCHEDULE_COLOR_DOT[row.scheduleColor]}`} />
                    <span className="truncate flex-1 text-slate-800">
                      {row.buildingName}{row.unitNumber ? ` — ${row.unitNumber}` : ""}
                    </span>
                    <span className="text-slate-400 shrink-0">{row.crewCount} crew</span>
                  </Link>
                ))}
              </div>
            )}
          </Card>
        );
      })}
    </div>
  );
}
