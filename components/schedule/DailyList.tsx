import type { ScheduleJobRow } from "@/lib/schedule";
import { EmptyState } from "@/components/ui";
import { ScheduleDayRowCard } from "./ScheduleDayRowCard";

/** Single full-width vertical list, one job per row — the View Schedule
 * Daily view's core requirement. NOT a grid, NOT side-by-side cards.
 * Read-only: every field is plain text/badges, and generous spacing is
 * preferred over cramming (a longer scrolling page is fine). */
export function DailyList({ rows }: { rows: ScheduleJobRow[] }) {
  if (rows.length === 0) return <EmptyState message="No jobs scheduled for this day." />;
  return (
    <div className="flex flex-col gap-4">
      {rows.map((row) => (
        <ScheduleDayRowCard key={row.key} row={row} />
      ))}
    </div>
  );
}
