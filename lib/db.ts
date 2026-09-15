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
import type {
  ActivityLogEntry,
  Building,
  BuildingContact,
  ClientCompany,
  Communication,
  CompanySetupAnswer,
  Contact,
  DocumentRecord,
  Employee,
  EmployeeAvailability,
  EmployeeSkill,
  JobRequest,
  JobRequestStatus,
  Material,
  NewBusinessLead,
  PhotoRecord,
  Project,
  ProjectCrewRequirement,
  ProjectMaterial,
  ProjectNote,
  ProjectStatus,
  ProjectWorkType,
  ScheduleAssignment,
  StaffCapability,
  Task,
  TaskStatus,
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
// WRITES
// ---------------------------------------------------------------------

function logActivity(entry: Omit<ActivityLogEntry, "id" | "company_id" | "created_at">) {
  const store = getStore();
  store.activityLog.unshift({
    id: `act-${randomUUID()}`,
    company_id: getCurrentCompanyId(),
    created_at: new Date().toISOString(),
    ...entry,
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

export async function convertJobRequestToProject(
  jobRequestId: string,
  overrides?: Partial<Pick<Project, "name" | "project_value" | "start_date" | "target_end_date" | "needs_transportation">>
): Promise<Project> {
  const store = getStore();
  const jr = store.jobRequests.find((j) => j.id === jobRequestId);
  if (!jr) throw new Error("Job request not found");
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
  };
  const client = sb();
  if (client) {
    const { error } = await client.from("projects").insert(project);
    if (error) throw error;
    await client.from("job_requests").update({ status: "Converted to Project", converted_project_id: project.id, updated_at: now }).eq("id", jobRequestId);
  } else {
    store.projects.push(project);
    jr.status = "Converted to Project";
    jr.converted_project_id = project.id;
    jr.updated_at = now;
  }
  logActivity({ action: "Converted job request to project", related_type: "project", related_id: project.id, detail: `From job request ${jobRequestId}` });
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

export async function createScheduleAssignment(input: {
  project_id: string;
  employee_id: string;
  schedule_date: string;
  role_on_job: StaffCapability;
  time_and_half: boolean;
  notes?: string;
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
    detail: `${employee.first_name} ${employee.last_name} on ${input.schedule_date} as ${input.role_on_job}`,
  });
  return record;
}

export async function deleteScheduleAssignment(id: string): Promise<void> {
  const client = sb();
  if (client) {
    const { error } = await client.from("schedule_assignments").delete().eq("id", id);
    if (error) throw error;
  } else {
    const store = getStore();
    const idx = store.scheduleAssignments.findIndex((a) => a.id === id);
    if (idx >= 0) store.scheduleAssignments.splice(idx, 1);
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
