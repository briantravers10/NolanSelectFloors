import Link from "next/link";
import { listActualLaborEntries, listEmployees, listScheduleAssignments } from "@/lib/db";
import { Card, PageHeader, Button } from "@/components/ui";
import { addDays, dayLabel, formatDateShort, isoDate, startOfWeek, todayIso } from "@/lib/dates";
import { formatCurrency } from "@/lib/calculations";
import { buildPayroll } from "@/lib/payroll";
import { employeeDisplayName } from "@/lib/employee-name";
import { canViewLaborCost, getActingUser } from "@/lib/current-user";
import { requireSectionAccess } from "@/lib/permissions";
import { AccessDenied } from "@/components/AccessDenied";
import { PrintButton } from "@/components/PrintButton";

/**
 * PAYROLL — everyone's hours for the week, Monday to Sunday, from what
 * was confirmed on End of Day Review (with the schedule as a fallback for
 * days not yet confirmed), grouped by tax status. Gated like Reports;
 * dollar figures only for people who can see pay rates.
 */
export default async function PayrollPage({ searchParams }: { searchParams: Promise<{ week?: string }> }) {
  const access = await requireSectionAccess("reports");
  if (access === "none") return <AccessDenied section="Payroll" />;
  const { week } = await searchParams;
  const anchor = week ? new Date(week + "T00:00:00") : new Date();
  const monday = startOfWeek(anchor);
  const weekDates = Array.from({ length: 7 }, (_, i) => isoDate(addDays(monday, i)));
  const weekKey = weekDates[0];
  const thisWeek = isoDate(startOfWeek(new Date(todayIso() + "T00:00:00")));

  const [employees, entries, assignments, actingUser] = await Promise.all([listEmployees(), listActualLaborEntries(), listScheduleAssignments(), getActingUser()]);
  const showPay = canViewLaborCost(actingUser);
  const groups = buildPayroll(weekDates, employees, entries, assignments);
  const grandHours = groups.reduce((s, g) => s + g.totalHours, 0);
  const grandPay = groups.reduce((s, g) => s + g.pay, 0);
  const unconfirmed = groups.reduce((s, g) => s + g.rows.reduce((x, r) => x + r.scheduledOnlyDays, 0), 0);

  return (
    <div>
      <PageHeader
        title="Payroll"
        subtitle="Hours for the week from End of Day Review, grouped by W-4 / 1099. Days with no hours confirmed yet fall back to the schedule at 8 hrs and are marked."
        action={
          <div className="flex items-center gap-2 no-print">
            <a href={`/payroll/export?week=${weekKey}`} className="inline-flex items-center rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
              ⬇ CSV
            </a>
            <PrintButton label="Print" />
          </div>
        }
      />

      <div className="flex flex-wrap items-center gap-2 mb-4 no-print">
        <Link href={`/payroll?week=${isoDate(addDays(monday, -7))}`}><Button variant="secondary">← Prev Week</Button></Link>
        <Link href={`/payroll?week=${thisWeek}`}><Button variant="secondary">This Week</Button></Link>
        <Link href={`/payroll?week=${isoDate(addDays(monday, 7))}`}><Button variant="secondary">Next Week →</Button></Link>
        <div className="ml-2 font-medium text-slate-900">
          Week of {formatDateShort(weekDates[0])} – {formatDateShort(weekDates[6])}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        <Card className="p-4"><div className="text-xs text-slate-500 uppercase">Total hours</div><div className="text-2xl font-semibold">{grandHours}</div></Card>
        {showPay && <Card className="p-4"><div className="text-xs text-slate-500 uppercase">Total pay</div><div className="text-2xl font-semibold">{formatCurrency(grandPay)}</div></Card>}
        <Card className="p-4"><div className="text-xs text-slate-500 uppercase">People</div><div className="text-2xl font-semibold">{groups.reduce((s, g) => s + g.rows.length, 0)}</div></Card>
        <Card className={`p-4 ${unconfirmed > 0 ? "border-amber-300 bg-amber-50" : ""}`}>
          <div className="text-xs text-slate-500 uppercase">Days not confirmed yet</div>
          <div className="text-2xl font-semibold">{unconfirmed}</div>
          {unconfirmed > 0 && <div className="text-[11px] text-amber-800 mt-0.5">Confirm on End of Day Review to replace the 8-hr schedule fallback.</div>}
        </Card>
      </div>

      {groups.map((g) => (
        <Card key={g.key} className="p-4 mb-5 print-break">
          <div className="flex items-baseline justify-between mb-2">
            <h2 className="text-sm font-semibold text-slate-900 uppercase tracking-wide">{g.label}</h2>
            <div className="text-sm text-slate-700">
              {g.rows.length} {g.rows.length === 1 ? "person" : "people"} · {g.totalHours} hrs{showPay ? ` · ${formatCurrency(g.pay)}` : ""}
            </div>
          </div>
          {g.rows.length === 0 ? (
            <p className="text-sm text-slate-500">No hours this week.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-slate-500 uppercase tracking-wide border-b border-slate-200">
                    <th className="py-2 pr-3">Name</th>
                    {weekDates.map((d) => (
                      <th key={d} className="py-2 px-1 text-center">
                        {dayLabel(d).slice(0, 3)}
                        <div className="text-[10px] font-normal text-slate-400">{d.slice(5)}</div>
                      </th>
                    ))}
                    <th className="py-2 px-2 text-right">Hours</th>
                    <th className="py-2 px-2 text-right">Days</th>
                    {showPay && <th className="py-2 pl-2 text-right">Pay</th>}
                  </tr>
                </thead>
                <tbody>
                  {g.rows.map((r) => (
                    <tr key={r.employee.id} className="border-b border-slate-100 last:border-0">
                      <td className="py-1.5 pr-3">
                        <Link href={`/staff/${r.employee.id}`} className="font-medium text-slate-900 hover:text-sky-700">{employeeDisplayName(r.employee)}</Link>
                        <div className="text-[11px] text-slate-500">{r.employee.title}</div>
                      </td>
                      {r.days.map((d) => (
                        <td key={d.date} className={`py-1.5 px-1 text-center tabular-nums ${d.hours === 0 ? "text-slate-300" : d.fromSchedule ? "text-amber-700" : "text-slate-800"}`} title={d.fromSchedule ? "From the schedule — not confirmed on End of Day Review yet" : undefined}>
                          {d.hours === 0 ? "—" : d.fromSchedule ? `${d.hours}*` : d.hours}
                        </td>
                      ))}
                      <td className="py-1.5 px-2 text-right font-medium tabular-nums">{r.totalHours}</td>
                      <td className="py-1.5 px-2 text-right tabular-nums">{r.daysWorked}</td>
                      {showPay && <td className="py-1.5 pl-2 text-right font-medium tabular-nums">{formatCurrency(r.pay)}</td>}
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t border-slate-200 font-semibold">
                    <td className="py-2 pr-3">Total</td>
                    {weekDates.map((d) => (
                      <td key={d} className="py-2 px-1 text-center tabular-nums text-slate-700">
                        {(() => { const h = g.rows.reduce((s, r) => s + (r.days.find((x) => x.date === d)?.hours ?? 0), 0); return h ? h : "—"; })()}
                      </td>
                    ))}
                    <td className="py-2 px-2 text-right tabular-nums">{g.totalHours}</td>
                    <td />
                    {showPay && <td className="py-2 pl-2 text-right tabular-nums">{formatCurrency(g.pay)}</td>}
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </Card>
      ))}
      <p className="text-[11px] text-slate-500">* Hours marked with an asterisk come from the schedule (8 hrs) because nothing has been confirmed for that day yet. Pay uses each person&apos;s rate at the time the hours were logged.</p>
    </div>
  );
}
