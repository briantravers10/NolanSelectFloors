import Link from "next/link";
import { listEmployees, listTimeOffEntries } from "@/lib/db";
import { Card, PageHeader } from "@/components/ui";
import { computeTimeOffUsageByEmployee } from "@/lib/time-off";
import { employeeDisplayName } from "@/lib/employee-name";
import { requireSectionAccess } from "@/lib/permissions";
import { AccessDenied } from "@/components/AccessDenied";
import { PrintButton } from "@/components/PrintButton";

/**
 * Everyone's time off for a calendar year on one page: vacation and sick
 * used vs. allowed, plus personal and unpaid. Counts working days only
 * (Sat/Sun never count) and resets on January 1 — pick another year to
 * look back.
 */
export default async function StaffTimeOffPage({ searchParams }: { searchParams: Promise<{ year?: string }> }) {
  const access = await requireSectionAccess("staff");
  if (access === "none") return <AccessDenied section="Staff" />;
  const { year: yearParam } = await searchParams;
  const thisYear = new Date().getFullYear();
  const year = yearParam && /^\d{4}$/.test(yearParam) ? Number(yearParam) : thisYear;
  const [employees, entries] = await Promise.all([listEmployees(), listTimeOffEntries()]);
  const active = employees.filter((e) => e.active).sort((a, b) => a.first_name.localeCompare(b.first_name));
  const usage = computeTimeOffUsageByEmployee(entries, active, year);
  const totals = { vacation: 0, sick: 0, personal: 0, unpaid: 0 };
  for (const u of usage.values()) {
    totals.vacation += u.vacationUsed;
    totals.sick += u.sickUsed;
    totals.personal += u.personalUsed;
    totals.unpaid += u.unpaidUsed;
  }
  const cell = (used: number, allowed: number | null, over: boolean) => (
    <td className={`py-2 px-2 text-right tabular-nums ${over ? "text-rose-700 font-semibold" : used ? "text-slate-900" : "text-slate-400"}`}>
      {used}
      {allowed != null && <span className="text-slate-400 font-normal"> / {allowed}</span>}
    </td>
  );

  return (
    <div>
      <PageHeader
        title="Time Off Summary"
        subtitle={`Vacation, sick, personal and unpaid days taken in ${year}. Working days only — weekends don't count. Balances reset every January 1.`}
        action={
          <div className="flex items-center gap-2 no-print">
            <Link href={`/staff/time-off?year=${year - 1}`} className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm hover:bg-slate-50">‹ {year - 1}</Link>
            <span className="text-sm font-semibold text-slate-900">{year}</span>
            <Link href={`/staff/time-off?year=${year + 1}`} className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm hover:bg-slate-50">{year + 1} ›</Link>
            <PrintButton />
          </div>
        }
      />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        <Card className="p-4"><div className="text-xs text-slate-500 uppercase">Vacation days</div><div className="text-2xl font-semibold">{totals.vacation}</div></Card>
        <Card className="p-4"><div className="text-xs text-slate-500 uppercase">Sick days</div><div className="text-2xl font-semibold">{totals.sick}</div></Card>
        <Card className="p-4"><div className="text-xs text-slate-500 uppercase">Personal days</div><div className="text-2xl font-semibold">{totals.personal}</div></Card>
        <Card className="p-4"><div className="text-xs text-slate-500 uppercase">Unpaid days</div><div className="text-2xl font-semibold">{totals.unpaid}</div></Card>
      </div>
      <Card className="p-3">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-slate-500 uppercase tracking-wide border-b border-slate-200">
                <th className="py-2 px-2">Name</th>
                <th className="py-2 px-2 text-right">Vacation used / allowed</th>
                <th className="py-2 px-2 text-right">Sick used / allowed</th>
                <th className="py-2 px-2 text-right">Personal</th>
                <th className="py-2 px-2 text-right">Unpaid</th>
                <th className="py-2 px-2 text-right">Total days off</th>
              </tr>
            </thead>
            <tbody>
              {active.map((e) => {
                const u = usage.get(e.id)!;
                const total = u.vacationUsed + u.sickUsed + u.personalUsed + u.unpaidUsed;
                return (
                  <tr key={e.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                    <td className="py-2 px-2">
                      <Link href={`/staff/${e.id}`} className="font-medium text-slate-900 hover:text-sky-700">{employeeDisplayName(e)}</Link>
                      <div className="text-[11px] text-slate-500">{e.title}</div>
                    </td>
                    {cell(u.vacationUsed, u.vacationAllowed, u.vacationOver)}
                    {cell(u.sickUsed, u.sickAllowed, u.sickOver)}
                    <td className={`py-2 px-2 text-right tabular-nums ${u.personalUsed ? "text-slate-900" : "text-slate-400"}`}>{u.personalUsed}</td>
                    <td className={`py-2 px-2 text-right tabular-nums ${u.unpaidUsed ? "text-slate-900" : "text-slate-400"}`}>{u.unpaidUsed}</td>
                    <td className="py-2 px-2 text-right tabular-nums font-medium">{total}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="text-[11px] text-slate-500 mt-2 px-2">Red means over the allowance set on their staff page. A dash after the slash means no allowance has been set yet.</p>
      </Card>
    </div>
  );
}
