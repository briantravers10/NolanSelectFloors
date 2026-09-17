import Link from "next/link";
import { listEmployeeSkills, listEmployees, listTimeOffEntries } from "@/lib/db";
import { Card, PageHeader, PhoneLink, LinkButton } from "@/components/ui";
import { Icon } from "@/components/Icon";
import { canViewLaborCost, canViewTimeOffAllowance, getActingUser } from "@/lib/current-user";
import { payRateLabel } from "@/lib/labor-cost";
import { computeTimeOffUsageByEmployee, getTimeOffForDate } from "@/lib/time-off";
import { todayIso } from "@/lib/dates";
import { requireSectionAccess } from "@/lib/permissions";
import { AccessDenied } from "@/components/AccessDenied";

export default async function StaffPage() {
  const access = await requireSectionAccess("staff");
  if (access === "none") return <AccessDenied section="Staff" />;

  const [employees, skills, actingUser, timeOffEntries] = await Promise.all([
    listEmployees(),
    listEmployeeSkills(),
    getActingUser(),
    listTimeOffEntries(),
  ]);
  const canViewRates = canViewLaborCost(actingUser);
  const canViewAllowance = canViewTimeOffAllowance(actingUser);
  const offToday = getTimeOffForDate(timeOffEntries, todayIso());
  const usageByEmployee = computeTimeOffUsageByEmployee(timeOffEntries, employees);
  const skillsByEmployee = new Map<string, string[]>();
  for (const s of skills) {
    if (!skillsByEmployee.has(s.employee_id)) skillsByEmployee.set(s.employee_id, []);
    skillsByEmployee.get(s.employee_id)!.push(s.capability);
  }

  return (
    <div>
      <PageHeader
        title="Staff"
        subtitle={`${employees.filter((e) => e.active).length} active crew members.`}
        action={<LinkButton href="/staff/new"><Icon name="plus" className="w-4 h-4" />New Staff</LinkButton>}
      />
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-slate-500 uppercase tracking-wide border-b border-slate-200">
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Title</th>
                <th className="px-4 py-3">Phone</th>
                <th className="px-4 py-3">Tax</th>
                <th className="px-4 py-3 text-center">Driver</th>
                {canViewRates && <th className="px-4 py-3 text-right">Pay Rate</th>}
                <th className="px-4 py-3">Capabilities</th>
              </tr>
            </thead>
            <tbody>
              {employees.map((e) => (
                <tr key={e.id} className={`border-b border-slate-100 last:border-0 hover:bg-slate-50 ${!e.active ? "opacity-50" : ""}`}>
                  <td className="px-4 py-3">
                    <Link href={`/staff/${e.id}`} className="font-medium text-slate-900 hover:text-sky-600 inline-flex items-center gap-1.5">
                      {e.first_name} {e.last_name}
                    </Link>
                    {offToday.has(e.id) && (
                      <span className="ml-2 inline-flex items-center rounded-full bg-amber-50 text-amber-800 border border-amber-200 px-2 py-0.5 text-[11px] font-medium whitespace-nowrap">
                        {offToday.get(e.id)!.type} today
                      </span>
                    )}
                    {canViewAllowance && (usageByEmployee.get(e.id)?.vacationOver || usageByEmployee.get(e.id)?.sickOver) && (
                      <span
                        className="ml-2 inline-flex items-center rounded-full bg-rose-50 text-rose-800 border border-rose-200 px-2 py-0.5 text-[11px] font-medium whitespace-nowrap"
                        title="Used more time off this year than their allowance — no email/notification system yet, this badge is the alert."
                      >
                        ⚠ Over Allowance
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{e.title}</td>
                  <td className="px-4 py-3"><PhoneLink phone={e.phone} /></td>
                  <td className="px-4 py-3 text-slate-600">{e.tax_status ?? "—"}</td>
                  <td className="px-4 py-3 text-center">{e.is_driver ? "Yes" : "—"}</td>
                  {canViewRates && <td className="px-4 py-3 text-right">{payRateLabel(e)}</td>}
                  <td className="px-4 py-3 text-slate-500 text-xs">{(skillsByEmployee.get(e.id) ?? []).join(", ")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
