import Link from "next/link";
import { notFound } from "next/navigation";
import { getOfficeUser, listSectionPermissions } from "@/lib/db";
import { getActingUser } from "@/lib/current-user";
import { isOwnerActingUser } from "@/lib/permissions";
import { Card, PageHeader, Button } from "@/components/ui";
import { AccessDenied } from "@/components/AccessDenied";
import { ACCESS_ROLES, SECTION_KEYS, type SectionAccessLevel } from "@/lib/types";
import { setStaffActiveAction, setStaffOwnerAction, updateStaffAccessRoleAction } from "../actions";
import { SectionAccessRow } from "./SectionAccessRow";

export default async function StaffAccessDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const actingUser = await getActingUser();
  if (!(await isOwnerActingUser(actingUser))) {
    return <AccessDenied section="Staff Access" />;
  }

  const [staffMember, permissions] = await Promise.all([getOfficeUser(id), listSectionPermissions(id)]);
  if (!staffMember) notFound();

  const levelByKey = Object.fromEntries(permissions.map((p) => [p.section_key, p.access_level])) as Record<string, SectionAccessLevel>;

  return (
    <div className="max-w-3xl">
      <PageHeader
        title={staffMember.full_name}
        subtitle={staffMember.email ?? "No email on file yet"}
        action={
          <Link href="/company-setup/staff-access" className="text-sm text-sky-600 hover:underline">
            ← All staff
          </Link>
        }
      />

      <Card className="p-4 mb-6">
        <h2 className="text-sm font-semibold text-slate-900 uppercase tracking-wide mb-3">Account</h2>
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <form action={setStaffActiveAction.bind(null, id, !staffMember.active)}>
            <Button type="submit" variant="secondary">
              {staffMember.active ? "Deactivate account" : "Reactivate account"}
            </Button>
          </form>
          {/* Only another Owner can grant/revoke Owner status — the page
              itself is already Owner-gated above, and setStaffOwnerAction
              re-checks server-side (see README "Audit logging"). */}
          <form action={setStaffOwnerAction.bind(null, id, !staffMember.is_owner)}>
            <Button type="submit" variant={staffMember.is_owner ? "danger" : "secondary"}>
              {staffMember.is_owner ? "Revoke Owner status" : "Grant Owner status"}
            </Button>
          </form>
        </div>
        {staffMember.is_owner && (
          <p className="text-xs text-indigo-700 bg-indigo-50 rounded-lg px-3 py-2 mb-4">
            This person is an Owner/Admin — they have unrestricted, full-edit access to every section, always. The grid below is ignored for
            them.
          </p>
        )}
        <form action={updateStaffAccessRoleAction.bind(null, id)} className="flex items-center gap-2">
          <label className="text-xs font-medium text-slate-600">Legacy access-role tier (pay rates / QuickBooks connection):</label>
          <select name="access_role" defaultValue={staffMember.access_role} className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm">
            {ACCESS_ROLES.map((r) => (
              <option key={r} value={r}>
                {r === "owner_admin" ? "Owner/Admin" : r === "office_staff" ? "Office Staff" : "Field/Employee"}
              </option>
            ))}
          </select>
          <Button type="submit" variant="secondary">
            Save
          </Button>
        </form>
      </Card>

      <Card className="p-4">
        <h2 className="text-sm font-semibold text-slate-900 uppercase tracking-wide mb-1">Section Access</h2>
        <p className="text-xs text-slate-500 mb-3">
          None hides the section from their nav entirely. View lets them open it, but every Create/Edit/Delete control is hidden and blocked
          server-side. Edit gives full access to that section.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {SECTION_KEYS.map((key) => (
            <SectionAccessRow key={key} officeUserId={id} sectionKey={key} level={levelByKey[key] ?? "none"} />
          ))}
        </div>
      </Card>
    </div>
  );
}
