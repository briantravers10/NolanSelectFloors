import Link from "next/link";
import type { ScheduleJobRow } from "@/lib/schedule";
import { addDays, isoDate } from "@/lib/dates";
import { Card } from "@/components/ui";
import { SCHEDULE_COLORS } from "@/lib/types";
import { SCHEDULE_COLOR_DOT } from "./badges";

const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/** Standard calendar grid. Each date shows a lightweight indicator (one
 * dot per schedule-color group present that day) — no full job details.
 * Clicking a date opens that day's Daily view. */
export function MonthlyView({ monthAnchor, today, rowsByDate }: { monthAnchor: Date; today: string; rowsByDate: Map<string, ScheduleJobRow[]> }) {
  const year = monthAnchor.getFullYear();
  const month = monthAnchor.getMonth();
  const firstOfMonth = new Date(year, month, 1);
  const startWeekday = (firstOfMonth.getDay() + 6) % 7; // 0 = Monday
  const gridStart = addDays(firstOfMonth, -startWeekday);
  const cells = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));

  return (
    <Card className="p-3">
      <div className="grid grid-cols-7 gap-1 mb-1">
        {WEEKDAY_LABELS.map((d) => (
          <div key={d} className="text-center text-[11px] font-medium text-slate-500 uppercase py-1">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((cellDate) => {
          const iso = isoDate(cellDate);
          const inMonth = cellDate.getMonth() === month;
          const rows = rowsByDate.get(iso) ?? [];
          const colorsPresent = SCHEDULE_COLORS.filter((c) => rows.some((r) => r.scheduleColor === c));
          return (
            <Link
              key={iso}
              href={`/schedule?date=${iso}`}
              className={`aspect-square rounded-lg border p-1.5 flex flex-col items-start gap-1 hover:bg-slate-50 ${
                iso === today ? "border-sky-400 ring-1 ring-sky-300" : "border-slate-200"
              } ${inMonth ? "" : "opacity-40"}`}
            >
              <span className={`text-xs font-medium ${iso === today ? "text-sky-700" : "text-slate-700"}`}>{cellDate.getDate()}</span>
              <div className="flex flex-wrap gap-0.5 mt-auto">
                {colorsPresent.map((c) => (
                  <span key={c} className={`w-1.5 h-1.5 rounded-full ${SCHEDULE_COLOR_DOT[c]}`} title={c} />
                ))}
                {rows.length > 0 && <span className="text-[10px] text-slate-400 leading-none">{rows.length}</span>}
              </div>
            </Link>
          );
        })}
      </div>
    </Card>
  );
}
