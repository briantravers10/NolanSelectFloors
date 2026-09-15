import type { DailyScheduleConfirmation } from "@/lib/types";
import { Card, Button } from "@/components/ui";
import { confirmDayAction } from "@/app/schedule/actions";

export function ConfirmDayForm({ date, confirmation }: { date: string; confirmation?: DailyScheduleConfirmation }) {
  return (
    <Card className="p-4">
      <h2 className="text-sm font-semibold text-slate-900 uppercase tracking-wide mb-2">Confirm Day</h2>
      {confirmation && (
        <div className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2 mb-3">
          Confirmed by {confirmation.confirmed_by} at {new Date(confirmation.confirmed_at).toLocaleString()}.
          {" "}Confirming again just updates this — the day is never locked, and every later edit stays possible and gets logged.
        </div>
      )}
      <form action={confirmDayAction.bind(null, date)} className="space-y-2">
        <textarea
          name="notes"
          rows={2}
          defaultValue={confirmation?.notes ?? ""}
          placeholder="Anything worth noting about today — crews that moved jobs, schedule changes, issues to flag…"
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
        <Button type="submit" className="w-full justify-center">{confirmation ? "Re-Confirm Day" : "Confirm Day"}</Button>
      </form>
    </Card>
  );
}
