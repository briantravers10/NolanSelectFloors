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
  ProjectMaterial,
  ProjectNote,
  ProjectScheduleDay,
  ProjectStatus,
  ProjectWorkType,
  ScheduleAssignment,
  StaffCapability,
  Task,
  TaskStatus,
  WorkTypeRecord,
} from "./types";

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
    id: `ct-${randomUUID()}`,
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
    id: `wt-${randomUUID()}`,
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
    id: `psd-${randomUUID()}`,
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
  const client = sb();
  if (client) {
    const { data, error } = await client.from("project_schedule_days").insert(record).select().single();
    if (error) throw error;
    return data as ProjectScheduleDay;
  }
  getStore().projectScheduleDays.push(record);
  return record;
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

  if (patch.job_status) {
    await updateProjectPipelineStage(before.project_id, mapJobStatusToPipelineStage(patch.job_status));
  }

  return client ? { ...before, ...fullPatch } as ProjectScheduleDay : before;
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
  const record: ActualLaborEntry = {
    id: `al-${randomUUID()}`,
    company_id: getCurrentCompanyId(),
    employee_id: input.employee_id,
    project_id: input.project_id,
    work_date: input.work_date,
    hours: input.hours,
    start_time: input.start_time,
    end_time: input.end_time,
    notes: input.notes,
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
  const employee = (await listEmployees()).find((e) => e.id === input.employee_id);
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
  const record: DailyScheduleConfirmation = { id: `dsc-${randomUUID()}`, company_id: getCurrentCompanyId(), work_date: workDate, confirmed_by: actorName, confirmed_at: now, notes };
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
    id: `mri-${randomUUID()}`,
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
    id: `pf-${randomUUID()}`,
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
    id: `pfc-${randomUUID()}`,
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
    id: `inv-${randomUUID()}`,
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
    id: `err-${randomUUID()}`,
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
    id: `act-${randomUUID()}`,
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
    id: `jr-${randomUUID()}`,
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
  const building = store.buildings.find((b) => b.id === jr.building_id);
  const now = new Date().toISOString();
  const project: Project = {
    id: `p-${randomUUID()}`,
    company_id: getCurrentCompanyId(),
    building_id: jr.building_id,
    job_request_id: jr.id,
    unit_number: jr.unit_number,
    name: overrides?.name ?? `${building?.name ?? "Building"}${jr.unit_number ? " — Unit " + jr.unit_number : ""}`,
    description: jr.description,
    status: "Approved",
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
 * "Convert to Project" — used from an already-approved/ready job request.
 * The bid is treated as already accepted (that approval happened at the
 * job-request stage), so the new project row starts at pipeline_stage
 * "Bid Accepted" with bid_status "Accepted".
 */
export async function convertJobRequestToProject(
  jobRequestId: string,
  overrides?: Partial<Pick<Project, "name" | "project_value" | "start_date" | "target_end_date" | "needs_transportation">>
): Promise<Project> {
  const jr = getStore().jobRequests.find((j) => j.id === jobRequestId);
  if (!jr) throw new Error("Job request not found");
  const project = await insertProjectFromJobRequest(jr, overrides, "Bid Accepted", "Accepted");
  logActivity({ action: "Converted job request to project", related_type: "project", related_id: project.id, detail: `From job request ${jobRequestId} — bid accepted` });
  return project;
}

/**
 * "Create Bid" — used from an earlier-stage job request that still needs
 * to be estimated. Creates the SAME kind of project row, but starts it
 * unclaimed at pipeline_stage "Project Bid" so it shows up on the Bid
 * Dashboard for an estimator to claim.
 */
export async function createBidFromJobRequest(jobRequestId: string): Promise<Project> {
  const jr = getStore().jobRequests.find((j) => j.id === jobRequestId);
  if (!jr) throw new Error("Job request not found");
  const project = await insertProjectFromJobRequest(jr, undefined, "Project Bid", "Unclaimed");
  logActivity({ action: "Created bid", related_type: "project", related_id: project.id, detail: `From job request ${jobRequestId} — unclaimed, awaiting an estimator` });
  return project;
}

export async function updateProjectStatus(id: string, status: ProjectStatus): Promise<void> {
  const client = sb();
  const now = new Date().toISOString();
  if (client) {
    const { error } = await client.from("projects").update({ status, updated_at: now }).eq("id", id);
    if (error) throw error;
  } else {
    const project = getStore().projects.find((p) => p.id === id);
    if (project) {
      project.status = status;
      project.updated_at = now;
    }
  }
  logActivity({ action: `Project status changed to ${status}`, related_type: "project", related_id: id });
}

// ---------------------------------------------------------------------
// BID WORKFLOW: pipeline stage, bid status, atomic claiming, reassignment
// ---------------------------------------------------------------------

// Which set-once lifecycle timestamp column a pipeline_stage transition
// stamps, the first time a project reaches it. Never overwritten on a
// later re-visit (e.g. moving back and forth), which is what keeps these
// columns usable for future turnaround/duration reporting.
const STAGE_TIMESTAMP_FIELD: Partial<Record<PipelineStage, keyof Project>> = {
  Scheduled: "scheduled_at",
  "Sent to Crew": "sent_to_crew_at",
  "Project In Process": "project_started_at",
  "Project Completed": "project_completed_at",
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
    if (p.pipeline_stage === "Project Completed") continue;
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
  const employee = store.employees.find((e) => e.id === input.employee_id);
  if (!employee) throw new Error("Employee not found");
  const rate_multiplier = input.time_and_half ? 1.5 : 1.0;
  const record: ScheduleAssignment = {
    id: `sa-${randomUUID()}`,
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

export async function createProjectCrewRequirement(input: {
  project_id: string;
  schedule_date?: string | null;
  role: StaffCapability;
  quantity: number;
}): Promise<ProjectCrewRequirement> {
  const record: ProjectCrewRequirement = {
    id: `pcr-${randomUUID()}`,
    company_id: getCurrentCompanyId(),
    project_id: input.project_id,
    schedule_date: input.schedule_date ?? null,
    role: input.role,
    quantity: input.quantity,
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
    id: `pm-${randomUUID()}`,
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
    id: `t-${randomUUID()}`,
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
    id: `lead-${randomUUID()}`,
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
  const lead = store.newBusinessLeads.find((l) => l.id === leadId);
  if (!lead) throw new Error("Lead not found");
  const now = new Date().toISOString();
  const client_company: ClientCompany = {
    id: `cc-${randomUUID()}`,
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
    id: `pn-${randomUUID()}`,
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
    id: `e-${randomUUID()}`,
    company_id: getCurrentCompanyId(),
    created_at: new Date().toISOString(),
    ...rest,
  };
  const client = sb();
  if (client) {
    const { error } = await client.from("employees").insert(record);
    if (error) throw error;
    if (capabilities && capabilities.length > 0) {
      const rows = capabilities.map((capability) => ({ id: `es-${randomUUID()}`, employee_id: record.id, capability }));
      await client.from("employee_skills").insert(rows);
    }
  } else {
    getStore().employees.push(record);
    for (const capability of capabilities ?? []) {
      getStore().employeeSkills.push({ id: `es-${randomUUID()}`, employee_id: record.id, capability });
    }
  }
  logActivity({ action: "Added staff member", related_type: "employee", related_id: record.id, detail: `${record.first_name} ${record.last_name}` });
  return record;
}

export async function createClientCompanyRecord(input: Omit<ClientCompany, "id" | "company_id" | "created_at">): Promise<ClientCompany> {
  const record: ClientCompany = {
    id: `cc-${randomUUID()}`,
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

export async function createBuildingRecord(input: Omit<Building, "id" | "company_id" | "created_at">): Promise<Building> {
  const record: Building = {
    id: `b-${randomUUID()}`,
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
  caption?: string;
  taken_at?: string;
  uploaded_by?: string;
  storage_unavailable?: boolean;
}): Promise<PhotoRecord> {
  const record: PhotoRecord = {
    id: `ph-${randomUUID()}`,
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
  logActivity({ action: "Added progress photo entry", related_type: input.related_type, related_id: input.related_id, detail: input.caption });
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
        id: `csa-${randomUUID()}`,
        company_id: getCurrentCompanyId(),
        section,
        question_key: questionKey,
        answer,
        updated_at: now,
      });
    }
  }
}
