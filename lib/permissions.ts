// Per-section permission engine (build 11) — see README "Permissions &
// Staff Access" for the full write-up of how this relates to the existing
// access_role tier (lib/current-user.ts canViewLaborCost/canEditPayRates/
// canViewQuickBooks/etc, which stay exactly as they are for a handful of
// specific sensitive sub-features).
//
// This is the NEW layer: one access level (none/view/edit) per staff
// member per nav section (lib/types.ts SECTION_KEYS), set by the
// Owner/Admin at /company-setup/staff-access. Secure by default — no row
// for a (user, section) pair means 'none'.
import { listOfficeUsers, listSectionPermissions } from "./db";
import { getActingUser, OWNER_ACTING_ID, type ActingUser } from "./current-user";
import { SECTION_KEYS, type SectionAccessLevel, type SectionKey } from "./types";

/**
 * The section-access level for a given acting user. is_owner (or the
 * hardcoded owner/manager acting-user sentinel) is unrestricted "edit" on
 * every section, always — not subject to the section_permissions grid,
 * per the client's own description of how his friend's Owner access
 * works. Everyone else defaults to 'none' until the Owner/Admin explicitly
 * grants access.
 */
export async function getSectionAccessFor(actingUser: ActingUser, sectionKey: SectionKey): Promise<SectionAccessLevel> {
  if (actingUser.id === OWNER_ACTING_ID) return "edit";
  const officeUsers = await listOfficeUsers();
  const match = officeUsers.find((u) => u.id === actingUser.id);
  if (match?.is_owner) return "edit";
  const perms = await listSectionPermissions(actingUser.id);
  const explicit = perms.find((p) => p.section_key === sectionKey)?.access_level;
  // Everyone with a login can at least see the dashboard (jobs, man
  // count, who's working). The money on it is gated separately by
  // canViewLaborCost, so this is safe for field staff.
  if (!explicit && sectionKey === "dashboard") return "view";
  return explicit ?? "none";
}

/** Same as getSectionAccessFor, but for the CURRENT acting user (the usual call site — same pattern as canViewLaborCost etc. in lib/current-user.ts). */
export async function getSectionAccess(sectionKey: SectionKey): Promise<SectionAccessLevel> {
  return getSectionAccessFor(await getActingUser(), sectionKey);
}

export async function canView(sectionKey: SectionKey): Promise<boolean> {
  const level = await getSectionAccess(sectionKey);
  return level === "view" || level === "edit";
}

export async function canEdit(sectionKey: SectionKey): Promise<boolean> {
  return (await getSectionAccess(sectionKey)) === "edit";
}

/**
 * All section access levels for one acting user in a single pair of
 * lookups — used by the nav (to hide/gray-out items) and the staff-access
 * edit grid (to pre-fill current values), rather than N separate
 * getSectionAccessFor() calls.
 */
export async function getAllSectionAccess(actingUser: ActingUser): Promise<Record<SectionKey, SectionAccessLevel>> {
  const result = Object.fromEntries(SECTION_KEYS.map((k) => [k, "none" as SectionAccessLevel])) as Record<SectionKey, SectionAccessLevel>;
  if (actingUser.id === OWNER_ACTING_ID) {
    for (const key of SECTION_KEYS) result[key] = "edit";
    return result;
  }
  const officeUsers = await listOfficeUsers();
  const match = officeUsers.find((u) => u.id === actingUser.id);
  if (match?.is_owner) {
    for (const key of SECTION_KEYS) result[key] = "edit";
    return result;
  }
  const perms = await listSectionPermissions(actingUser.id);
  for (const p of perms) {
    if ((SECTION_KEYS as readonly string[]).includes(p.section_key)) result[p.section_key as SectionKey] = p.access_level;
  }
  return result;
}

/**
 * Route-guard helper for a section's page.tsx — the least-invasive
 * pattern given ~14 sections (see README "Enforcement"). Call at the top
 * of a page and render <AccessDenied /> when it returns 'none':
 *
 *   const access = await requireSectionAccess("clients");
 *   if (access === "none") return <AccessDenied section="Clients" />;
 *
 * 'view'-only pages use the same return value to hide/disable
 * Create/Edit/Delete controls (`access === "edit"`). The REAL security
 * boundary is server-action gating (each section's actions.ts re-checks
 * canEdit() before writing) — this guard is the honest UI-level
 * complement to that, not a substitute for it.
 */
export async function requireSectionAccess(sectionKey: SectionKey): Promise<SectionAccessLevel> {
  return getSectionAccess(sectionKey);
}

/** Owner/Admin check for the staff-access management UI itself — either
 * the is_owner flag on a real office_user row, or the existing
 * access_role === 'owner_admin' tier (for the hardcoded owner/manager
 * acting-user sentinel, which has no office_users row of its own). */
export async function isOwnerActingUser(actingUser?: ActingUser): Promise<boolean> {
  const user = actingUser ?? (await getActingUser());
  if (user.id === OWNER_ACTING_ID) return true;
  if (user.accessRole === "owner_admin") {
    const officeUsers = await listOfficeUsers();
    const match = officeUsers.find((u) => u.id === user.id);
    // A plain owner_admin access_role (pay-rate visibility tier) does NOT
    // by itself grant is_owner-level staff-access management — only an
    // explicit is_owner flag (or the acting-user sentinel above) does.
    return !!match?.is_owner;
  }
  return false;
}
