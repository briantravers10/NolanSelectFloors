"use server";

// Data-access layer. Every function checks for a configured Supabase
// project first; if one isn't reachable (no env vars — the default in this
// environment) it transparently reads/writes the in-memory seed store
// instead. Pages and server actions should only ever import from here,
// never from lib/store.ts or lib/supabaseClient.ts directly, so the
// eventual move to a live database (or to auth-scoped queries) touches one
// file.
import { randomUUID } from "crypto";
import { getSupabaseClient } from "./supabaseClient";
import { getStore } from "./store";
import { getCurrentCompanyId } from "./current-user";
import { mapJobStatusToPipelineStage } from "./schedule";
import type {
  ActivityLogEntry,
  ActualLaborEntry,
  AgendaEvent,
  AgendaEventSource,
  BidStatus,
  Building,
  BuildingContact,
  ClientCompany,
  Communication,
  CompanySetupAnswer,
  Contact,
  DailyScheduleConfirmation,
  DocumentRecord,
  EmailRoutingRule,
  Employee,
  EmployeeAvailability,
  EmployeeSkill,
  Invoice,
  InvoiceStatus,
  JobRequest,
  JobRequestStatus,
  Material,
  MaterialRateItem,
  NewBusinessLead,
  OfficeUser,
  PhotoCategory,
  PhotoRecord,
  PipelineStage,
  PricingFormula,
  PricingFormulaComponent,
  Project,
  ProjectCrewRequirement,
  ProjectDrawing,
  ProjectMaterial,
  ProjectNote,
  ProjectScheduleDay,
  ProjectWorkType,
  QBDocumentStatus,
  QuickBooksConnection,
  QuickBooksCustomerMapping,
  QuickBooksDocument,
  QuickBooksEntityType,
  QuickBooksEnvironment,
  QuickBooksSyncLogEntry,
  QuickBooksWebhookEvent,
  RelatedRecordType,
  ScheduleAssignment,
  SchedulePickupItem,
  SchedulePickupStatus,
  SectionAccessLevel,
  SectionKey,
  SectionPermission,
  StaffCapability,
  Task,
  TaskStatus,
  TimeOffEntry,
  TimeOffType,
  WorkTypeRecord,
  InboundEmail,
  InboundKind,
} from "./types";
import { UNASSIGNED_CLIENT_NAME } from "./types";

function sb() {
  return getSupabaseClient();
}

// ---------------------------------------------------------------------
// READS
// ---------------------------------------------------------------------

export async function listClientCompanies(): Promise<ClientCompany[]> {
  const client = sb();
  if (client) {
    const { data, error } = await client.from("client_companies").select("*").order("name");
    if (!error && data) return data as ClientCompany[];
  }
  return [...getStore().clientCompanies].sort((a, b) => a.name.localeCompare(b.name));
}

export async function getClientCompany(id: string): Promise<ClientCompany | undefined> {
  return (await listClientCompanies()).find((c) => c.id === id);
}

export async function listContacts(): Promise<Contact[]> {
  const client = sb();
  if (client) {
    const { data, error } = await client.from("contacts").select("*");
    if (!error && data) return data as Contact[];
  }
  return getStore().contacts;
}

export async function getContact(id: string): Promise<Contact | undefined> {
  return (await listContacts()).find((c) => c.id === id);
}

export async function updateContact(id: string, input: Partial<Pick<Contact, "first_name" | "last_name" | "title" | "phone" | "mobile_phone" | "email" | "notes">>): Promise<void> {
  const client = sb();
  if (client) {
    const { error } = await client.from("contacts").update(input).eq("id", id);
    if (error) throw error;
  } else {
    const contact = getStore().contacts.find((c) => c.id === id);
    if (contact) Object.assign(contact, input);
  }
}

export async function createContact(input: Omit<Contact, "id" | "company_id" | "created_at">): Promise<Contact> {
  const record: Contact = {
    id: randomUUID(),
    company_id: getCurrentCompanyId(),
    created_at: new Date().toISOString(),
    ...input,
  };
  const client = sb();
  if (client) {
    const { error } = await client.from("contacts").insert(record);
    if (error) throw error;
  } else {
    getStore().contacts.push(record);
  }
  return record;
}

export async function listBuildings(): Promise<Building[]> {
  const client = sb();
  if (client) {
    const { data, error } = await client.from("buildings").select("*").order("name");
    if (!error && data) return data as Building[];
  }
  return [...getStore().buildings].sort((a, b) => a.name.localeCompare(b.name));
}

export async function getBuilding(id: string): Promise<Building | undefined> {
  return (await listBuildings()).find((b) => b.id === id);
}

export async function listBuildingContacts(): Promise<BuildingContact[]> {
  const client = sb();
  if (client) {
    const { data, error } = await client.from("building_contacts").select("*");
    if (!error && data) return data as BuildingContact[];
  }
  return getStore().buildingContacts;
}

export async function deleteContact(id: string): Promise<void> {
  const client = sb();
  if (client) {
    const { error } = await client.from("contacts").delete().eq("id", id);
    if (error) throw error;
  } else {
    const store = getStore();
    store.contacts = store.contacts.filter((c) => c.id !== id);
    store.buildingContacts = store.buildingContacts.filter((bc) => bc.contact_id !== id);
  }
}

/** Removes a building only when nothing references it (no projects or
 * job requests); otherwise the caller should mark it inactive instead so
 * job history stays intact. Cascades its contact links. */
export async function deleteBuilding(id: string): Promise<void> {
  const client = sb();
  if (client) {
    const { error } = await client.from("buildings").delete().eq("id", id);
    if (error) throw error;
  } else {
    const store = getStore();
    store.buildings = store.buildings.filter((b) => b.id !== id);
    store.buildingContacts = store.buildingContacts.filter((bc) => bc.building_id !== id);
  }
}

export async function deleteBuildingContact(buildingId: string, contactId: string): Promise<void> {
  const client = sb();
  if (client) {
    const { error } = await client.from("building_contacts").delete().eq("building_id", buildingId).eq("contact_id", contactId);
    if (error) throw error;
  } else {
    const store = getStore();
    store.buildingContacts = store.buildingContacts.filter((bc) => !(bc.building_id === buildingId && bc.contact_id === contactId));
  }
}

/** Links a contact to a building with a role; the first contact added to
 * a building is normally flagged is_primary so it's the POC on the
 * schedule/building pages. */
export async function createBuildingContact(input: Omit<BuildingContact, "id">): Promise<BuildingContact> {
  const record: BuildingContact = { id: randomUUID(), ...input };
  const client = sb();
  if (client) {
    const { error } = await client.from("building_contacts").insert(record);
    if (error) throw error;
  } else {
    getStore().buildingContacts.push(record);
  }
  return record;
}

export async function listJobRequests(): Promise<JobRequest[]> {
  const client = sb();
  if (client) {
    const { data, error } = await client.from("job_requests").select("*").order("received_at", { ascending: false });
    if (!error && data) return data as JobRequest[];
  }
  return [...getStore().jobRequests].sort((a, b) => (a.received_at < b.received_at ? 1 : -1));
}

export async function getJobRequest(id: string): Promise<JobRequest | undefined> {
  return (await listJobRequests()).find((j) => j.id === id);
}

export async function listProjects(): Promise<Project[]> {
  const client = sb();
  if (client) {
    const { data, error } = await client.from("projects").select("*");
    if (!error && data) return data as Project[];
  }
  return getStore().projects;
}

export async function getProject(id: string): Promise<Project | undefined> {
  return (await listProjects()).find((p) => p.id === id);
}

export async function listOfficeUsers(): Promise<OfficeUser[]> {
  const client = sb();
  if (client) {
    const { data, error } = await client.from("office_users").select("*").order("full_name");
    if (!error && data) return data as OfficeUser[];
  }
  return [...getStore().officeUsers].sort((a, b) => a.full_name.localeCompare(b.full_name));
}

export async function getOfficeUser(id: string): Promise<OfficeUser | undefined> {
  return (await listOfficeUsers()).find((u) => u.id === id);
}

/**
 * Looks up the office_users row matching a real Supabase Auth user id
 * (build 12 — Activating Real Login). The one lookup lib/auth.ts's
 * getCurrentSession() needs once a real session cookie resolves to a
 * Supabase Auth user — see supabase/migrations/0012_permissions_and_auth.sql
 * (auth_user_id) and 0013_auth_user_id_index.sql (the lookup index).
 */
export async function getOfficeUserByAuthId(authUserId: string): Promise<OfficeUser | undefined> {
  return (await listOfficeUsers()).find((u) => u.auth_user_id === authUserId);
}

/**
 * True once at least one office_users row has a real Supabase Auth account
 * (auth_user_id set) — build 12 bootstrap check. NSF_REAL_AUTH_ENABLED=true
 * alone would otherwise lock every page (including Company Setup → Staff
 * Access, the only place to create that first account) behind a login that
 * can't yet succeed. Both lib/auth.ts#getCurrentSession() and the request
 * middleware (lib/supabase/middleware.ts) fall back to the dev "acting as"
 * mechanism until this returns true, then real login is enforced everywhere.
 */
export async function hasAnyRealAuthAccount(): Promise<boolean> {
  return (await listOfficeUsers()).some((u) => Boolean(u.auth_user_id));
}

// ---------------------------------------------------------------------
// STAFF ACCOUNTS (build 11) — office_users create/update + the new
// section_permissions grid. See lib/permissions.ts and README "Permissions
// & Staff Access". Owner/Admin-only from the caller side (app/company-setup
// /staff-access/actions.ts checks this before calling in).
// ---------------------------------------------------------------------

export async function createOfficeUser(
  input: Omit<OfficeUser, "id" | "company_id" | "created_at" | "auth_user_id" | "is_owner">,
  actorName?: string
): Promise<OfficeUser> {
  const record: OfficeUser = {
    // A real UUID, not a prefixed string — office_users.id is a Postgres
    // `uuid` column against a real Supabase project, which rejects
    // anything else (the same class of issue the seed data's readable
    // "ou-1"-style IDs hit, fixed there by remapping at seed time; this
    // function runs live, so it must generate a valid UUID directly).
    id: randomUUID(),
    company_id: getCurrentCompanyId(),
    created_at: new Date().toISOString(),
    auth_user_id: null,
    is_owner: false,
    ...input,
  };
  const client = sb();
  if (client) {
    const { error } = await client.from("office_users").insert(record);
    if (error) throw error;
  } else {
    getStore().officeUsers.push(record);
  }
  logActivity({ action: "Added staff account", related_type: "office_user", related_id: record.id, actor_name: actorName, detail: `${record.full_name}${record.email ? ` <${record.email}>` : ""} — ${record.access_role}` });
  return record;
}

export async function updateOfficeUser(
  id: string,
  patch: Partial<Pick<OfficeUser, "full_name" | "email" | "role" | "access_role" | "active" | "is_owner" | "auth_user_id">>,
  actorName?: string
): Promise<void> {
  const before = await getOfficeUser(id);
  const client = sb();
  if (client) {
    const { error } = await client.from("office_users").update(patch).eq("id", id);
    if (error) throw error;
  } else {
    const user = getStore().officeUsers.find((u) => u.id === id);
    if (user) Object.assign(user, patch);
  }
  logActivity({
    action: "Updated staff account",
    related_type: "office_user",
    related_id: id,
    actor_name: actorName,
    detail: `${before?.full_name ?? id}: ${JSON.stringify(patch)}`,
  });
}

// ---------------------------------------------------------------------
// STAFF SETUP CODE — the shared code staff enter (with their email) at
// /login → "Set up my password" to create their own password on first
// login, so onboarding needs no invite email and no per-person password
// relay. Stored on the companies row; demo mode keeps it in memory.
// ---------------------------------------------------------------------

let demoStaffSetupCode: string | null = "NOLAN2026";

export async function getStaffSetupCode(): Promise<string | null> {
  const client = sb();
  if (client) {
    const { data } = await client.from("companies").select("staff_setup_code").eq("id", getCurrentCompanyId()).maybeSingle();
    return (data?.staff_setup_code as string | null | undefined) ?? null;
  }
  return demoStaffSetupCode;
}

export async function setStaffSetupCode(code: string | null, actorName?: string): Promise<void> {
  const client = sb();
  if (client) {
    const { error } = await client.from("companies").update({ staff_setup_code: code }).eq("id", getCurrentCompanyId());
    if (error) throw error;
  } else {
    demoStaffSetupCode = code;
  }
  logActivity({ action: code ? "Changed the staff setup code" : "Cleared the staff setup code", actor_name: actorName });
}

/** Case-insensitive lookup by email — the username for real login. */
export async function getOfficeUserByEmail(email: string): Promise<OfficeUser | undefined> {
  const target = email.trim().toLowerCase();
  return (await listOfficeUsers()).find((u) => (u.email ?? "").trim().toLowerCase() === target);
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** True for a canonical UUID string — every id column in the real schema is
 * a Postgres `uuid`, which rejects anything else. Module-private: this is a
 * "use server" file, so every export must be an async Server Action. */
function isUuid(value: string): boolean {
  return UUID_RE.test(value);
}

export async function listSectionPermissions(officeUserId?: string): Promise<SectionPermission[]> {
  const client = sb();
  if (client) {
    // The acting-user sentinels ("owner", "no-matching-account") are not
    // UUIDs and never have rows — querying the uuid column with them would
    // error rather than return nothing.
    if (officeUserId && !isUuid(officeUserId)) return [];
    let query = client.from("section_permissions").select("*");
    if (officeUserId) query = query.eq("office_user_id", officeUserId);
    const { data, error } = await query;
    if (!error && data) return data as SectionPermission[];
  }
  const all = getStore().sectionPermissions;
  return officeUserId ? all.filter((p) => p.office_user_id === officeUserId) : [...all];
}

/**
 * Sets (creates or updates) one office_user's access level for one
 * section. Audit-logged with the old and new value via the existing
 * activity_log pattern (see README "Permissions & Staff Access" ->
 * "Audit logging").
 */
export async function setSectionPermission(
  officeUserId: string,
  sectionKey: SectionKey,
  accessLevel: SectionAccessLevel,
  actorName?: string
): Promise<void> {
  const existing = (await listSectionPermissions(officeUserId)).find((p) => p.section_key === sectionKey);
  const now = new Date().toISOString();
  const client = sb();
  if (client) {
    const { error } = await client
      .from("section_permissions")
      .upsert(
        {
          id: existing?.id ?? randomUUID(),
          company_id: getCurrentCompanyId(),
          office_user_id: officeUserId,
          section_key: sectionKey,
          access_level: accessLevel,
          updated_by: actorName,
          updated_at: now,
        },
        { onConflict: "office_user_id,section_key" }
      );
    if (error) throw error;
  } else {
    const store = getStore();
    if (existing) {
      existing.access_level = accessLevel;
      existing.updated_by = actorName;
      existing.updated_at = now;
    } else {
      store.sectionPermissions.push({
        id: randomUUID(),
        company_id: getCurrentCompanyId(),
        office_user_id: officeUserId,
        section_key: sectionKey,
        access_level: accessLevel,
        updated_by: actorName,
        updated_at: now,
      });
    }
  }
  const officeUser = await getOfficeUser(officeUserId);
  logActivity({
    action: "Changed section permission",
    related_type: "section_permission",
    related_id: officeUserId,
    actor_name: actorName,
    detail: `${officeUser?.full_name ?? officeUserId} — ${sectionKey}: ${existing?.access_level ?? "none"} → ${accessLevel}`,
  });
}

export async function listProjectWorkTypes(): Promise<ProjectWorkType[]> {
  const client = sb();
  if (client) {
    const { data, error } = await client.from("project_work_types").select("*");
    if (!error && data) return data as ProjectWorkType[];
  }
  return getStore().projectWorkTypes;
}

export async function listEmployees(): Promise<Employee[]> {
  const client = sb();
  if (client) {
    const { data, error } = await client.from("employees").select("*").order("first_name");
    if (!error && data) return data as Employee[];
  }
  return [...getStore().employees].sort((a, b) => a.first_name.localeCompare(b.first_name));
}

export async function getEmployee(id: string): Promise<Employee | undefined> {
  return (await listEmployees()).find((e) => e.id === id);
}

/**
 * Edits an existing employee's profile. Any change to pay_type/daily_rate/
 * hourly_rate is audit-logged to activity_log with old value, new value,
 * pay type and the acting user — per README "Labor Cost Tracking — Audit
 * Logging". This never touches already-saved actual_labor_entries rows
 * (they keep their own rate snapshot — see createActualLaborEntry below),
 * so historical job costs are unaffected by a rate change here.
 */
export async function updateEmployee(
  id: string,
  patch: Partial<Omit<Employee, "id" | "company_id" | "created_at">>,
  actorName: string
): Promise<void> {
  const before = (await listEmployees()).find((e) => e.id === id);
  if (!before) throw new Error("Employee not found");

  const client = sb();
  if (client) {
    const { error } = await client.from("employees").update(patch).eq("id", id);
    if (error) throw error;
  } else {
    Object.assign(before, patch);
  }

  const rateChanged =
    (patch.pay_type !== undefined && patch.pay_type !== before.pay_type) ||
    (patch.daily_rate !== undefined && patch.daily_rate !== before.daily_rate) ||
    (patch.hourly_rate !== undefined && patch.hourly_rate !== before.hourly_rate);

  if (rateChanged) {
    const oldRate = before.pay_type === "hourly" ? before.hourly_rate : before.daily_rate;
    const newPayType = patch.pay_type ?? before.pay_type;
    const newRate = newPayType === "hourly" ? patch.hourly_rate ?? before.hourly_rate : patch.daily_rate ?? before.daily_rate;
    logActivity({
      action: "Changed pay rate",
      related_type: "employee",
      related_id: id,
      actor_name: actorName,
      detail: `${before.first_name} ${before.last_name}: ${before.pay_type} $${oldRate ?? 0} → ${newPayType} $${newRate ?? 0}, effective ${new Date().toISOString().slice(0, 10)}`,
    });
  }

  // Vacation & Sick Day Tracker (build 7) — annual allowance change,
  // audited the same way as a pay-rate change above (see README).
  const allowanceChanged =
    (patch.vacation_days_allowed !== undefined && patch.vacation_days_allowed !== before.vacation_days_allowed) ||
    (patch.sick_days_allowed !== undefined && patch.sick_days_allowed !== before.sick_days_allowed);
  if (allowanceChanged) {
    const newVacation = patch.vacation_days_allowed ?? before.vacation_days_allowed;
    const newSick = patch.sick_days_allowed ?? before.sick_days_allowed;
    logActivity({
      action: "Changed time-off allowance",
      related_type: "employee",
      related_id: id,
      actor_name: actorName,
      detail: `${before.first_name} ${before.last_name}: vacation ${before.vacation_days_allowed ?? "—"} → ${newVacation ?? "—"} days/yr, sick ${before.sick_days_allowed ?? "—"} → ${newSick ?? "—"} days/yr`,
    });
  }
}

export async function listEmployeeSkills(): Promise<EmployeeSkill[]> {
  const client = sb();
  if (client) {
    const { data, error } = await client.from("employee_skills").select("*");
    if (!error && data) return data as EmployeeSkill[];
  }
  return getStore().employeeSkills;
}

export async function listEmployeeAvailability(): Promise<EmployeeAvailability[]> {
  const client = sb();
  if (client) {
    const { data, error } = await client.from("employee_availability").select("*");
    if (!error && data) return data as EmployeeAvailability[];
  }
  return getStore().employeeAvailability;
}

// ---------------------------------------------------------------------
// VACATION & SICK DAY TRACKER (build 7) — see
// supabase/migrations/0007_time_off.sql and README "Vacation & Sick Day
// Tracker". A simple day-off log, audit-logged the same way as everything
// else in this file (see logActivity() below). Not an accrual/balance
// system — see README.
// ---------------------------------------------------------------------

export async function listTimeOffEntries(): Promise<TimeOffEntry[]> {
  const client = sb();
  if (client) {
    const { data, error } = await client.from("time_off_entries").select("*").order("start_date", { ascending: false });
    if (!error && data) return data as TimeOffEntry[];
  }
  return [...getStore().timeOffEntries].sort((a, b) => (a.start_date < b.start_date ? 1 : -1));
}

export async function listTimeOffForEmployee(employeeId: string): Promise<TimeOffEntry[]> {
  return (await listTimeOffEntries()).filter((t) => t.employee_id === employeeId);
}

export async function createTimeOffEntry(input: {
  employee_id: string;
  start_date: string;
  end_date: string;
  type: TimeOffType;
  notes?: string;
  actorName: string;
}): Promise<TimeOffEntry> {
  const now = new Date().toISOString();
  const employee = (await listEmployees()).find((e) => e.id === input.employee_id);
  const record: TimeOffEntry = {
    id: randomUUID(),
    company_id: getCurrentCompanyId(),
    employee_id: input.employee_id,
    start_date: input.start_date,
    end_date: input.end_date,
    type: input.type,
    notes: input.notes,
    created_by: input.actorName,
    created_at: now,
    updated_by: input.actorName,
    updated_at: now,
  };
  const client = sb();
  if (client) {
    const { error } = await client.from("time_off_entries").insert(record);
    if (error) throw error;
  } else {
    getStore().timeOffEntries.push(record);
  }
  const range = record.start_date === record.end_date ? record.start_date : `${record.start_date} to ${record.end_date}`;
  logActivity({
    action: "Added time off",
    related_type: "employee",
    related_id: input.employee_id,
    actor_name: input.actorName,
    detail: `${employee ? `${employee.first_name} ${employee.last_name}` : input.employee_id} — ${input.type}, ${range}${input.notes ? ` (${input.notes})` : ""}`,
  });
  return record;
}

export async function updateTimeOffEntry(
  id: string,
  patch: { start_date?: string; end_date?: string; type?: TimeOffType; notes?: string },
  actorName: string
): Promise<void> {
  const now = new Date().toISOString();
  const client = sb();
  if (client) {
    const { error } = await client.from("time_off_entries").update({ ...patch, updated_by: actorName, updated_at: now }).eq("id", id);
    if (error) throw error;
  } else {
    const entry = getStore().timeOffEntries.find((t) => t.id === id);
    if (entry) Object.assign(entry, patch, { updated_by: actorName, updated_at: now });
  }
  logActivity({ action: "Edited time off entry", related_type: "employee", related_id: id, actor_name: actorName, detail: JSON.stringify(patch) });
}

export async function deleteTimeOffEntry(id: string, actorName: string): Promise<void> {
  const client = sb();
  const existing = (await listTimeOffEntries()).find((t) => t.id === id);
  if (client) {
    const { error } = await client.from("time_off_entries").delete().eq("id", id);
    if (error) throw error;
  } else {
    const store = getStore();
    const idx = store.timeOffEntries.findIndex((t) => t.id === id);
    if (idx >= 0) store.timeOffEntries.splice(idx, 1);
  }
  logActivity({
    action: "Deleted time off entry",
    related_type: "employee",
    related_id: existing?.employee_id,
    actor_name: actorName,
    detail: existing ? `${existing.type}, ${existing.start_date} to ${existing.end_date}` : id,
  });
}

/**
 * Permanently removes an employee. In Supabase the FKs cascade (skills,
 * availability, schedule assignments, actual-hours entries, time off) and
 * tasks assigned to them are unassigned. The in-memory store mirrors that.
 * For someone who has left but has job history worth keeping, prefer
 * marking them Inactive (updateEmployee { active: false }) instead.
 */
/** Replaces an employee's capability list. */
export async function setEmployeeSkills(employeeId: string, capabilities: StaffCapability[]): Promise<void> {
  const client = sb();
  if (client) {
    const { error } = await client.from("employee_skills").delete().eq("employee_id", employeeId);
    if (error) throw error;
    if (capabilities.length > 0) {
      const rows = capabilities.map((capability) => ({ id: randomUUID(), employee_id: employeeId, capability }));
      const { error: insErr } = await client.from("employee_skills").insert(rows);
      if (insErr) throw insErr;
    }
  } else {
    const store = getStore();
    store.employeeSkills = store.employeeSkills.filter((s) => s.employee_id !== employeeId);
    for (const capability of capabilities) store.employeeSkills.push({ id: randomUUID(), employee_id: employeeId, capability });
  }
}

export async function deleteEmployee(id: string, actorName: string): Promise<void> {
  const existing = (await listEmployees()).find((e) => e.id === id);
  if (!existing) return;
  const client = sb();
  if (client) {
    const { error } = await client.from("employees").delete().eq("id", id);
    if (error) throw error;
  } else {
    const store = getStore();
    store.employees = store.employees.filter((e) => e.id !== id);
    store.employeeSkills = store.employeeSkills.filter((s) => s.employee_id !== id);
    store.employeeAvailability = store.employeeAvailability.filter((a) => a.employee_id !== id);
    store.scheduleAssignments = store.scheduleAssignments.filter((a) => a.employee_id !== id);
    store.actualLaborEntries = store.actualLaborEntries.filter((a) => a.employee_id !== id);
    store.timeOffEntries = store.timeOffEntries.filter((t) => t.employee_id !== id);
    for (const t of store.tasks) if (t.assigned_to === id) t.assigned_to = undefined;
  }
  logActivity({
    action: "Deleted staff member",
    related_type: "employee",
    related_id: id,
    actor_name: actorName,
    detail: `${existing.first_name} ${existing.last_name}`,
  });
}

export async function listCrewRequirements(): Promise<ProjectCrewRequirement[]> {
  const client = sb();
  if (client) {
    const { data, error } = await client.from("project_crew_requirements").select("*");
    if (!error && data) return data as ProjectCrewRequirement[];
  }
  return getStore().projectCrewRequirements;
}

export async function listScheduleAssignments(): Promise<ScheduleAssignment[]> {
  const client = sb();
  if (client) {
    const { data, error } = await client.from("schedule_assignments").select("*");
    if (!error && data) return data as ScheduleAssignment[];
  }
  return getStore().scheduleAssignments;
}

export async function listMaterials(): Promise<Material[]> {
  const client = sb();
  if (client) {
    const { data, error } = await client.from("materials").select("*").order("name");
    if (!error && data) return data as Material[];
  }
  return [...getStore().materials].sort((a, b) => a.name.localeCompare(b.name));
}

export async function listProjectMaterials(): Promise<ProjectMaterial[]> {
  const client = sb();
  if (client) {
    const { data, error } = await client.from("project_materials").select("*");
    if (!error && data) return data as ProjectMaterial[];
  }
  return getStore().projectMaterials;
}

export async function listTasks(): Promise<Task[]> {
  const client = sb();
  if (client) {
    const { data, error } = await client.from("tasks").select("*").order("due_date");
    if (!error && data) return data as Task[];
  }
  return [...getStore().tasks].sort((a, b) => (a.due_date ?? "9999").localeCompare(b.due_date ?? "9999"));
}

export async function listCommunications(): Promise<Communication[]> {
  const client = sb();
  if (client) {
    const { data, error } = await client.from("communications").select("*").order("occurred_at", { ascending: false });
    if (!error && data) return data as Communication[];
  }
  return [...getStore().communications].sort((a, b) => (a.occurred_at < b.occurred_at ? 1 : -1));
}

export async function listProjectNotes(): Promise<ProjectNote[]> {
  const client = sb();
  if (client) {
    const { data, error } = await client.from("project_notes").select("*").order("created_at", { ascending: false });
    if (!error && data) return data as ProjectNote[];
  }
  return [...getStore().projectNotes].sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
}

export async function listDocuments(): Promise<DocumentRecord[]> {
  const client = sb();
  if (client) {
    const { data, error } = await client.from("documents").select("*");
    if (!error && data) return data as DocumentRecord[];
  }
  return getStore().documents;
}

export async function listPhotos(): Promise<PhotoRecord[]> {
  const client = sb();
  if (client) {
    const { data, error } = await client.from("photos").select("*");
    if (!error && data) return data as PhotoRecord[];
  }
  return getStore().photos;
}

export async function listLeads(): Promise<NewBusinessLead[]> {
  const client = sb();
  if (client) {
    const { data, error } = await client.from("new_business_leads").select("*").order("created_at", { ascending: false });
    if (!error && data) return data as NewBusinessLead[];
  }
  return [...getStore().newBusinessLeads].sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
}

export async function listActivityLog(): Promise<ActivityLogEntry[]> {
  const client = sb();
  if (client) {
    const { data, error } = await client.from("activity_log").select("*").order("created_at", { ascending: false });
    if (!error && data) return data as ActivityLogEntry[];
  }
  return [...getStore().activityLog].sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
}

export async function listCompanySetupAnswers(): Promise<CompanySetupAnswer[]> {
  const client = sb();
  if (client) {
    const { data, error } = await client.from("company_setup_answers").select("*");
    if (!error && data) return data as CompanySetupAnswer[];
  }
  return getStore().companySetupAnswers;
}

export async function getWeekStart(): Promise<string> {
  return getStore().weekStart;
}

// ---------------------------------------------------------------------
// SCHEDULE REDESIGN — work types, project schedule days, actual labor,
// daily confirmations (see supabase/migrations/0005_schedule_redesign.sql)
// ---------------------------------------------------------------------

export async function listWorkTypes(): Promise<WorkTypeRecord[]> {
  const client = sb();
  if (client) {
    const { data, error } = await client.from("work_types").select("*").order("name");
    if (!error && data) return data as WorkTypeRecord[];
  }
  return [...getStore().workTypes].sort((a, b) => a.name.localeCompare(b.name));
}

export async function createWorkType(name: string): Promise<WorkTypeRecord> {
  const record: WorkTypeRecord = {
    id: randomUUID(),
    company_id: getCurrentCompanyId(),
    name: name.trim(),
    active: true,
    created_at: new Date().toISOString(),
  };
  const client = sb();
  if (client) {
    const { error } = await client.from("work_types").insert(record);
    if (error) throw error;
  } else {
    getStore().workTypes.push(record);
  }
  logActivity({ action: "Added work type", detail: record.name });
  return record;
}

export async function updateWorkType(id: string, patch: { name?: string; active?: boolean }): Promise<void> {
  const client = sb();
  if (client) {
    const { error } = await client.from("work_types").update(patch).eq("id", id);
    if (error) throw error;
  } else {
    const wt = getStore().workTypes.find((w) => w.id === id);
    if (wt) Object.assign(wt, patch);
  }
  logActivity({ action: "Updated work type", detail: `${id}: ${JSON.stringify(patch)}` });
}

export async function listProjectScheduleDays(): Promise<ProjectScheduleDay[]> {
  const client = sb();
  if (client) {
    const { data, error } = await client.from("project_schedule_days").select("*");
    if (!error && data) return data as ProjectScheduleDay[];
  }
  return getStore().projectScheduleDays;
}

/** Finds the existing project_schedule_days row for a project+date, or
 * creates a sensible default one (Pink — "waiting/pending scheduling
 * progress" — until someone sets it) so every job/day row the Daily view
 * needs to render always has one to read and update. */
export async function getOrCreateProjectScheduleDay(projectId: string, date: string, actorName?: string): Promise<ProjectScheduleDay> {
  const existing = (await listProjectScheduleDays()).find((d) => d.project_id === projectId && d.schedule_date === date);
  if (existing) return existing;
  const now = new Date().toISOString();
  const record: ProjectScheduleDay = {
    id: randomUUID(),
    company_id: getCurrentCompanyId(),
    project_id: projectId,
    schedule_date: date,
    schedule_color: "Pink",
    coi_status: "Not Sent",
    materials_status: "Not Ordered",
    job_status: "Scheduled",
    created_by: actorName,
    updated_by: actorName,
    created_at: now,
    updated_at: now,
  };
  // A job stays on the schedule until Completed, so a new day row for an
  // already-scheduled job is a continuation: start it from the latest
  // earlier entry (color Blue → Gray, COI/materials/notes as they were)
  // and carry its crew, instead of blank defaults.
  const prior = (await listProjectScheduleDays())
    .filter((d) => d.project_id === projectId && d.schedule_date < date)
    .sort((a, b) => a.schedule_date.localeCompare(b.schedule_date))
    .at(-1);
  if (prior) {
    record.schedule_color = prior.schedule_color === "Blue" ? "Gray" : prior.schedule_color;
    record.coi_status = prior.coi_status;
    record.materials_status = prior.materials_status;
    record.work_type_id = prior.work_type_id;
    record.notes = prior.notes;
    record.sort_order = prior.sort_order ?? null;
  }
  const client = sb();
  let saved: ProjectScheduleDay = record;
  if (client) {
    const { data, error } = await client.from("project_schedule_days").insert(record).select().single();
    if (error) throw error;
    saved = data as ProjectScheduleDay;
  } else {
    getStore().projectScheduleDays.push(record);
  }
  if (prior) {
    const priorCrew = (await listScheduleAssignments()).filter((a) => a.project_id === projectId && a.schedule_date === prior.schedule_date);
    const already = new Set((await listScheduleAssignments()).filter((a) => a.project_id === projectId && a.schedule_date === date).map((a) => a.employee_id));
    for (const a of priorCrew) {
      if (already.has(a.employee_id)) continue;
      await createScheduleAssignment({
        project_id: projectId,
        employee_id: a.employee_id,
        schedule_date: date,
        role_on_job: a.role_on_job,
        time_and_half: false,
        call_time: a.call_time ?? undefined,
        actorName,
      });
    }
  }
  return saved;
}

/**
 * Takes a job off the schedule. `date` given → just that day's entry
 * (day row + its pickup items, that day's crew). No date → every day's
 * entries for the project, so it disappears from the schedule entirely
 * (the project itself is untouched). Logged to Change History.
 */
export async function removeProjectFromSchedule(projectId: string, date: string | undefined, actorName: string): Promise<void> {
  const [days, assignments] = await Promise.all([listProjectScheduleDays(), listScheduleAssignments()]);
  const dayIds = days.filter((d) => d.project_id === projectId && (!date || d.schedule_date === date)).map((d) => d.id);
  const assignmentIds = assignments.filter((a) => a.project_id === projectId && (!date || a.schedule_date === date)).map((a) => a.id);
  const client = sb();
  if (client) {
    if (assignmentIds.length) {
      const { error } = await client.from("schedule_assignments").delete().in("id", assignmentIds);
      if (error) throw error;
    }
    if (dayIds.length) {
      const { error } = await client.from("project_schedule_days").delete().in("id", dayIds);
      if (error) throw error;
    }
  } else {
    const store = getStore();
    const dayIdSet = new Set(dayIds);
    const asgIdSet = new Set(assignmentIds);
    store.scheduleAssignments = store.scheduleAssignments.filter((a) => !asgIdSet.has(a.id));
    store.schedulePickupItems = store.schedulePickupItems.filter((i) => !dayIdSet.has(i.project_schedule_day_id));
    store.projectScheduleDays = store.projectScheduleDays.filter((d) => !dayIdSet.has(d.id));
  }
  logActivity({
    action: "Removed from schedule",
    related_type: "project",
    related_id: projectId,
    actor_name: actorName,
    detail: date ? `Removed the ${date} entry` : `Removed every schedule entry (${dayIds.length} day${dayIds.length === 1 ? "" : "s"})`,
  });
}

/** Saves the drag order of a day's jobs: position within the list, per
 * project. Creates the day row for carried-over jobs so the order sticks. */
export async function setScheduleOrder(date: string, orderedProjectIds: string[], actorName: string): Promise<void> {
  const client = sb();
  for (const [index, projectId] of orderedProjectIds.entries()) {
    const day = await getOrCreateProjectScheduleDay(projectId, date, actorName);
    if (day.sort_order === index) continue;
    if (client) {
      const { error } = await client.from("project_schedule_days").update({ sort_order: index }).eq("id", day.id);
      if (error) throw error;
    } else {
      day.sort_order = index;
    }
  }
}

type ScheduleDayPatch = Partial<
  Pick<ProjectScheduleDay, "schedule_color" | "coi_status" | "materials_status" | "job_status" | "work_type_id" | "notes">
>;

/**
 * Updates one field set on a project_schedule_days row, audit-logging a
 * before/after entry via the existing activity_log for each changed field.
 * Setting `job_status` also writes through to the real
 * `projects.pipeline_stage` (see lib/schedule.ts mapJobStatusToPipelineStage)
 * — never an isolated duplicate status.
 */
/**
 * Cancel a job for one day: the day row stays (history), its status becomes
 * Cancelled, and every crew assignment + logged hours for that project/date
 * are removed so nobody is costed against a job that didn't happen. The
 * office reassigns those people elsewhere (or not) on the schedule.
 */
export async function cancelProjectScheduleDay(projectId: string, date: string, actorName: string): Promise<void> {
  const [day, assignments, entries, employees] = await Promise.all([
    getOrCreateProjectScheduleDay(projectId, date, actorName),
    listScheduleAssignments(),
    listActualLaborEntries(),
    listEmployees(),
  ]);
  const crew = assignments.filter((a) => a.project_id === projectId && a.schedule_date === date);
  const logged = entries.filter((e) => e.project_id === projectId && e.work_date === date);
  for (const a of crew) await deleteScheduleAssignment(a.id, actorName);
  for (const e of logged) await deleteActualLaborEntry(e.id, actorName);
  if (day.job_status !== "Cancelled") await updateProjectScheduleDay(day.id, { job_status: "Cancelled" }, actorName);
  const names = crew.map((a) => {
    const e = employees.find((x) => x.id === a.employee_id);
    return e ? `${e.first_name} ${e.last_name}` : a.employee_id;
  });
  logActivity({
    action: "Job cancelled for the day",
    related_type: "project",
    related_id: projectId,
    actor_name: actorName,
    detail: `${date}: cancelled${names.length ? ` — crew freed up: ${names.join(", ")}` : " — no crew was assigned"}${logged.length ? `; ${logged.length} logged hours entr${logged.length === 1 ? "y" : "ies"} removed` : ""}`,
  });
}

export async function updateProjectScheduleDay(id: string, patch: ScheduleDayPatch, actorName: string): Promise<ProjectScheduleDay> {
  const rows = await listProjectScheduleDays();
  const before = rows.find((d) => d.id === id);
  if (!before) throw new Error("Schedule day entry not found");
  const now = new Date().toISOString();
  const fullPatch = { ...patch, updated_by: actorName, updated_at: now };

  const client = sb();
  if (client) {
    const { error } = await client.from("project_schedule_days").update(fullPatch).eq("id", id);
    if (error) throw error;
  } else {
    Object.assign(before, fullPatch);
  }

  const fieldLabels: Record<string, string> = {
    schedule_color: "Schedule color",
    coi_status: "COI status",
    materials_status: "Materials status",
    job_status: "Job status",
    work_type_id: "Work type",
    notes: "Notes",
  };
  for (const [field, newValue] of Object.entries(patch)) {
    const label = fieldLabels[field] ?? field;
    logActivity({
      action: `${label} changed`,
      related_type: "project",
      related_id: before.project_id,
      actor_name: actorName,
      detail: `${before.schedule_date}: ${label} changed to "${newValue}"`,
    });
  }

  if (patch.job_status && patch.job_status !== "Cancelled") {
    await updateProjectPipelineStage(before.project_id, mapJobStatusToPipelineStage(patch.job_status));
  }

  return client ? { ...before, ...fullPatch } as ProjectScheduleDay : before;
}

// ---------------------------------------------------------------------
// SCHEDULE PICKUP ITEMS — "Items to Order / Collect" (build 8). A
// lightweight per-schedule-day checklist, deliberately separate from the
// heavier project_materials system. See lib/types.ts SchedulePickupItem /
// README for the full write-up.
// ---------------------------------------------------------------------

export async function listSchedulePickupItems(): Promise<SchedulePickupItem[]> {
  const client = sb();
  if (client) {
    const { data, error } = await client.from("schedule_pickup_items").select("*").order("created_at");
    if (!error && data) return data as SchedulePickupItem[];
  }
  return getStore().schedulePickupItems;
}

export async function listSchedulePickupItemsForDay(projectScheduleDayId: string): Promise<SchedulePickupItem[]> {
  return (await listSchedulePickupItems()).filter((i) => i.project_schedule_day_id === projectScheduleDayId);
}

/** Sets/clears the price on a pickup item (from the project page). */
export async function setSchedulePickupItemCost(id: string, cost: number | null, actorName: string): Promise<void> {
  const now = new Date().toISOString();
  const client = sb();
  if (client) {
    const { error } = await client.from("schedule_pickup_items").update({ cost, updated_by: actorName, updated_at: now }).eq("id", id);
    if (error) throw error;
  } else {
    const item = getStore().schedulePickupItems.find((i) => i.id === id);
    if (item) Object.assign(item, { cost, updated_by: actorName, updated_at: now });
  }
}

export async function createSchedulePickupItem(input: {
  project_schedule_day_id: string;
  description: string;
  actorName: string;
}): Promise<SchedulePickupItem> {
  const now = new Date().toISOString();
  const record: SchedulePickupItem = {
    id: randomUUID(),
    company_id: getCurrentCompanyId(),
    project_schedule_day_id: input.project_schedule_day_id,
    description: input.description,
    status: "Needed",
    created_by: input.actorName,
    updated_by: input.actorName,
    created_at: now,
    updated_at: now,
  };
  const client = sb();
  if (client) {
    const { error } = await client.from("schedule_pickup_items").insert(record);
    if (error) throw error;
  } else {
    getStore().schedulePickupItems.push(record);
  }
  const day = (await listProjectScheduleDays()).find((d) => d.id === input.project_schedule_day_id);
  logActivity({
    action: "Added pickup item",
    related_type: "project",
    related_id: day?.project_id,
    actor_name: input.actorName,
    detail: `${input.description}${day ? ` (${day.schedule_date})` : ""}`,
  });
  return record;
}

/** Flips a pickup item between Needed and Collected — the checkbox-equivalent
 * toggle, only ever done from Create/Edit Schedule (never from the
 * read-only View Schedule, same convention as every other schedule field). */
/** The Materials line that mirrors a schedule pickup item, if any. */
async function materialForPickup(pickupItemId: string): Promise<ProjectMaterial | undefined> {
  return (await listProjectMaterials()).find((m) => m.pickup_item_id === pickupItemId);
}

/** Creates the Materials line for a pickup item (no price yet). */
export async function ensureMaterialForPickup(item: SchedulePickupItem, projectId: string): Promise<void> {
  if (await materialForPickup(item.id)) return;
  await createProjectMaterial({
    project_id: projectId,
    description: item.description,
    quantity: 1,
    unit: "unit",
    unit_price: null,
    cost: 0,
    status: item.status === "Collected" ? "Delivered" : "Needed",
    notes: "From the schedule (item to collect)",
    pickup_item_id: item.id,
  });
}

export async function toggleSchedulePickupItemStatus(id: string, actorName: string): Promise<SchedulePickupItem | undefined> {
  const items = await listSchedulePickupItems();
  const existing = items.find((i) => i.id === id);
  if (!existing) return undefined;
  const nextStatus: SchedulePickupStatus = existing.status === "Needed" ? "Collected" : "Needed";
  const now = new Date().toISOString();
  const client = sb();
  if (client) {
    const { error } = await client.from("schedule_pickup_items").update({ status: nextStatus, updated_at: now }).eq("id", id);
    if (error) throw error;
  } else {
    Object.assign(existing, { status: nextStatus, updated_at: now });
  }
  const day = (await listProjectScheduleDays()).find((d) => d.id === existing.project_schedule_day_id);
  logActivity({
    action: nextStatus === "Collected" ? "Marked pickup item collected" : "Marked pickup item needed",
    related_type: "project",
    related_id: day?.project_id,
    actor_name: actorName,
    detail: existing.description,
  });
  return { ...existing, status: nextStatus, updated_at: now };
}

export async function deleteSchedulePickupItem(id: string, actorName: string): Promise<void> {
  const items = await listSchedulePickupItems();
  const existing = items.find((i) => i.id === id);
  const mirrored = await materialForPickup(id);
  if (mirrored && !mirrored.cost) await deleteProjectMaterial(mirrored.id);
  const client = sb();
  if (client) {
    const { error } = await client.from("schedule_pickup_items").delete().eq("id", id);
    if (error) throw error;
  } else {
    const store = getStore();
    const idx = store.schedulePickupItems.findIndex((i) => i.id === id);
    if (idx >= 0) store.schedulePickupItems.splice(idx, 1);
  }
  const day = existing ? (await listProjectScheduleDays()).find((d) => d.id === existing.project_schedule_day_id) : undefined;
  logActivity({
    action: "Removed pickup item",
    related_type: "project",
    related_id: day?.project_id,
    actor_name: actorName,
    detail: existing?.description ?? id,
  });
}

export async function listActualLaborEntries(): Promise<ActualLaborEntry[]> {
  const client = sb();
  if (client) {
    const { data, error } = await client.from("actual_labor_entries").select("*");
    if (!error && data) return data as ActualLaborEntry[];
  }
  return getStore().actualLaborEntries;
}

export async function createActualLaborEntry(input: {
  employee_id: string;
  project_id: string;
  work_date: string;
  hours: number;
  start_time?: string;
  end_time?: string;
  notes?: string;
  actorName: string;
}): Promise<ActualLaborEntry> {
  const now = new Date().toISOString();
  // HISTORICAL PAY RATE ACCURACY: snapshot the employee's CURRENT
  // pay_type/rate onto this entry at the moment it's saved. Later rate
  // changes on the employee's profile never touch this row, so this
  // entry's cost (see lib/labor-cost.ts) stays fixed forever.
  const employee = (await listEmployees()).find((e) => e.id === input.employee_id);
  const record: ActualLaborEntry = {
    id: randomUUID(),
    company_id: getCurrentCompanyId(),
    employee_id: input.employee_id,
    project_id: input.project_id,
    work_date: input.work_date,
    hours: input.hours,
    start_time: input.start_time,
    end_time: input.end_time,
    notes: input.notes,
    rate_type: employee?.pay_type,
    rate_amount: employee ? (employee.pay_type === "hourly" ? employee.hourly_rate : employee.daily_rate) : undefined,
    created_by: input.actorName,
    updated_by: input.actorName,
    created_at: now,
    updated_at: now,
  };
  const client = sb();
  if (client) {
    const { error } = await client.from("actual_labor_entries").insert(record);
    if (error) throw error;
  } else {
    getStore().actualLaborEntries.push(record);
  }
  logActivity({
    action: "Logged actual hours",
    related_type: "employee",
    related_id: input.employee_id,
    actor_name: input.actorName,
    detail: `${employee ? `${employee.first_name} ${employee.last_name}` : input.employee_id} — ${input.hours} hrs on ${input.work_date} (project ${input.project_id})`,
  });
  return record;
}

export async function updateActualLaborEntry(
  id: string,
  patch: { hours?: number; start_time?: string; end_time?: string; notes?: string },
  actorName: string
): Promise<void> {
  const now = new Date().toISOString();
  const client = sb();
  if (client) {
    const { error } = await client.from("actual_labor_entries").update({ ...patch, updated_by: actorName, updated_at: now }).eq("id", id);
    if (error) throw error;
  } else {
    const entry = getStore().actualLaborEntries.find((e) => e.id === id);
    if (entry) Object.assign(entry, patch, { updated_by: actorName, updated_at: now });
  }
  logActivity({ action: "Edited actual hours entry", related_type: "employee", related_id: id, actor_name: actorName, detail: JSON.stringify(patch) });
}

export async function deleteActualLaborEntry(id: string, actorName: string): Promise<void> {
  const client = sb();
  if (client) {
    const { error } = await client.from("actual_labor_entries").delete().eq("id", id);
    if (error) throw error;
  } else {
    const store = getStore();
    const idx = store.actualLaborEntries.findIndex((e) => e.id === id);
    if (idx >= 0) store.actualLaborEntries.splice(idx, 1);
  }
  logActivity({ action: "Deleted actual hours entry", actor_name: actorName, detail: id });
}

export async function listDailyScheduleConfirmations(): Promise<DailyScheduleConfirmation[]> {
  const client = sb();
  if (client) {
    const { data, error } = await client.from("daily_schedule_confirmations").select("*");
    if (!error && data) return data as DailyScheduleConfirmation[];
  }
  return getStore().dailyScheduleConfirmations;
}

/** "Confirm Day" from the End-of-Day Review — upsert-style, one row per
 * (company, work_date). Does NOT lock the day; re-confirming just updates
 * confirmed_by/confirmed_at, itself audit-logged like any other change. */
export async function confirmDay(workDate: string, actorName: string, notes?: string): Promise<DailyScheduleConfirmation> {
  const now = new Date().toISOString();
  const client = sb();
  if (client) {
    const { data, error } = await client
      .from("daily_schedule_confirmations")
      .upsert(
        { company_id: getCurrentCompanyId(), work_date: workDate, confirmed_by: actorName, confirmed_at: now, notes },
        { onConflict: "company_id,work_date" }
      )
      .select()
      .single();
    if (error) throw error;
    logActivity({ action: "Confirmed day", actor_name: actorName, detail: `Schedule confirmed for ${workDate}${notes ? ` — ${notes}` : ""}` });
    return data as DailyScheduleConfirmation;
  }
  const store = getStore();
  const existing = store.dailyScheduleConfirmations.find((c) => c.work_date === workDate);
  if (existing) {
    existing.confirmed_by = actorName;
    existing.confirmed_at = now;
    existing.notes = notes;
    logActivity({ action: "Confirmed day", actor_name: actorName, detail: `Schedule confirmed for ${workDate}${notes ? ` — ${notes}` : ""}` });
    return existing;
  }
  const record: DailyScheduleConfirmation = { id: randomUUID(), company_id: getCurrentCompanyId(), work_date: workDate, confirmed_by: actorName, confirmed_at: now, notes };
  store.dailyScheduleConfirmations.push(record);
  logActivity({ action: "Confirmed day", actor_name: actorName, detail: `Schedule confirmed for ${workDate}${notes ? ` — ${notes}` : ""}` });
  return record;
}

/** The editable "completion notes" field on a Completed Job Summary — the
 * one manually-entered field, everything else on the summary is computed.
 * Reuses the existing project_notes table with a marker author_name so no
 * new schema is needed; the latest such note is treated as "the" field. */
export async function getCompletionNotes(projectId: string): Promise<string | undefined> {
  const notes = await listProjectNotes();
  return notes.find((n) => n.project_id === projectId && n.author_name === "Completion Notes")?.body;
}

export async function saveCompletionNotes(projectId: string, body: string, actorName: string): Promise<void> {
  await createProjectNote({ project_id: projectId, author_name: "Completion Notes", body });
  logActivity({ action: "Updated completion notes", related_type: "project", related_id: projectId, actor_name: actorName });
}

// ---------------------------------------------------------------------
// PRICING & ESTIMATING FORMULAS
// ---------------------------------------------------------------------

export async function listMaterialRateItems(): Promise<MaterialRateItem[]> {
  const client = sb();
  if (client) {
    const { data, error } = await client.from("material_rate_items").select("*").order("name");
    if (!error && data) return data as MaterialRateItem[];
  }
  return [...getStore().materialRateItems].sort((a, b) => a.name.localeCompare(b.name));
}

export async function listPricingFormulas(): Promise<PricingFormula[]> {
  const client = sb();
  if (client) {
    const { data, error } = await client.from("pricing_formulas").select("*").order("name");
    if (!error && data) return data as PricingFormula[];
  }
  return [...getStore().pricingFormulas].sort((a, b) => a.name.localeCompare(b.name));
}

export async function getPricingFormula(id: string): Promise<PricingFormula | undefined> {
  return (await listPricingFormulas()).find((f) => f.id === id);
}

export async function listPricingFormulaComponents(): Promise<PricingFormulaComponent[]> {
  const client = sb();
  if (client) {
    const { data, error } = await client.from("pricing_formula_components").select("*");
    if (!error && data) return data as PricingFormulaComponent[];
  }
  return getStore().pricingFormulaComponents;
}

export async function createMaterialRateItem(
  input: Omit<MaterialRateItem, "id" | "company_id" | "created_at" | "active"> & { active?: boolean }
): Promise<MaterialRateItem> {
  const record: MaterialRateItem = {
    id: randomUUID(),
    company_id: getCurrentCompanyId(),
    active: input.active ?? true,
    created_at: new Date().toISOString(),
    ...input,
  };
  const client = sb();
  if (client) {
    const { error } = await client.from("material_rate_items").insert(record);
    if (error) throw error;
  } else {
    getStore().materialRateItems.push(record);
  }
  logActivity({ action: "Added material rate item", detail: `${record.name} — ${record.unit_cost}/${record.unit}` });
  return record;
}

export async function createPricingFormula(
  input: Omit<PricingFormula, "id" | "company_id" | "created_at" | "active"> & { active?: boolean }
): Promise<PricingFormula> {
  const record: PricingFormula = {
    id: randomUUID(),
    company_id: getCurrentCompanyId(),
    active: input.active ?? true,
    created_at: new Date().toISOString(),
    ...input,
  };
  const client = sb();
  if (client) {
    const { error } = await client.from("pricing_formulas").insert(record);
    if (error) throw error;
  } else {
    getStore().pricingFormulas.push(record);
  }
  logActivity({ action: "Added pricing formula", detail: `${record.name} (${record.work_type})` });
  return record;
}

export async function addPricingFormulaComponent(input: {
  formula_id: string;
  material_rate_item_id: string;
  quantity_per_unit_area: number;
  notes?: string;
}): Promise<PricingFormulaComponent> {
  const record: PricingFormulaComponent = {
    id: randomUUID(),
    company_id: getCurrentCompanyId(),
    created_at: new Date().toISOString(),
    ...input,
  };
  const client = sb();
  if (client) {
    const { error } = await client.from("pricing_formula_components").insert(record);
    if (error) throw error;
  } else {
    getStore().pricingFormulaComponents.push(record);
  }
  return record;
}

export async function removePricingFormulaComponent(id: string): Promise<void> {
  const client = sb();
  if (client) {
    const { error } = await client.from("pricing_formula_components").delete().eq("id", id);
    if (error) throw error;
  } else {
    const store = getStore();
    const idx = store.pricingFormulaComponents.findIndex((c) => c.id === id);
    if (idx >= 0) store.pricingFormulaComponents.splice(idx, 1);
  }
}

/** Saves a computed suggested price onto a job request's `estimated_value`
 * (kept separate from `estimate_amount`, the amount actually sent to the
 * client — see lib/types.ts). Used by the Estimate Calculator. */
export async function saveJobRequestEstimatedValue(id: string, value: number): Promise<void> {
  const client = sb();
  const now = new Date().toISOString();
  if (client) {
    const { error } = await client.from("job_requests").update({ estimated_value: value, updated_at: now }).eq("id", id);
    if (error) throw error;
  } else {
    const jr = getStore().jobRequests.find((j) => j.id === id);
    if (jr) {
      jr.estimated_value = value;
      jr.updated_at = now;
    }
  }
  logActivity({ action: "Saved calculator estimate to job request", related_type: "job_request", related_id: id, detail: `${value}` });
}

/** Saves a computed suggested price onto a project's `project_value`. */
export async function saveProjectEstimatedValue(id: string, value: number): Promise<void> {
  const client = sb();
  const now = new Date().toISOString();
  if (client) {
    const { error } = await client.from("projects").update({ project_value: value, updated_at: now }).eq("id", id);
    if (error) throw error;
  } else {
    const project = getStore().projects.find((p) => p.id === id);
    if (project) {
      project.project_value = value;
      project.updated_at = now;
    }
  }
  logActivity({ action: "Saved calculator estimate to project value", related_type: "project", related_id: id, detail: `${value}` });
}

// ---------------------------------------------------------------------
// INVOICES & EMAIL ROUTING RULES
// ---------------------------------------------------------------------

export async function listInvoices(): Promise<Invoice[]> {
  const client = sb();
  if (client) {
    const { data, error } = await client.from("invoices").select("*").order("created_at", { ascending: false });
    if (!error && data) return data as Invoice[];
  }
  return [...getStore().invoices].sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
}

export async function createInvoice(
  input: Omit<Invoice, "id" | "company_id" | "created_at" | "status" | "source"> & {
    status?: InvoiceStatus;
    source?: Invoice["source"];
  }
): Promise<Invoice> {
  const record: Invoice = {
    id: randomUUID(),
    company_id: getCurrentCompanyId(),
    status: input.status ?? "Needed",
    source: input.source ?? "Manual Entry",
    created_at: new Date().toISOString(),
    ...input,
  };
  const client = sb();
  if (client) {
    const { error } = await client.from("invoices").insert(record);
    if (error) throw error;
  } else {
    getStore().invoices.unshift(record);
  }
  logActivity({ action: "Added invoice", detail: `${record.supplier}${record.amount != null ? ` — $${record.amount}` : ""}` });
  return record;
}

export async function setInvoiceFileReference(id: string, fileReference: string | undefined): Promise<void> {
  const client = sb();
  if (client) {
    const { error } = await client.from("invoices").update({ file_reference: fileReference }).eq("id", id);
    if (error) throw error;
  } else {
    const invoice = getStore().invoices.find((i) => i.id === id);
    if (invoice) invoice.file_reference = fileReference;
  }
}

export async function updateInvoiceStatus(id: string, status: InvoiceStatus): Promise<void> {
  const client = sb();
  if (client) {
    const { error } = await client.from("invoices").update({ status }).eq("id", id);
    if (error) throw error;
  } else {
    const invoice = getStore().invoices.find((i) => i.id === id);
    if (invoice) invoice.status = status;
  }
  logActivity({ action: `Invoice marked ${status}`, related_id: id });
}

export async function listEmailRoutingRules(): Promise<EmailRoutingRule[]> {
  const client = sb();
  if (client) {
    const { data, error } = await client.from("email_routing_rules").select("*").order("created_at");
    if (!error && data) return data as EmailRoutingRule[];
  }
  return [...getStore().emailRoutingRules].sort((a, b) => (a.created_at < b.created_at ? -1 : 1));
}

export async function createEmailRoutingRule(
  input: Omit<EmailRoutingRule, "id" | "company_id" | "created_at" | "active"> & { active?: boolean }
): Promise<EmailRoutingRule> {
  const record: EmailRoutingRule = {
    id: randomUUID(),
    company_id: getCurrentCompanyId(),
    active: input.active ?? true,
    created_at: new Date().toISOString(),
    ...input,
  };
  const client = sb();
  if (client) {
    const { error } = await client.from("email_routing_rules").insert(record);
    if (error) throw error;
  } else {
    getStore().emailRoutingRules.push(record);
  }
  logActivity({ action: "Added email routing rule", detail: `"${record.keyword}" → ${record.action_type}` });
  return record;
}

export async function setEmailRoutingRuleActive(id: string, active: boolean): Promise<void> {
  const client = sb();
  if (client) {
    const { error } = await client.from("email_routing_rules").update({ active }).eq("id", id);
    if (error) throw error;
  } else {
    const rule = getStore().emailRoutingRules.find((r) => r.id === id);
    if (rule) rule.active = active;
  }
}

// ---------------------------------------------------------------------
// WRITES
// ---------------------------------------------------------------------

function logActivity(entry: Omit<ActivityLogEntry, "id" | "company_id" | "created_at">) {
  const record: ActivityLogEntry = {
    id: randomUUID(),
    company_id: getCurrentCompanyId(),
    created_at: new Date().toISOString(),
    ...entry,
  };
  const client = sb();
  if (client) {
    // Fire-and-forget from the caller's perspective — every write path
    // above already returns void/void-ish, and a logging failure should
    // never block the underlying write it's describing.
    void client.from("activity_log").insert(record).then(({ error }) => {
      if (error) getStore().activityLog.unshift(record);
    });
  } else {
    getStore().activityLog.unshift(record);
  }
}

/** Logs a "Create Anyway" override on the New Job Request duplicate-bid
 * warning, so it counts toward the future "duplicate attempts prevented"
 * report (see README). */
export async function logDuplicateBidOverride(jobRequestId: string, reason: string, matches: DuplicateBidMatch[], actorName?: string): Promise<void> {
  const summary = matches
    .map((m) => `${m.type === "project" ? "Project" : "Job request"} ${m.id} (${m.status}${m.estimatorName ? `, claimed by ${m.estimatorName}` : ""})`)
    .join("; ");
  logActivity({
    action: "Duplicate bid override — created anyway",
    related_type: "job_request",
    related_id: jobRequestId,
    actor_name: actorName,
    detail: `Possible duplicate against: ${summary}. Reason given: "${reason}"`,
  });
}

export async function createJobRequest(input: {
  building_id: string;
  contact_id?: string;
  unit_number?: string;
  description: string;
  received_via?: string;
}): Promise<JobRequest> {
  const client = sb();
  const now = new Date().toISOString();
  const record: JobRequest = {
    id: randomUUID(),
    company_id: getCurrentCompanyId(),
    building_id: input.building_id,
    contact_id: input.contact_id,
    unit_number: input.unit_number,
    description: input.description,
    status: "New Request",
    received_via: input.received_via ?? "phone",
    received_at: now,
    created_at: now,
    updated_at: now,
  };
  if (client) {
    const { error } = await client.from("job_requests").insert(record);
    if (error) throw error;
  } else {
    getStore().jobRequests.unshift(record);
  }
  logActivity({ action: "Created job request", related_type: "job_request", related_id: record.id, detail: input.description });
  return record;
}

/** "Start job": marks the request In Progress under the acting user. */
export async function startJobRequest(id: string, userId: string, userName: string): Promise<void> {
  const now = new Date().toISOString();
  const patch = { status: "In Progress" as JobRequestStatus, started_by_user_id: userId, started_by_name: userName, started_at: now, updated_at: now };
  const client = sb();
  if (client) {
    const { error } = await client.from("job_requests").update(patch).eq("id", id);
    if (error) throw error;
  } else {
    const jr = getStore().jobRequests.find((j) => j.id === id);
    if (jr) Object.assign(jr, patch);
  }
  logActivity({ action: "Started job request", related_type: "job_request", related_id: id, actor_name: userName, detail: `${userName} is working on it` });
}

export async function deleteJobRequest(id: string, actorName: string): Promise<void> {
  const existing = (await listJobRequests()).find((j) => j.id === id);
  const client = sb();
  if (client) {
    const { error } = await client.from("job_requests").delete().eq("id", id);
    if (error) throw error;
  } else {
    const store = getStore();
    store.jobRequests = store.jobRequests.filter((j) => j.id !== id);
  }
  logActivity({ action: "Deleted job request", related_type: "job_request", related_id: id, actor_name: actorName, detail: existing?.description ?? id });
}

export async function updateJobRequestStatus(id: string, status: JobRequestStatus): Promise<void> {
  const client = sb();
  const now = new Date().toISOString();
  if (client) {
    const { error } = await client.from("job_requests").update({ status, updated_at: now }).eq("id", id);
    if (error) throw error;
  } else {
    const jr = getStore().jobRequests.find((j) => j.id === id);
    if (jr) {
      jr.status = status;
      jr.updated_at = now;
    }
  }
  logActivity({ action: `Job request status changed to ${status}`, related_type: "job_request", related_id: id });
}

/**
 * Creates the project row for a job request exactly once — every later
 * lifecycle change (claiming the bid, sending it, scheduling, sending to
 * crew, starting/completing the work) updates this SAME row via the
 * functions below; nothing here ever inserts a second project for the
 * same job request.
 */
async function insertProjectFromJobRequest(
  jr: JobRequest,
  overrides: Partial<Pick<Project, "name" | "project_value" | "start_date" | "target_end_date" | "needs_transportation">> | undefined,
  initialStage: PipelineStage,
  initialBidStatus: BidStatus
): Promise<Project> {
  const store = getStore();
  const building = (await listBuildings()).find((b) => b.id === jr.building_id);
  const now = new Date().toISOString();
  const project: Project = {
    id: randomUUID(),
    company_id: getCurrentCompanyId(),
    building_id: jr.building_id,
    job_request_id: jr.id,
    unit_number: jr.unit_number,
    name: overrides?.name ?? `${building?.name ?? "Building"}${jr.unit_number ? " — Unit " + jr.unit_number : ""}`,
    description: jr.description,
    project_value: overrides?.project_value ?? jr.estimate_amount ?? 0,
    other_cost: 0,
    needs_transportation: overrides?.needs_transportation ?? true,
    start_date: overrides?.start_date,
    target_end_date: overrides?.target_end_date,
    notes: jr.notes,
    created_at: now,
    updated_at: now,
    pipeline_stage: initialStage,
    bid_status: initialBidStatus,
    bid_accepted_at: initialBidStatus === "Accepted" ? now : undefined,
  };
  const client = sb();
  if (client) {
    const { error } = await client.from("projects").insert(project);
    if (error) throw error;
    await client.from("job_requests").update({ status: "Converted to Project", converted_project_id: project.id, updated_at: now }).eq("id", jr.id);
  } else {
    store.projects.push(project);
    jr.status = "Converted to Project";
    jr.converted_project_id = project.id;
    jr.updated_at = now;
  }
  return project;
}

/**
 * "Quick Job" — for the small one-day turnarounds that never go through a
 * job request or a bid. Creates the same project row every other path
 * creates, but lands it straight in pipeline_stage "Scheduled" so it can
 * be put on the schedule immediately. Everything else (value, materials,
 * photos…) can be filled in on the project page later if it matters.
 */
export async function createQuickProject(input: {
  building_id: string;
  unit_number?: string;
  description: string;
  start_date: string;
  actorName: string;
}): Promise<Project> {
  const building = (await listBuildings()).find((b) => b.id === input.building_id);
  const now = new Date().toISOString();
  const project: Project = {
    id: randomUUID(),
    company_id: getCurrentCompanyId(),
    building_id: input.building_id,
    unit_number: input.unit_number || undefined,
    name: `${building?.name ?? "Building"}${input.unit_number ? " — Unit " + input.unit_number : ""}`,
    description: input.description,
    project_value: 0,
    other_cost: 0,
    needs_transportation: true,
    start_date: input.start_date,
    created_at: now,
    updated_at: now,
    pipeline_stage: "Scheduled",
    bid_status: "Accepted",
    bid_accepted_at: now,
    scheduled_at: now,
  };
  const client = sb();
  if (client) {
    const { error } = await client.from("projects").insert(project);
    if (error) throw error;
  } else {
    getStore().projects.push(project);
  }
  logActivity({ action: "Created quick job", related_type: "project", related_id: project.id, actor_name: input.actorName, detail: `${project.name} — ${input.description}` });
  return project;
}

/**
 * "Convert to Project" — used from an already-approved/ready job request.
 * The bid is treated as already accepted (that approval happened at the
 * job-request stage), so the new project row starts at pipeline_stage
 * "Bid Accepted" with bid_status "Accepted".
 */
export async function convertJobRequestToProject(
  jobRequestId: string,
  overrides?: Partial<Pick<Project, "name" | "project_value" | "start_date" | "target_end_date" | "needs_transportation">>
): Promise<Project> {
  const jr = (await listJobRequests()).find((j) => j.id === jobRequestId);
  if (!jr) throw new Error("Job request not found");
  const project = await insertProjectFromJobRequest(jr, overrides, "Bid Accepted", "Accepted");
  logActivity({ action: "Converted job request to project", related_type: "project", related_id: project.id, detail: `From job request ${jobRequestId} — bid accepted` });
  return project;
}

/**
 * "Create Bid" — used from an earlier-stage job request that still needs
 * to be estimated. Creates the SAME kind of project row, but starts it
 * unclaimed at pipeline_stage "Bid Sent" so it shows up on the Bid
 * Dashboard for an estimator to claim.
 */
export async function createBidFromJobRequest(jobRequestId: string): Promise<Project> {
  const jr = (await listJobRequests()).find((j) => j.id === jobRequestId);
  if (!jr) throw new Error("Job request not found");
  const project = await insertProjectFromJobRequest(jr, undefined, "Bid Sent", "Unclaimed");
  logActivity({ action: "Created bid", related_type: "project", related_id: project.id, detail: `From job request ${jobRequestId} — unclaimed, awaiting an estimator` });
  return project;
}

// ---------------------------------------------------------------------
// BID WORKFLOW: pipeline stage, bid status, atomic claiming, reassignment
// ---------------------------------------------------------------------

// Which set-once lifecycle timestamp column a pipeline_stage transition
// stamps, the first time a project reaches it. Never overwritten on a
// later re-visit (e.g. moving back and forth), which is what keeps these
// columns usable for future turnaround/duration reporting.
// NOTE: `sent_to_crew_at` is kept as a column (harmless, unused going
// forward) since "Sent to Crew" was merged into "In Progress" in the
// 5-stage simplification — see README "Project Pipeline Stage
// Simplification".
const STAGE_TIMESTAMP_FIELD: Partial<Record<PipelineStage, keyof Project>> = {
  Scheduled: "scheduled_at",
  "In Progress": "project_started_at",
  Complete: "project_completed_at",
};

// Same idea for bid_status transitions.
const BID_STATUS_TIMESTAMP_FIELD: Partial<Record<BidStatus, keyof Project>> = {
  "Ready for Review": "bid_completed_at",
  "Completed/Sent": "bid_sent_at",
  Accepted: "bid_accepted_at",
};

function stampOnce(project: Project, field: keyof Project, iso: string) {
  if (!project[field]) (project as unknown as Record<string, unknown>)[field] = iso;
}

export async function setProjectInvoiceSent(id: string, sent: boolean, actorName: string): Promise<void> {
  const now = new Date().toISOString();
  const patch = { invoice_sent_at: sent ? now : null, invoice_sent_by: sent ? actorName : null, updated_at: now };
  const client = sb();
  if (client) {
    const { error } = await client.from("projects").update(patch).eq("id", id);
    if (error) throw error;
  } else {
    const project = getStore().projects.find((p) => p.id === id);
    if (project) Object.assign(project, patch);
  }
  logActivity({ action: sent ? "Invoice sent" : "Invoice marked not sent", related_type: "project", related_id: id, actor_name: actorName });
}

export async function updateProjectName(id: string, name: string, actorName: string): Promise<void> {
  const project = (await listProjects()).find((p) => p.id === id);
  if (!project) throw new Error("Project not found");
  const now = new Date().toISOString();
  const client = sb();
  if (client) {
    const { error } = await client.from("projects").update({ name, updated_at: now }).eq("id", id);
    if (error) throw error;
  } else {
    Object.assign(project, { name, updated_at: now });
  }
  logActivity({ action: "Job renamed", related_type: "project", related_id: id, actor_name: actorName, detail: `"${project.name}" → "${name}"` });
}

/** Edits a project's unit number (and refreshes the auto name if it was
 * the default "Building — Unit X" form). Logged for the audit trail. */
export async function updateProjectUnitNumber(id: string, unitNumber: string | undefined, actorName: string): Promise<void> {
  const project = (await listProjects()).find((p) => p.id === id);
  if (!project) throw new Error("Project not found");
  const building = (await listBuildings()).find((b) => b.id === project.building_id);
  const now = new Date().toISOString();
  const wasDefaultName = !building || project.name === `${building.name}${project.unit_number ? " — Unit " + project.unit_number : ""}`;
  const patch: Partial<Project> = { unit_number: unitNumber ?? undefined, updated_at: now };
  if (wasDefaultName && building) patch.name = `${building.name}${unitNumber ? " — Unit " + unitNumber : ""}`;
  const client = sb();
  if (client) {
    const { error } = await client.from("projects").update({ ...patch, unit_number: unitNumber ?? null }).eq("id", id);
    if (error) throw error;
  } else {
    Object.assign(project, patch);
  }
  logActivity({ action: "Unit number changed", related_type: "project", related_id: id, actor_name: actorName, detail: `${project.unit_number ?? "—"} → ${unitNumber ?? "—"}` });
}

export async function updateProjectPipelineStage(id: string, stage: PipelineStage): Promise<void> {
  const client = sb();
  const now = new Date().toISOString();
  const timestampField = STAGE_TIMESTAMP_FIELD[stage];
  if (client) {
    const patch: Record<string, unknown> = { pipeline_stage: stage, updated_at: now };
    if (timestampField) {
      // Only stamp it if it isn't already set — read-then-conditionally-set
      // is fine here (unlike claiming) because this isn't a race between
      // two actors contending for exclusive ownership of one field.
      const current = await getProject(id);
      if (current && !current[timestampField]) patch[timestampField] = now;
    }
    const { error } = await client.from("projects").update(patch).eq("id", id);
    if (error) throw error;
  } else {
    const project = getStore().projects.find((p) => p.id === id);
    if (project) {
      project.pipeline_stage = stage;
      project.updated_at = now;
      if (timestampField) stampOnce(project, timestampField, now);
    }
  }
  logActivity({ action: `Project stage changed to ${stage}`, related_type: "project", related_id: id });
}

export async function updateBidStatus(id: string, bidStatus: BidStatus, actorName?: string): Promise<void> {
  const client = sb();
  const now = new Date().toISOString();
  const timestampField = BID_STATUS_TIMESTAMP_FIELD[bidStatus];
  if (client) {
    const patch: Record<string, unknown> = { bid_status: bidStatus, updated_at: now };
    if (timestampField) {
      const current = await getProject(id);
      if (current && !current[timestampField]) patch[timestampField] = now;
    }
    if (bidStatus === "Accepted") patch.pipeline_stage = "Bid Accepted";
    const { error } = await client.from("projects").update(patch).eq("id", id);
    if (error) throw error;
  } else {
    const project = getStore().projects.find((p) => p.id === id);
    if (project) {
      project.bid_status = bidStatus;
      project.updated_at = now;
      if (timestampField) stampOnce(project, timestampField, now);
      if (bidStatus === "Accepted") project.pipeline_stage = "Bid Accepted";
    }
  }
  logActivity({ action: `Bid marked ${bidStatus}`, related_type: "project", related_id: id, actor_name: actorName });
}

export type ClaimBidResult =
  | { ok: true; project: Project }
  | { ok: false; currentEstimatorId: string; currentEstimatorName?: string };

/**
 * Atomic bid claim. Only succeeds if the project is currently unclaimed.
 *
 * - Supabase path: a single `UPDATE ... WHERE assigned_estimator_id IS
 *   NULL RETURNING *` — the database itself enforces the race, not a
 *   read-then-write round trip from this process.
 * - In-memory path: the unclaimed check and the claim are done in one
 *   synchronous block with no `await` in between, so — because Node/JS
 *   runs a single thread and nothing can interleave inside a synchronous
 *   block — two "simultaneous" claim calls can never both see the bid as
 *   unclaimed. Whichever call's synchronous block runs first wins; the
 *   second sees the already-set assigned_estimator_id and fails.
 */
export async function claimBid(id: string, estimatorId: string, estimatorName?: string): Promise<ClaimBidResult> {
  const client = sb();
  const now = new Date().toISOString();
  if (client) {
    const { data, error } = await client
      .from("projects")
      .update({ assigned_estimator_id: estimatorId, bid_status: "Claimed", claimed_at: now, bid_claimed_at: now, updated_at: now })
      .eq("id", id)
      .is("assigned_estimator_id", null)
      .select()
      .single();
    if (!error && data) {
      logActivity({ action: "Bid claimed", related_type: "project", related_id: id, actor_name: estimatorName });
      return { ok: true, project: data as Project };
    }
    const current = await getProject(id);
    if (!current) throw new Error("Project not found");
    const currentEstimator = current.assigned_estimator_id ? await getOfficeUser(current.assigned_estimator_id) : undefined;
    return { ok: false, currentEstimatorId: current.assigned_estimator_id ?? "", currentEstimatorName: currentEstimator?.full_name };
  }

  // In-memory fallback — synchronous check-then-set, no await between them.
  const store = getStore();
  const project = store.projects.find((p) => p.id === id);
  if (!project) throw new Error("Project not found");
  if (project.assigned_estimator_id) {
    const currentEstimator = store.officeUsers.find((u) => u.id === project.assigned_estimator_id);
    return { ok: false, currentEstimatorId: project.assigned_estimator_id, currentEstimatorName: currentEstimator?.full_name };
  }
  project.assigned_estimator_id = estimatorId;
  project.bid_status = "Claimed";
  project.claimed_at = now;
  stampOnce(project, "bid_claimed_at", now);
  project.updated_at = now;
  logActivity({ action: "Bid claimed", related_type: "project", related_id: id, actor_name: estimatorName });
  return { ok: true, project };
}

/**
 * Manager override: release a bid back to Unclaimed, or reassign it to a
 * different estimator. Records previous estimator, actor, new estimator,
 * and timestamp in the activity log regardless of which happened.
 */
export async function reassignOrReleaseBid(
  id: string,
  newEstimatorId: string | null,
  actorName: string
): Promise<Project> {
  const client = sb();
  const now = new Date().toISOString();
  const project = await getProject(id);
  if (!project) throw new Error("Project not found");
  const previousEstimator = project.assigned_estimator_id ? await getOfficeUser(project.assigned_estimator_id) : undefined;
  const newEstimator = newEstimatorId ? await getOfficeUser(newEstimatorId) : undefined;
  const patch = {
    assigned_estimator_id: newEstimatorId,
    bid_status: (newEstimatorId ? "Claimed" : "Unclaimed") as BidStatus,
    claimed_at: newEstimatorId ? now : null,
    updated_at: now,
  };
  if (client) {
    const { error } = await client.from("projects").update(patch).eq("id", id);
    if (error) throw error;
  } else {
    Object.assign(project, patch);
    if (newEstimatorId) stampOnce(project, "bid_claimed_at", now);
  }
  logActivity({
    action: newEstimatorId ? "Bid reassigned" : "Bid released",
    related_type: "project",
    related_id: id,
    actor_name: actorName,
    detail: `From ${previousEstimator?.full_name ?? "unclaimed"} to ${newEstimator?.full_name ?? "unclaimed"} by ${actorName}`,
  });
  return { ...project, ...patch };
}

export interface DuplicateBidMatch {
  type: "job_request" | "project";
  id: string;
  status: string;
  buildingId: string;
  unitNumber?: string;
  estimatorName?: string;
}

/**
 * Duplicate-bid check for the New Job Request flow: any OPEN job request
 * or project (not completed/declined/cancelled) already matching the same
 * building + unit. No new table needed — this just queries the two
 * existing tables the same way the rest of the app already reads them.
 */
export async function findOpenDuplicateBids(buildingId: string, unitNumber?: string): Promise<DuplicateBidMatch[]> {
  const norm = (s?: string) => (s ?? "").trim().toLowerCase();
  const [jobRequests, projects, officeUsers] = await Promise.all([listJobRequests(), listProjects(), listOfficeUsers()]);
  const officeUserById = new Map(officeUsers.map((u) => [u.id, u]));
  const matches: DuplicateBidMatch[] = [];
  for (const jr of jobRequests) {
    if (jr.building_id !== buildingId || norm(jr.unit_number) !== norm(unitNumber)) continue;
    if (jr.status === "Converted to Project" || jr.status === "Declined" || jr.status === "Cancelled") continue;
    matches.push({ type: "job_request", id: jr.id, status: jr.status, buildingId: jr.building_id, unitNumber: jr.unit_number });
  }
  for (const p of projects) {
    if (p.building_id !== buildingId || norm(p.unit_number) !== norm(unitNumber)) continue;
    if (p.pipeline_stage === "Complete") continue;
    matches.push({
      type: "project",
      id: p.id,
      status: p.pipeline_stage,
      buildingId: p.building_id,
      unitNumber: p.unit_number,
      estimatorName: p.assigned_estimator_id ? officeUserById.get(p.assigned_estimator_id)?.full_name : undefined,
    });
  }
  return matches;
}

export async function createScheduleAssignment(input: {
  project_id: string;
  employee_id: string;
  schedule_date: string;
  role_on_job: StaffCapability;
  time_and_half: boolean;
  call_time?: string;
  notes?: string;
  actorName?: string;
}): Promise<ScheduleAssignment> {
  const store = getStore();
  const employee = (await listEmployees()).find((e) => e.id === input.employee_id);
  if (!employee) throw new Error("Employee not found");
  const rate_multiplier = input.time_and_half ? 1.5 : 1.0;
  const record: ScheduleAssignment = {
    id: randomUUID(),
    company_id: getCurrentCompanyId(),
    project_id: input.project_id,
    employee_id: input.employee_id,
    schedule_date: input.schedule_date,
    role_on_job: input.role_on_job,
    base_day_rate: employee.day_rate,
    rate_multiplier,
    time_and_half: input.time_and_half,
    // Snapshotted now — never recalculated from the employee's current rate later.
    assignment_cost: Math.round(employee.day_rate * rate_multiplier * 100) / 100,
    call_time: input.call_time ?? "7:00 AM",
    notes: input.notes,
    created_at: new Date().toISOString(),
  };
  const client = sb();
  if (client) {
    const { error } = await client.from("schedule_assignments").insert(record);
    if (error) throw error;
  } else {
    store.scheduleAssignments.push(record);
  }
  logActivity({
    action: "Assigned crew",
    related_type: "project",
    related_id: input.project_id,
    actor_name: input.actorName,
    detail: `${employee.first_name} ${employee.last_name} on ${input.schedule_date} as ${input.role_on_job}`,
  });
  return record;
}

export async function deleteScheduleAssignment(id: string, actorName?: string): Promise<void> {
  const assignments = await listScheduleAssignments();
  const target = assignments.find((a) => a.id === id);
  const client = sb();
  if (client) {
    const { error } = await client.from("schedule_assignments").delete().eq("id", id);
    if (error) throw error;
  } else {
    const store = getStore();
    const idx = store.scheduleAssignments.findIndex((a) => a.id === id);
    if (idx >= 0) store.scheduleAssignments.splice(idx, 1);
  }
  if (target) {
    const employee = (await listEmployees()).find((e) => e.id === target.employee_id);
    logActivity({
      action: "Removed crew assignment",
      related_type: "project",
      related_id: target.project_id,
      actor_name: actorName,
      detail: `${employee ? `${employee.first_name} ${employee.last_name}` : target.employee_id} removed from ${target.schedule_date} (${target.role_on_job})`,
    });
  }
}

export async function deleteProjectCrewRequirement(id: string): Promise<void> {
  const client = sb();
  if (client) {
    const { error } = await client.from("project_crew_requirements").delete().eq("id", id);
    if (error) throw error;
  } else {
    const store = getStore();
    store.projectCrewRequirements = store.projectCrewRequirements.filter((r) => r.id !== id);
  }
}

export async function createProjectCrewRequirement(input: {
  project_id: string;
  schedule_date?: string | null;
  role: StaffCapability;
  quantity: number;
  employee_ids?: string[];
  estimated_days?: number | null;
}): Promise<ProjectCrewRequirement> {
  const record: ProjectCrewRequirement = {
    id: randomUUID(),
    company_id: getCurrentCompanyId(),
    project_id: input.project_id,
    schedule_date: input.schedule_date ?? null,
    role: input.role,
    quantity: input.quantity,
    employee_ids: input.employee_ids ?? [],
    estimated_days: input.estimated_days ?? null,
  };
  const client = sb();
  if (client) {
    const { error } = await client.from("project_crew_requirements").insert(record);
    if (error) throw error;
  } else {
    getStore().projectCrewRequirements.push(record);
  }
  return record;
}

export async function createProjectMaterial(input: Omit<ProjectMaterial, "id" | "company_id" | "created_at">): Promise<ProjectMaterial> {
  const record: ProjectMaterial = {
    id: randomUUID(),
    company_id: getCurrentCompanyId(),
    created_at: new Date().toISOString(),
    ...input,
  };
  const client = sb();
  if (client) {
    const { error } = await client.from("project_materials").insert(record);
    if (error) throw error;
  } else {
    getStore().projectMaterials.push(record);
  }
  return record;
}

/** Job-history line for a material purchase. */
export async function logMaterialAdded(projectId: string, description: string, quantity: number, cost: number, supplier: string | undefined, actorName: string): Promise<void> {
  logActivity({
    action: "Added material",
    related_type: "project",
    related_id: projectId,
    actor_name: actorName,
    detail: `${quantity} × ${description}${supplier ? ` from ${supplier}` : ""} — $${cost.toFixed(2)}`,
  });
}

export async function updateProjectMaterial(id: string, patch: Partial<Omit<ProjectMaterial, "id" | "company_id" | "project_id" | "created_at">>): Promise<void> {
  const client = sb();
  if (client) {
    const { error } = await client.from("project_materials").update(patch).eq("id", id);
    if (error) throw error;
  } else {
    const pm = getStore().projectMaterials.find((m) => m.id === id);
    if (pm) Object.assign(pm, patch);
  }
}

export async function deleteProjectMaterial(id: string, actorName?: string): Promise<void> {
  const existing = (await listProjectMaterials()).find((m) => m.id === id);
  const client = sb();
  if (client) {
    const { error } = await client.from("project_materials").delete().eq("id", id);
    if (error) throw error;
  } else {
    const store = getStore();
    store.projectMaterials = store.projectMaterials.filter((m) => m.id !== id);
  }
  if (existing) logActivity({ action: "Removed material", related_type: "project", related_id: existing.project_id ?? undefined, actor_name: actorName, detail: existing.description });
}

export async function updateProjectMaterialStatus(id: string, status: ProjectMaterial["status"]): Promise<void> {
  const client = sb();
  if (client) {
    const { error } = await client.from("project_materials").update({ status }).eq("id", id);
    if (error) throw error;
  } else {
    const pm = getStore().projectMaterials.find((m) => m.id === id);
    if (pm) pm.status = status;
  }
}

export async function createTask(input: Omit<Task, "id" | "company_id" | "created_at" | "updated_at" | "status"> & { status?: TaskStatus }): Promise<Task> {
  const now = new Date().toISOString();
  const record: Task = {
    id: randomUUID(),
    company_id: getCurrentCompanyId(),
    status: input.status ?? "To Do",
    created_at: now,
    updated_at: now,
    ...input,
  };
  const client = sb();
  if (client) {
    const { error } = await client.from("tasks").insert(record);
    if (error) throw error;
  } else {
    getStore().tasks.unshift(record);
  }
  return record;
}

export async function updateTaskStatus(id: string, status: TaskStatus): Promise<void> {
  const client = sb();
  const now = new Date().toISOString();
  if (client) {
    const { error } = await client.from("tasks").update({ status, updated_at: now }).eq("id", id);
    if (error) throw error;
  } else {
    const task = getStore().tasks.find((t) => t.id === id);
    if (task) {
      task.status = status;
      task.updated_at = now;
    }
  }
}

export async function createLead(input: Omit<NewBusinessLead, "id" | "company_id" | "created_at" | "updated_at" | "status"> & { status?: NewBusinessLead["status"] }): Promise<NewBusinessLead> {
  const now = new Date().toISOString();
  const record: NewBusinessLead = {
    id: randomUUID(),
    company_id: getCurrentCompanyId(),
    status: input.status ?? "New",
    created_at: now,
    updated_at: now,
    ...input,
  };
  const client = sb();
  if (client) {
    const { error } = await client.from("new_business_leads").insert(record);
    if (error) throw error;
  } else {
    getStore().newBusinessLeads.unshift(record);
  }
  return record;
}

export async function updateLeadStatus(id: string, status: NewBusinessLead["status"]): Promise<void> {
  const client = sb();
  const now = new Date().toISOString();
  if (client) {
    const { error } = await client.from("new_business_leads").update({ status, updated_at: now }).eq("id", id);
    if (error) throw error;
  } else {
    const lead = getStore().newBusinessLeads.find((l) => l.id === id);
    if (lead) {
      lead.status = status;
      lead.updated_at = now;
    }
  }
}

export async function convertLeadToClient(leadId: string): Promise<ClientCompany> {
  const store = getStore();
  const lead = (await listLeads()).find((l) => l.id === leadId);
  if (!lead) throw new Error("Lead not found");
  const now = new Date().toISOString();
  const client_company: ClientCompany = {
    id: randomUUID(),
    company_id: getCurrentCompanyId(),
    name: lead.company_name,
    type: "Property Management",
    phone: lead.phone,
    email: lead.email,
    notes: `Converted from New Business lead. ${lead.notes ?? ""}`.trim(),
    created_at: now,
  };
  const client = sb();
  if (client) {
    const { error } = await client.from("client_companies").insert(client_company);
    if (error) throw error;
    await client.from("new_business_leads").update({ status: "Won", converted_client_company_id: client_company.id, updated_at: now }).eq("id", leadId);
  } else {
    store.clientCompanies.push(client_company);
    lead.status = "Won";
    lead.converted_client_company_id = client_company.id;
    lead.updated_at = now;
  }
  logActivity({ action: "Converted lead to client", related_type: "client_company", related_id: client_company.id, detail: lead.company_name });
  return client_company;
}

export async function createProjectNote(input: { project_id: string; author_name?: string; body: string }): Promise<ProjectNote> {
  const record: ProjectNote = {
    id: randomUUID(),
    company_id: getCurrentCompanyId(),
    project_id: input.project_id,
    author_name: input.author_name,
    body: input.body,
    created_at: new Date().toISOString(),
  };
  const client = sb();
  if (client) {
    const { error } = await client.from("project_notes").insert(record);
    if (error) throw error;
  } else {
    getStore().projectNotes.unshift(record);
  }
  return record;
}

// ---------------------------------------------------------------------
// CREATE FORMS: Staff, Clients, Buildings (mirrors the Job Request "new"
// pattern — a server action calling one of these, then redirecting).
// ---------------------------------------------------------------------

export async function createEmployee(
  input: Omit<Employee, "id" | "company_id" | "created_at"> & { capabilities?: StaffCapability[] }
): Promise<Employee> {
  const { capabilities, ...rest } = input;
  const record: Employee = {
    id: randomUUID(),
    company_id: getCurrentCompanyId(),
    created_at: new Date().toISOString(),
    ...rest,
  };
  const client = sb();
  if (client) {
    const { error } = await client.from("employees").insert(record);
    if (error) throw error;
    if (capabilities && capabilities.length > 0) {
      const rows = capabilities.map((capability) => ({ id: randomUUID(), employee_id: record.id, capability }));
      await client.from("employee_skills").insert(rows);
    }
  } else {
    getStore().employees.push(record);
    for (const capability of capabilities ?? []) {
      getStore().employeeSkills.push({ id: randomUUID(), employee_id: record.id, capability });
    }
  }
  logActivity({ action: "Added staff member", related_type: "employee", related_id: record.id, detail: `${record.first_name} ${record.last_name}` });
  return record;
}

export async function createClientCompanyRecord(input: Omit<ClientCompany, "id" | "company_id" | "created_at">): Promise<ClientCompany> {
  const record: ClientCompany = {
    id: randomUUID(),
    company_id: getCurrentCompanyId(),
    created_at: new Date().toISOString(),
    ...input,
  };
  const client = sb();
  if (client) {
    const { error } = await client.from("client_companies").insert(record);
    if (error) throw error;
  } else {
    getStore().clientCompanies.push(record);
  }
  logActivity({ action: "Added client company", related_type: "client_company", related_id: record.id, detail: record.name });
  return record;
}

/** Removes a client company. Its buildings, contacts, and anything hanging
 * off those buildings cascade in Postgres; the in-memory store mirrors the
 * same. Callers should refuse when the client has projects/job requests. */
export async function deleteClientCompany(id: string, actorName: string): Promise<void> {
  const existing = (await listClientCompanies()).find((c) => c.id === id);
  if (!existing) return;
  const client = sb();
  if (client) {
    const { error } = await client.from("client_companies").delete().eq("id", id);
    if (error) throw error;
  } else {
    const store = getStore();
    const buildingIds = new Set(store.buildings.filter((b) => b.client_company_id === id).map((b) => b.id));
    store.buildings = store.buildings.filter((b) => !buildingIds.has(b.id));
    store.buildingContacts = store.buildingContacts.filter((bc) => !buildingIds.has(bc.building_id));
    store.contacts = store.contacts.filter((c) => c.client_company_id !== id);
    store.clientCompanies = store.clientCompanies.filter((c) => c.id !== id);
  }
  logActivity({ action: "Deleted client", related_type: "client_company", related_id: id, actor_name: actorName, detail: existing.name });
}

/** The placeholder "client" a Quick Job building goes under when the
 * management company isn't known yet. Created once on first use; the
 * building page lets it be moved to the real company later. */
export async function getOrCreateUnassignedClient(): Promise<ClientCompany> {
  const existing = (await listClientCompanies()).find((c) => c.name === UNASSIGNED_CLIENT_NAME);
  if (existing) return existing;
  return createClientCompanyRecord({
    name: UNASSIGNED_CLIENT_NAME,
    type: "Unassigned",
    active: true,
    notes: "Buildings here were added from Quick Job without a management company. Open each building to move it to the right company.",
  });
}

export async function updateClientCompany(id: string, patch: Partial<Omit<ClientCompany, "id" | "company_id" | "created_at">>): Promise<void> {
  const client = sb();
  if (client) {
    const { error } = await client.from("client_companies").update(patch).eq("id", id);
    if (error) throw error;
  } else {
    const existing = getStore().clientCompanies.find((c) => c.id === id);
    if (existing) Object.assign(existing, patch);
  }
}

export async function updateBuilding(id: string, patch: Partial<Omit<Building, "id" | "company_id" | "created_at">>): Promise<void> {
  const client = sb();
  if (client) {
    const { error } = await client.from("buildings").update(patch).eq("id", id);
    if (error) throw error;
  } else {
    const existing = getStore().buildings.find((b) => b.id === id);
    if (existing) Object.assign(existing, patch);
  }
}

export async function createBuildingRecord(input: Omit<Building, "id" | "company_id" | "created_at">): Promise<Building> {
  const record: Building = {
    id: randomUUID(),
    company_id: getCurrentCompanyId(),
    created_at: new Date().toISOString(),
    ...input,
  };
  const client = sb();
  if (client) {
    const { error } = await client.from("buildings").insert(record);
    if (error) throw error;
  } else {
    getStore().buildings.push(record);
  }
  logActivity({ action: "Added building", related_type: "building", related_id: record.id, detail: record.name });
  return record;
}

/** The building's primary point-of-contact (property manager), if any —
 * used by the Schedule page's crew cards. Reuses the existing
 * `primary_contact_id` column on buildings; no new schema needed. */
export async function getPrimaryContactForBuilding(buildingId: string): Promise<Contact | undefined> {
  const [buildings, contacts] = await Promise.all([listBuildings(), listContacts()]);
  const building = buildings.find((b) => b.id === buildingId);
  if (!building?.primary_contact_id) return undefined;
  return contacts.find((c) => c.id === building.primary_contact_id);
}

export async function updateScheduleAssignmentCallTime(id: string, callTime: string): Promise<void> {
  const client = sb();
  if (client) {
    const { error } = await client.from("schedule_assignments").update({ call_time: callTime }).eq("id", id);
    if (error) throw error;
  } else {
    const a = getStore().scheduleAssignments.find((x) => x.id === id);
    if (a) a.call_time = callTime;
  }
}

// ---------------------------------------------------------------------
// PHOTOS & PROGRESS ENTRIES
// ---------------------------------------------------------------------

export async function createPhotoRecord(input: {
  related_type: PhotoRecord["related_type"];
  related_id: string;
  file_name: string;
  storage_path?: string;
  category?: PhotoCategory;
  title?: string;
  caption?: string;
  taken_at?: string;
  uploaded_by?: string;
  storage_unavailable?: boolean;
}): Promise<PhotoRecord> {
  const record: PhotoRecord = {
    id: randomUUID(),
    company_id: getCurrentCompanyId(),
    created_at: new Date().toISOString(),
    ...input,
  };
  const client = sb();
  if (client) {
    const { error } = await client.from("photos").insert(record);
    if (error) throw error;
  } else {
    getStore().photos.unshift(record);
  }
  logActivity({ action: "Added progress photo entry", related_type: input.related_type, related_id: input.related_id, detail: input.title ?? input.caption });
  return record;
}

// ---------------------------------------------------------------------
// PROJECT DRAWINGS (build 9) — Procore-style "Drawings" tool with version
// history. See lib/types.ts ProjectDrawing and README "Photos & Drawings".
// ---------------------------------------------------------------------

export async function listProjectDrawings(): Promise<ProjectDrawing[]> {
  const client = sb();
  if (client) {
    const { data, error } = await client.from("project_drawings").select("*").order("uploaded_at", { ascending: false });
    if (!error && data) return data as ProjectDrawing[];
  }
  return [...getStore().projectDrawings].sort((a, b) => (a.uploaded_at < b.uploaded_at ? 1 : -1));
}

/**
 * Uploads a NEW drawing, or a new VERSION of an existing one when
 * `supersedes_id` is given (the id of the row being replaced). Superseding
 * flips the old row's `is_current_version` to false — it is never deleted,
 * so full history stays available via "Version History" — and inserts a
 * brand-new row at `version + 1`, `is_current_version: true`, inheriting
 * the same drawing_name/drawing_number.
 */
export async function createProjectDrawing(input: {
  project_id: string;
  drawing_name: string;
  drawing_number?: string;
  file_reference?: string;
  notes?: string;
  uploaded_by?: string;
  storage_unavailable?: boolean;
  supersedes_id?: string;
}): Promise<ProjectDrawing> {
  const client = sb();
  const now = new Date().toISOString();
  const existingDrawings = await listProjectDrawings();
  const supersedes = input.supersedes_id ? existingDrawings.find((d) => d.id === input.supersedes_id) : undefined;

  if (supersedes) {
    if (client) {
      const { error } = await client.from("project_drawings").update({ is_current_version: false }).eq("id", supersedes.id);
      if (error) throw error;
    } else {
      const row = getStore().projectDrawings.find((d) => d.id === supersedes.id);
      if (row) row.is_current_version = false;
    }
  }

  const record: ProjectDrawing = {
    id: randomUUID(),
    company_id: getCurrentCompanyId(),
    project_id: input.project_id,
    drawing_name: supersedes?.drawing_name ?? input.drawing_name,
    drawing_number: supersedes?.drawing_number ?? input.drawing_number,
    version: supersedes ? supersedes.version + 1 : 1,
    file_reference: input.file_reference,
    is_current_version: true,
    uploaded_by: input.uploaded_by,
    uploaded_at: now,
    notes: input.notes,
    storage_unavailable: input.storage_unavailable,
    created_at: now,
  };
  if (client) {
    const { error } = await client.from("project_drawings").insert(record);
    if (error) throw error;
  } else {
    getStore().projectDrawings.push(record);
  }
  logActivity({
    action: supersedes ? "Uploaded new drawing version" : "Added drawing",
    related_type: "project",
    related_id: input.project_id,
    actor_name: input.uploaded_by,
    detail: `${record.drawing_name}${record.drawing_number ? ` (${record.drawing_number})` : ""} — v${record.version}`,
  });
  return record;
}

export async function saveCompanySetupAnswer(section: string, questionKey: string, answer: string): Promise<void> {
  const client = sb();
  const now = new Date().toISOString();
  if (client) {
    const { error } = await client
      .from("company_setup_answers")
      .upsert({ company_id: getCurrentCompanyId(), section, question_key: questionKey, answer, updated_at: now }, { onConflict: "company_id,section,question_key" });
    if (error) throw error;
  } else {
    const store = getStore();
    const existing = store.companySetupAnswers.find((a) => a.section === section && a.question_key === questionKey);
    if (existing) {
      existing.answer = answer;
      existing.updated_at = now;
    } else {
      store.companySetupAnswers.push({
        id: randomUUID(),
        company_id: getCurrentCompanyId(),
        section,
        question_key: questionKey,
        answer,
        updated_at: now,
      });
    }
  }
}

// ---------------------------------------------------------------------
// OWNER'S PERSONAL AGENDA (build 8) — see
// supabase/migrations/0008_owner_agenda.sql, lib/google-calendar.ts and
// README "Owner's Agenda & Future Google Calendar Sync". Separate from the
// operational Schedule; every entry belongs to one owner_user_id (see
// lib/current-user.ts).
// ---------------------------------------------------------------------

export async function listAgendaEvents(): Promise<AgendaEvent[]> {
  const client = sb();
  if (client) {
    const { data, error } = await client.from("agenda_events").select("*").order("event_date");
    if (!error && data) return data as AgendaEvent[];
  }
  return [...getStore().agendaEvents].sort((a, b) => a.event_date.localeCompare(b.event_date) || (a.start_time ?? "").localeCompare(b.start_time ?? ""));
}

export async function listAgendaEventsForOwner(ownerUserId: string): Promise<AgendaEvent[]> {
  return (await listAgendaEvents()).filter((e) => e.owner_user_id === ownerUserId);
}

export async function createAgendaEvent(input: {
  owner_user_id: string;
  title: string;
  event_date: string;
  start_time?: string;
  end_time?: string;
  location?: string;
  notes?: string;
  related_type?: RelatedRecordType;
  related_id?: string;
  actorName?: string;
  created_by_name?: string | null;
}): Promise<AgendaEvent> {
  const now = new Date().toISOString();
  const record: AgendaEvent = {
    id: randomUUID(),
    company_id: getCurrentCompanyId(),
    owner_user_id: input.owner_user_id,
    title: input.title,
    event_date: input.event_date,
    start_time: input.start_time || null,
    end_time: input.end_time || null,
    location: input.location || null,
    notes: input.notes || null,
    related_type: input.related_type ?? null,
    related_id: input.related_id ?? null,
    source: "Manual",
    created_by_name: input.created_by_name ?? input.actorName ?? null,
    external_event_id: null,
    created_at: now,
    updated_at: now,
  };
  const client = sb();
  if (client) {
    const { error } = await client.from("agenda_events").insert(record);
    if (error) throw error;
  } else {
    getStore().agendaEvents.push(record);
  }
  logActivity({
    action: "Added agenda event",
    related_type: input.related_type,
    related_id: input.related_id,
    actor_name: input.actorName,
    detail: `${input.title} — ${input.event_date}${input.start_time ? ` at ${input.start_time}` : ""}`,
  });
  return record;
}

export async function updateAgendaEvent(
  id: string,
  patch: Partial<Pick<AgendaEvent, "title" | "event_date" | "start_time" | "end_time" | "location" | "notes">>,
  actorName?: string
): Promise<void> {
  const now = new Date().toISOString();
  const client = sb();
  if (client) {
    const { error } = await client.from("agenda_events").update({ ...patch, updated_at: now }).eq("id", id);
    if (error) throw error;
  } else {
    const entry = getStore().agendaEvents.find((e) => e.id === id);
    if (entry) Object.assign(entry, patch, { updated_at: now });
  }
  logActivity({ action: "Edited agenda event", related_type: undefined, related_id: id, actor_name: actorName, detail: JSON.stringify(patch) });
}

export async function setAgendaEventCompleted(id: string, done: boolean, actorName?: string): Promise<void> {
  const now = new Date().toISOString();
  const patch = { completed_at: done ? now : null, updated_at: now };
  const client = sb();
  if (client) {
    const { error } = await client.from("agenda_events").update(patch).eq("id", id);
    if (error) throw error;
  } else {
    const e = getStore().agendaEvents.find((x) => x.id === id);
    if (e) Object.assign(e, patch);
  }
  logActivity({ action: done ? "Agenda item completed" : "Agenda item reopened", related_id: id, actor_name: actorName });
}

export async function deleteAgendaEvent(id: string, actorName?: string): Promise<void> {
  const client = sb();
  const existing = (await listAgendaEvents()).find((e) => e.id === id);
  if (client) {
    const { error } = await client.from("agenda_events").delete().eq("id", id);
    if (error) throw error;
  } else {
    const store = getStore();
    const idx = store.agendaEvents.findIndex((e) => e.id === id);
    if (idx >= 0) store.agendaEvents.splice(idx, 1);
  }
  logActivity({
    action: "Deleted agenda event",
    actor_name: actorName,
    detail: existing ? `${existing.title} — ${existing.event_date}` : id,
  });
}

/** Marks an agenda event as synced from Google Calendar — called by a
 * future real sync implementation (see lib/google-calendar.ts). Unused
 * today since no live sync runs, but kept here so the write path exists
 * once one does. */
export async function upsertGoogleAgendaEvent(input: {
  owner_user_id: string;
  external_event_id: string;
  title: string;
  event_date: string;
  start_time?: string;
  end_time?: string;
  location?: string;
  notes?: string;
  source?: AgendaEventSource;
}): Promise<AgendaEvent> {
  const existing = (await listAgendaEvents()).find(
    (e) => e.owner_user_id === input.owner_user_id && e.external_event_id === input.external_event_id
  );
  const now = new Date().toISOString();
  if (existing) {
    await updateAgendaEvent(existing.id, {
      title: input.title,
      event_date: input.event_date,
      start_time: input.start_time,
      end_time: input.end_time,
      location: input.location,
      notes: input.notes,
    });
    return { ...existing, ...input, updated_at: now };
  }
  const record: AgendaEvent = {
    id: randomUUID(),
    company_id: getCurrentCompanyId(),
    owner_user_id: input.owner_user_id,
    title: input.title,
    event_date: input.event_date,
    start_time: input.start_time || null,
    end_time: input.end_time || null,
    location: input.location || null,
    notes: input.notes || null,
    related_type: null,
    related_id: null,
    source: input.source ?? "Google Calendar",
    external_event_id: input.external_event_id,
    created_at: now,
    updated_at: now,
  };
  const client = sb();
  if (client) {
    const { error } = await client.from("agenda_events").insert(record);
    if (error) throw error;
  } else {
    getStore().agendaEvents.push(record);
  }
  return record;
}

// ---------------------------------------------------------------------
// QUICKBOOKS ONLINE INTEGRATION (build 10, see
// supabase/migrations/0011_quickbooks_integration.sql, lib/quickbooks.ts
// and README "QuickBooks Online Integration"). All the real Intuit API
// traffic lives in lib/quickbooks.ts — this section is pure persistence
// for connections/mappings/documents/webhook-idempotency/sync-log,
// following the exact same Supabase-or-in-memory-store pattern as every
// other table in this file.
// ---------------------------------------------------------------------

export async function getQuickBooksConnection(): Promise<QuickBooksConnection | undefined> {
  const client = sb();
  if (client) {
    const { data, error } = await client
      .from("quickbooks_connections")
      .select("*")
      .is("disconnected_at", null)
      .order("connected_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!error && data) return data as QuickBooksConnection;
    if (!error) return undefined;
  }
  return [...getStore().quickbooksConnections]
    .filter((c) => !c.disconnected_at)
    .sort((a, b) => (a.connected_at < b.connected_at ? 1 : -1))[0];
}

/** Persists a brand-new connection after a successful OAuth callback (see
 * app/api/quickbooks/callback/route.ts). Any prior active connection row
 * for this company is marked disconnected first, so there's only ever one
 * active row at a time (matches the migration's partial unique index). */
export async function createQuickBooksConnection(input: {
  realm_id: string;
  access_token: string;
  refresh_token: string;
  token_expires_at: string;
  environment: QuickBooksEnvironment;
  company_name?: string;
  connected_by?: string;
}): Promise<QuickBooksConnection> {
  const existing = await getQuickBooksConnection();
  if (existing) await disconnectQuickBooks(existing.id, input.connected_by);

  const now = new Date().toISOString();
  const record: QuickBooksConnection = {
    id: randomUUID(),
    company_id: getCurrentCompanyId(),
    realm_id: input.realm_id,
    access_token: input.access_token,
    refresh_token: input.refresh_token,
    token_expires_at: input.token_expires_at,
    environment: input.environment,
    company_name: input.company_name,
    connected_at: now,
    connected_by: input.connected_by,
    disconnected_at: null,
    last_sync_at: null,
    needs_reconnect: false,
  };
  const client = sb();
  if (client) {
    const { error } = await client.from("quickbooks_connections").insert(record);
    if (error) throw error;
  } else {
    getStore().quickbooksConnections.push(record);
  }
  logActivity({ action: "QuickBooks connected", detail: `Realm ${input.realm_id} (${input.environment})${input.company_name ? ` — ${input.company_name}` : ""}`, actor_name: input.connected_by });
  await logQuickBooksSyncEvent({ action: "Connected", success: true, initiated_by: input.connected_by });
  return record;
}

/** Persists a rotated access/refresh token pair from lib/quickbooks.ts
 * refreshAccessToken() — Intuit rotates the refresh token on every
 * refresh, so BOTH must be re-saved, never just the access token. */
export async function updateQuickBooksConnectionTokens(
  id: string,
  tokens: { accessToken: string; refreshToken: string; expiresAt: string }
): Promise<void> {
  const patch = { access_token: tokens.accessToken, refresh_token: tokens.refreshToken, token_expires_at: tokens.expiresAt, needs_reconnect: false };
  const client = sb();
  if (client) {
    const { error } = await client.from("quickbooks_connections").update(patch).eq("id", id);
    if (error) throw error;
  } else {
    const conn = getStore().quickbooksConnections.find((c) => c.id === id);
    if (conn) Object.assign(conn, patch);
  }
}

/** Flags a connection as needing reconnection (refresh failed / Intuit
 * revoked auth) WITHOUT throwing — every QuickBooks call site wraps this
 * around a failed refresh so the rest of the app degrades gracefully
 * rather than surfacing a raw error. */
export async function markQuickBooksNeedsReconnect(id: string, reason: string): Promise<void> {
  const client = sb();
  if (client) {
    const { error } = await client.from("quickbooks_connections").update({ needs_reconnect: true }).eq("id", id);
    if (error) throw error;
  } else {
    const conn = getStore().quickbooksConnections.find((c) => c.id === id);
    if (conn) conn.needs_reconnect = true;
  }
  await logQuickBooksSyncEvent({ action: "Connection needs reconnect", success: false, error_detail: reason });
}

export async function disconnectQuickBooks(id: string, actorName?: string): Promise<void> {
  const now = new Date().toISOString();
  const client = sb();
  if (client) {
    const { error } = await client.from("quickbooks_connections").update({ disconnected_at: now }).eq("id", id);
    if (error) throw error;
  } else {
    const conn = getStore().quickbooksConnections.find((c) => c.id === id);
    if (conn) conn.disconnected_at = now;
  }
  logActivity({ action: "QuickBooks disconnected", actor_name: actorName });
  await logQuickBooksSyncEvent({ action: "Disconnected", success: true, initiated_by: actorName });
}

export async function setQuickBooksCompanyName(id: string, companyName: string): Promise<void> {
  const client = sb();
  if (client) {
    const { error } = await client.from("quickbooks_connections").update({ company_name: companyName }).eq("id", id);
    if (error) throw error;
  } else {
    const conn = getStore().quickbooksConnections.find((c) => c.id === id);
    if (conn) conn.company_name = companyName;
  }
}

export async function setQuickBooksLastSync(id: string, at: string): Promise<void> {
  const client = sb();
  if (client) {
    const { error } = await client.from("quickbooks_connections").update({ last_sync_at: at }).eq("id", id);
    if (error) throw error;
  } else {
    const conn = getStore().quickbooksConnections.find((c) => c.id === id);
    if (conn) conn.last_sync_at = at;
  }
}

// --- Customer mappings ---------------------------------------------------

export async function listQuickBooksCustomerMappings(): Promise<QuickBooksCustomerMapping[]> {
  const client = sb();
  if (client) {
    const { data, error } = await client.from("quickbooks_customer_mappings").select("*");
    if (!error && data) return data as QuickBooksCustomerMapping[];
  }
  return getStore().quickbooksCustomerMappings;
}

export async function getQuickBooksCustomerMappingForClient(clientCompanyId: string): Promise<QuickBooksCustomerMapping | undefined> {
  return (await listQuickBooksCustomerMappings()).find((m) => m.client_company_id === clientCompanyId);
}

/**
 * Links an internal client_company to a QuickBooks customer — the ONLY
 * write path for this table, always an explicit human action ([Link] or
 * [Create New QuickBooks Customer] in the matching UI), never automatic
 * from a fuzzy match. Enforces the same one-mapping-per-client-company and
 * one-mapping-per-qb-customer rule the migration's unique indexes enforce
 * at the database level, so the in-memory fallback behaves identically.
 */
export async function createQuickBooksCustomerMapping(input: {
  client_company_id: string;
  qb_customer_id: string;
  qb_customer_name: string;
  linked_by?: string;
}): Promise<QuickBooksCustomerMapping> {
  const existing = await listQuickBooksCustomerMappings();
  if (existing.some((m) => m.client_company_id === input.client_company_id)) {
    throw new Error("This management company is already linked to a QuickBooks customer.");
  }
  if (existing.some((m) => m.qb_customer_id === input.qb_customer_id)) {
    throw new Error("This QuickBooks customer is already linked to a different management company.");
  }
  const record: QuickBooksCustomerMapping = {
    id: randomUUID(),
    company_id: getCurrentCompanyId(),
    client_company_id: input.client_company_id,
    qb_customer_id: input.qb_customer_id,
    qb_customer_name: input.qb_customer_name,
    linked_at: new Date().toISOString(),
    linked_by: input.linked_by,
  };
  const client = sb();
  if (client) {
    const { error } = await client.from("quickbooks_customer_mappings").insert(record);
    if (error) throw error;
  } else {
    getStore().quickbooksCustomerMappings.push(record);
  }
  logActivity({ action: "Linked QuickBooks customer", related_type: "client_company", related_id: input.client_company_id, actor_name: input.linked_by, detail: input.qb_customer_name });
  await logQuickBooksSyncEvent({ action: "Customer linked", success: true, initiated_by: input.linked_by, document_number: input.qb_customer_name });
  return record;
}

// --- Documents (Estimates & Invoices) ------------------------------------

export async function listQuickBooksDocuments(): Promise<QuickBooksDocument[]> {
  const client = sb();
  if (client) {
    const { data, error } = await client.from("quickbooks_documents").select("*").order("created_at", { ascending: false });
    if (!error && data) return data as QuickBooksDocument[];
  }
  return [...getStore().quickbooksDocuments].sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
}

export async function listQuickBooksDocumentsForProject(projectId: string): Promise<QuickBooksDocument[]> {
  return (await listQuickBooksDocuments()).filter((d) => d.project_id === projectId);
}

/**
 * Maps a QuickBooks Estimate/Invoice to an internal project — used by both
 * "Create Estimate/Invoice in QuickBooks" (after a successful QBO create)
 * and "Link Existing QuickBooks Estimate/Invoice". DUPLICATE PROTECTION:
 * checks for an existing mapping on the same (realm, entity_type,
 * entity_id) BEFORE inserting — so a retried call after a timeout (or
 * linking the same document twice) is rejected here rather than relying
 * solely on the database's unique index, which the in-memory fallback
 * doesn't have.
 */
export async function createQuickBooksDocument(input: {
  project_id: string;
  qb_realm_id: string;
  entity_type: QuickBooksEntityType;
  qb_entity_id: string;
  document_number?: string;
  status: QBDocumentStatus;
  amount: number;
  amount_paid?: number;
  qb_customer_id: string;
  actorName?: string;
}): Promise<QuickBooksDocument> {
  const existing = await listQuickBooksDocuments();
  if (existing.some((d) => d.qb_realm_id === input.qb_realm_id && d.entity_type === input.entity_type && d.qb_entity_id === input.qb_entity_id)) {
    throw new Error(`This ${input.entity_type} is already linked to a job — it can't be linked or created twice.`);
  }
  const now = new Date().toISOString();
  const record: QuickBooksDocument = {
    id: randomUUID(),
    company_id: getCurrentCompanyId(),
    project_id: input.project_id,
    qb_realm_id: input.qb_realm_id,
    entity_type: input.entity_type,
    qb_entity_id: input.qb_entity_id,
    document_number: input.document_number,
    status: input.status,
    amount: input.amount,
    amount_paid: input.amount_paid,
    qb_customer_id: input.qb_customer_id,
    created_at: now,
    updated_at: now,
    last_synced_at: now,
  };
  const client = sb();
  if (client) {
    const { error } = await client.from("quickbooks_documents").insert(record);
    if (error) throw error;
  } else {
    getStore().quickbooksDocuments.push(record);
  }
  logActivity({
    action: `QuickBooks ${input.entity_type} linked`,
    related_type: "project",
    related_id: input.project_id,
    actor_name: input.actorName,
    detail: `${input.document_number ?? input.qb_entity_id} — ${formatMoney(input.amount)}`,
  });
  await logQuickBooksSyncEvent({
    action: `${input.entity_type} linked`,
    project_id: input.project_id,
    entity_type: input.entity_type,
    qb_entity_id: input.qb_entity_id,
    document_number: input.document_number,
    success: true,
    initiated_by: input.actorName,
  });
  return record;
}

export async function updateQuickBooksDocumentStatus(
  id: string,
  patch: { status: QBDocumentStatus; amount?: number; amount_paid?: number }
): Promise<void> {
  const now = new Date().toISOString();
  const fullPatch = { ...patch, updated_at: now, last_synced_at: now };
  const client = sb();
  if (client) {
    const { error } = await client.from("quickbooks_documents").update(fullPatch).eq("id", id);
    if (error) throw error;
  } else {
    const doc = getStore().quickbooksDocuments.find((d) => d.id === id);
    if (doc) Object.assign(doc, fullPatch);
  }
}

function formatMoney(n: number): string {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

// --- Webhook idempotency ---------------------------------------------------

export async function hasProcessedQuickBooksWebhookEvent(eventId: string): Promise<boolean> {
  const client = sb();
  if (client) {
    const { data, error } = await client.from("quickbooks_webhook_events").select("id").eq("event_id", eventId).maybeSingle();
    if (!error) return !!data;
  }
  return getStore().quickbooksWebhookEvents.some((e) => e.event_id === eventId);
}

/** Records that a webhook event has been received/processed — called
 * BEFORE handling it, so a duplicate delivery (Intuit retries on non-2xx,
 * and may occasionally redeliver regardless) is recognized and skipped by
 * hasProcessedQuickBooksWebhookEvent() above rather than double-processed. */
export async function recordQuickBooksWebhookEvent(input: { event_id: string; payload_summary: string }): Promise<QuickBooksWebhookEvent> {
  const now = new Date().toISOString();
  const record: QuickBooksWebhookEvent = {
    id: randomUUID(),
    event_id: input.event_id,
    received_at: now,
    processed_at: now,
    payload_summary: input.payload_summary,
  };
  const client = sb();
  if (client) {
    const { error } = await client.from("quickbooks_webhook_events").insert(record);
    if (error) throw error;
  } else {
    getStore().quickbooksWebhookEvents.push(record);
  }
  return record;
}

// --- Sync log ---------------------------------------------------------

export async function listQuickBooksSyncLog(): Promise<QuickBooksSyncLogEntry[]> {
  const client = sb();
  if (client) {
    const { data, error } = await client.from("quickbooks_sync_log").select("*").order("created_at", { ascending: false });
    if (!error && data) return data as QuickBooksSyncLogEntry[];
  }
  return [...getStore().quickbooksSyncLog].sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
}

/** Every meaningful QuickBooks action (connected, disconnected, customer
 * linked/created, estimate/invoice created/linked, sync run, webhook
 * processed) — logged HERE (the admin-only Sync Log detail view) as well
 * as to the existing `activity_log` at each call site above, per README
 * "QuickBooks Online Integration — Sync Log". */
export async function logQuickBooksSyncEvent(input: {
  action: string;
  project_id?: string;
  entity_type?: QuickBooksEntityType;
  qb_entity_id?: string;
  document_number?: string;
  success: boolean;
  error_detail?: string;
  initiated_by?: string;
}): Promise<void> {
  const record: QuickBooksSyncLogEntry = {
    id: randomUUID(),
    company_id: getCurrentCompanyId(),
    created_at: new Date().toISOString(),
    ...input,
  };
  const client = sb();
  if (client) {
    const { error } = await client.from("quickbooks_sync_log").insert(record);
    if (error) getStore().quickbooksSyncLog.unshift(record);
  } else {
    getStore().quickbooksSyncLog.unshift(record);
  }
}


// ---------------------------------------------------------------------
// EMAIL INTAKE (drawings / invoices forwarded from Gmail)
// ---------------------------------------------------------------------

export async function listInboundEmails(): Promise<InboundEmail[]> {
  const client = sb();
  if (client) {
    const { data, error } = await client.from("inbound_emails").select("*").order("received_at", { ascending: false });
    if (!error && data) return data as InboundEmail[];
  }
  return [...getStore().inboundEmails].sort((a, b) => b.received_at.localeCompare(a.received_at));
}

export async function createInboundEmail(input: Omit<InboundEmail, "id" | "company_id" | "created_at">): Promise<InboundEmail> {
  const record: InboundEmail = { id: randomUUID(), company_id: getCurrentCompanyId(), created_at: new Date().toISOString(), ...input };
  const client = sb();
  if (client) {
    const { error } = await client.from("inbound_emails").insert(record);
    if (error) throw error;
  } else {
    getStore().inboundEmails.push(record);
  }
  return record;
}

export async function updateInboundEmail(id: string, patch: Partial<Omit<InboundEmail, "id" | "company_id" | "created_at">>): Promise<void> {
  const client = sb();
  if (client) {
    const { error } = await client.from("inbound_emails").update(patch).eq("id", id);
    if (error) throw error;
  } else {
    const e = getStore().inboundEmails.find((x) => x.id === id);
    if (e) Object.assign(e, patch);
  }
}

/**
 * Files an inbound email onto a job: drawings become Drawings entries
 * (one per attachment), invoices become a Materials line with the file
 * attached plus an Invoice record. Logged to the job's history.
 */
export interface FileInboundOptions {
  kind: InboundKind;
  /** Required for drawings; optional for invoices (supplier-only when empty). */
  projectId?: string | null;
  supplier?: string;
  amount?: number | null;
  invoiceDate?: string; // YYYY-MM-DD
}

/**
 * Files a forwarded email. A drawing goes onto the job's Drawings; an
 * invoice becomes ONE materials line (the single spend record) under the
 * supplier, linked to a job only when one is given — never two records,
 * so it is never costed twice.
 */
export async function fileInboundEmail(id: string, opts: FileInboundOptions, actorName: string): Promise<void> {
  const email = (await listInboundEmails()).find((e) => e.id === id);
  if (!email) throw new Error("Email not found");
  const now = new Date().toISOString();
  const attachments = email.attachments.filter((a) => a.storage_path);
  const label = email.subject?.trim() || attachments[0]?.filename || "Email attachment";
  const sender = email.from_name?.trim() || email.from_email?.split("@")[0] || "email";
  const projectId = opts.projectId || null;

  if (opts.kind === "invoice") {
    const amount = opts.amount != null && Number.isFinite(opts.amount) ? Math.round(opts.amount * 100) / 100 : null;
    const supplier = opts.supplier?.trim() || email.from_name?.trim() || undefined;
    await createProjectMaterial({
      project_id: projectId,
      description: label,
      quantity: 1,
      unit: "invoice",
      unit_price: amount,
      cost: amount ?? 0,
      status: "Delivered",
      supplier,
      ordered_at: opts.invoiceDate ? new Date(opts.invoiceDate + "T12:00:00").toISOString() : email.received_at,
      notes: `Invoice emailed by ${email.from_email ?? "unknown sender"}`,
      invoice_path: attachments[0] ? `inbound-email:${attachments[0].storage_path}` : null,
      invoice_name: attachments[0]?.filename ?? null,
    });
  } else {
    if (!projectId) throw new Error("A drawing needs a job to file it on");
    for (const a of attachments) {
      await createProjectDrawing({
        project_id: projectId,
        drawing_name: a.filename.replace(/\.[a-z0-9]+$/i, ""),
        file_reference: `inbound-email:${a.storage_path}`,
        uploaded_by: `${sender} (email)`,
        notes: label !== a.filename ? `From email: ${label}` : undefined,
      });
    }
  }

  await updateInboundEmail(id, { status: "filed", filed_project_id: projectId, filed_kind: opts.kind, filed_by: actorName, filed_at: now });
  logActivity({
    action: opts.kind === "invoice" ? "Invoice filed from email" : "Drawing filed from email",
    related_type: projectId ? "project" : undefined,
    related_id: projectId ?? undefined,
    actor_name: actorName,
    detail: `${label} — ${attachments.length} file${attachments.length === 1 ? "" : "s"} from ${email.from_email ?? "unknown"}${opts.kind === "invoice" && !projectId ? " (supplier only, no job)" : ""}`,
  });
}

/** Link a materials/invoice line to a job (or unlink with null). Same record, so cost is never duplicated. */
export async function linkMaterialToProject(id: string, projectId: string | null, actorName: string): Promise<void> {
  const before = (await listProjectMaterials()).find((m) => m.id === id);
  if (!before) throw new Error("Invoice line not found");
  const client = sb();
  if (client) {
    const { error } = await client.from("project_materials").update({ project_id: projectId }).eq("id", id);
    if (error) throw error;
  } else {
    before.project_id = projectId;
  }
  logActivity({
    action: projectId ? "Invoice linked to job" : "Invoice unlinked from job",
    related_type: "project",
    related_id: projectId ?? before.project_id ?? undefined,
    actor_name: actorName,
    detail: `${before.description}${before.supplier ? ` (${before.supplier})` : ""} — $${before.cost}`,
  });
}
