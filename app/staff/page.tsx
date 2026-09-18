import Link from "next/link";
import { listEmployeeSkills, listEmployees, listTimeOffEntries } from "@/lib/db";
import { Card, PageHeader, LinkButton } from "@/components/ui";
import { StaffTable } from "@/components/staff/StaffTable";
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

  const rows = employees.map((e) => ({
    id: e.id,
    name: `${e.first_name} ${e.last_name}`,
    nickname: e.nickname,
    title: e.title,
    phone: e.phone,
    taxStatus: e.tax_status,
    isDriver: e.is_driver,
    active: e.active,
    payRate: canViewRates ? payRateLabel(e) : undefined,
    capabilities: skillsByEmployee.get(e.id) ?? [],
    offTodayLabel: offToday.get(e.id)?.type,
    overAllowance: Boolean(canViewAllowance && (usageByEmployee.get(e.id)?.vacationOver || usageByEmployee.get(e.id)?.sickOver)),
  }));

  return (
    <div>
      <PageHeader
        title="Staff"
        subtitle={`${employees.filter((e) => e.active).length} active crew members.`}
        action={
          <div className="flex items-center gap-2">
            <Link href="/staff/time-off" className="rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">Time Off Summary</Link>
            <LinkButton href="/staff/new"><Icon name="plus" className="w-4 h-4" />New Staff</LinkButton>
          </div>
        }
      />
      <Card className="p-3">
        <StaffTable rows={rows} canViewRates={canViewRates} />
      </Card>
    </div>
  );
}
