import Link from "next/link";
import { listEmployeeSkills, listEmployees } from "@/lib/db";
import { Card, PageHeader, PhoneLink, LinkButton } from "@/components/ui";
import { Icon } from "@/components/Icon";
import { canViewLaborCost, getActingUser } from "@/lib/current-user";
import { payRateLabel } from "@/lib/labor-cost";

export default async function StaffPage() {
  const [employees, skills, actingUser] = await Promise.all([listEmployees(), listEmployeeSkills(), getActingUser()]);
  const canViewRates = canViewLaborCost(actingUser);
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
                <th className="px-4 py-3 text-center">Driver</th>
                {canViewRates && <th className="px-4 py-3 text-right">Pay Rate</th>}
                <th className="px-4 py-3">Capabilities</th>
              </tr>
            </thead>
            <tbody>
              {employees.map((e) => (
                <tr key={e.id} className={`border-b border-slate-100 last:border-0 hover:bg-slate-50 ${!e.active ? "opacity-50" : ""}`}>
                  <td className="px-4 py-3">
                    <Link href={`/staff/${e.id}`} className="font-medium text-slate-900 hover:text-sky-600">
                      {e.first_name} {e.last_name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{e.title}</td>
                  <td className="px-4 py-3"><PhoneLink phone={e.phone} /></td>
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
