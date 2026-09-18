import { listActualLaborEntries, listEmployees, listScheduleAssignments } from "@/lib/db";
import { addDays, isoDate, startOfWeek } from "@/lib/dates";
import { buildPayroll, payrollCsv } from "@/lib/payroll";
import { canViewLaborCost, getActingUser } from "@/lib/current-user";
import { getSectionAccessFor } from "@/lib/permissions";

/** CSV of the week's payroll — same gating as the Payroll page. */
export async function GET(request: Request) {
  const actingUser = await getActingUser();
  if ((await getSectionAccessFor(actingUser, "reports")) === "none") return new Response("Forbidden", { status: 403 });
  const url = new URL(request.url);
  const week = url.searchParams.get("week");
  const monday = startOfWeek(week ? new Date(week + "T00:00:00") : new Date());
  const weekDates = Array.from({ length: 7 }, (_, i) => isoDate(addDays(monday, i)));
  const [employees, entries, assignments] = await Promise.all([listEmployees(), listActualLaborEntries(), listScheduleAssignments()]);
  const csv = payrollCsv(buildPayroll(weekDates, employees, entries, assignments), weekDates, canViewLaborCost(actingUser));
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="payroll-week-${weekDates[0]}.csv"`,
    },
  });
}
