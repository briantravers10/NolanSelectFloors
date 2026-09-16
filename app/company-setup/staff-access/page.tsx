import Link from "next/link";
import { listOfficeUsers } from "@/lib/db";
import { getActingUser } from "@/lib/current-user";
import { isOwnerActingUser } from "@/lib/permissions";
import { Card, PageHeader, Button } from "@/components/ui";
import { AccessDenied } from "@/components/AccessDenied";
import { ACCESS_ROLES, OFFICE_USER_ROLES } from "@/lib/types";
import { createStaffAccountAction } from "./actions";
import { StaffAccessGridFields } from "./StaffAccessGridFields";

/**
 * Owner/Admin-only staff-access management (build 11) — see
 * lib/permissions.ts and README "Permissions & Staff Access". Lives under
 * Company Setup, alongside the other admin-only settings screens
 * (QuickBooks connection management, the discovery questionnaire).
 */
export default async function StaffAccessPage() {
  const actingUser = await getActingUser();
  if (!(await isOwnerActingUser(actingUser))) {
    return <AccessDenied section="Staff Access" />;
  }

  const staff = await listOfficeUsers();

  return (
    <div className="max-w-4xl">
      <PageHeader
        title="Staff Access"
        subtitle="Owner/Admin only. Give each staff member their own login persona and control exactly what they can see and edit, section by section."
      />

      <Card className="mb-6">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-slate-500 uppercase tracking-wide border-b border-slate-200">
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Access Role</th>
                <th className="px-4 py-3">Owner</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {staff.map((u) => (
                <tr key={u.id} className="border-b border-slate-100 last:border-0">
                  <td className="px-4 py-3 font-medium text-slate-900">{u.full_name}</td>
                  <td className="px-4 py-3 text-slate-600">{u.email ?? "—"}</td>
                  <td className="px-4 py-3 text-slate-600">{u.access_role}</td>
                  <td className="px-4 py-3">
                    {u.is_owner ? <span className="text-xs font-medium bg-indigo-100 text-indigo-700 rounded-full px-2 py-0.5">Owner</span> : <span className="text-slate-400 text-xs">—</span>}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-medium rounded-full px-2 py-0.5 ${u.active ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-500"}`}>
                      {u.active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link href={`/company-setup/staff-access/${u.id}`} className="text-sky-600 text-xs font-medium hover:underline">
                      Edit access →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card className="p-4">
        <h2 className="text-sm font-semibold text-slate-900 uppercase tracking-wide mb-1">+ Add Staff Account</h2>
        <p className="text-xs text-slate-500 mb-4">
          Real per-person email+password login isn&apos;t connected yet (see{" "}
          <Link href="/login" className="text-sky-600 hover:underline">
            /login
          </Link>
          ) — this creates a staff persona the dev &quot;acting as&quot; selector can switch to now, ready to become a real account the moment
          a Supabase project with Auth is connected (see README &quot;Activating Real Login&quot;).
        </p>
        <form action={createStaffAccountAction} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Full name</label>
              <input name="full_name" required className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Email</label>
              <input name="email" type="email" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Bid-claim role</label>
              <select name="role" defaultValue="estimator" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
                {OFFICE_USER_ROLES.map((r) => (
                  <option key={r} value={r}>
                    {r === "estimator" ? "Estimator" : "Manager"}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Access-role tier (legacy — pay rates/QuickBooks connection)</label>
              <select name="access_role" defaultValue="office_staff" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
                {ACCESS_ROLES.map((r) => (
                  <option key={r} value={r}>
                    {r === "owner_admin" ? "Owner/Admin" : r === "office_staff" ? "Office Staff" : "Field/Employee"}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <h3 className="text-xs font-semibold text-slate-700 uppercase tracking-wide mb-2">Section access</h3>
            <StaffAccessGridFields />
          </div>

          <div className="flex justify-end">
            <Button type="submit">Add Staff Account</Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
