// Core data model. These types mirror supabase/migrations/0001_init.sql
// column-for-column so the seed-data fallback and a live Supabase project
// can share the exact same shapes.

export type UserRole =
  | "platform_admin"
  | "company_owner"
  | "manager"
  | "office_staff"
  | "field_worker";

export const CONTACT_ROLES = [
  "Property Manager",
  "Assistant Property Manager",
  "Building Manager",
  "Superintendent",
  "Facilities Manager",
  "Regional Manager",
  "Accounts Payable",
  "Owner",
  "Other",
] as const;
export type ContactRole = (typeof CONTACT_ROLES)[number];

export const JOB_REQUEST_STATUSES = [
  "New Request",
  "Site Visit Required",
  "Site Visit Scheduled",
  "Estimate Required",
  "Estimate Sent",
  "Awaiting Approval",
  "Approved",
  "Ready to Schedule",
  "Converted to Project",
  "Declined",
  "Cancelled",
] as const;
export type JobRequestStatus = (typeof JOB_REQUEST_STATUSES)[number];

export const PROJECT_STATUSES = [
  "Approved",
  "Pre-Construction",
  "Materials Required",
  "Materials Ordered",
  "Materials Ready",
  "Ready to Schedule",
  "Scheduled",
  "In Progress",
  "Paused",
  "Punch List",
  "Completed",
  "Invoiced",
  "Paid",
] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

export const WORK_TYPES = [
  "Hardwood Installation",
  "Floor Sanding",
  "Staining",
  "Finishing",
  "LVP Installation",
  "Laminate Installation",
  "Carpet Installation",
  "Tile",
  "Demolition",
  "Floor Preparation",
  "Subfloor Repair",
  "Baseboard/Trim",
  "Furniture Moving",
  "Repairs",
  "Other",
] as const;
export type WorkType = (typeof WORK_TYPES)[number];

export const STAFF_CAPABILITIES = [
  "Installer",
  "Sander",
  "Finisher",
  "Staining",
  "Hardwood",
  "LVP",
  "Laminate",
  "Carpet",
  "Tile",
  "Demolition",
  "Floor Prep",
  "Subfloor Repair",
  "Baseboard/Trim",
  "Laborer",
  "Furniture Moving",
  "Delivery/Pickup",
  "Driver",
  "Supervisor/Foreman",
] as const;
export type StaffCapability = (typeof STAFF_CAPABILITIES)[number];

export const AVAILABILITY_STATUSES = [
  "working",
  "available",
  "day_off",
  "vacation",
  "unavailable",
] as const;
export type AvailabilityStatus = (typeof AVAILABILITY_STATUSES)[number];

export const MATERIAL_STATUSES = [
  "Needed",
  "Quote Requested",
  "Ordered",
  "Partially Delivered",
  "Delivered",
  "Problem",
  "Returned",
] as const;
export type MaterialStatus = (typeof MATERIAL_STATUSES)[number];

export const TASK_STATUSES = ["To Do", "In Progress", "Waiting", "Completed"] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const LEAD_STATUSES = ["New", "Contacted", "Site Visit", "Estimate", "Follow Up", "Won", "Lost"] as const;
export type LeadStatus = (typeof LEAD_STATUSES)[number];

export type RelatedRecordType =
  | "client_company"
  | "building"
  | "job_request"
  | "project"
  | "employee"
  | "lead";

export interface Company {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  address?: string;
  logo_url?: string;
  created_at: string;
}

export interface User {
  id: string;
  company_id: string;
  email: string;
  full_name: string;
  role: UserRole;
  phone?: string;
  active: boolean;
  created_at: string;
}

export interface ClientCompany {
  id: string;
  company_id: string;
  name: string;
  type: string;
  phone?: string;
  email?: string;
  address?: string;
  billing_notes?: string;
  notes?: string;
  created_at: string;
}

export interface Contact {
  id: string;
  company_id: string;
  client_company_id?: string;
  first_name: string;
  last_name: string;
  title?: string;
  phone?: string;
  mobile_phone?: string;
  email?: string;
  notes?: string;
  created_at: string;
}

export interface Building {
  id: string;
  company_id: string;
  client_company_id: string;
  name: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  primary_contact_id?: string;
  superintendent_name?: string;
  superintendent_phone?: string;
  access_instructions?: string;
  working_hours?: string;
  coi_requirements?: string;
  parking_loading?: string;
  elevator_info?: string;
  delivery_instructions?: string;
  building_rules?: string;
  notes?: string;
  active: boolean;
  created_at: string;
}

export interface BuildingContact {
  id: string;
  building_id: string;
  contact_id: string;
  role: ContactRole;
  is_primary: boolean;
}

export interface JobRequest {
  id: string;
  company_id: string;
  building_id: string;
  contact_id?: string;
  unit_number?: string;
  description: string;
  status: JobRequestStatus;
  received_via?: string;
  received_at: string;
  site_visit_date?: string;
  estimate_amount?: number;
  estimate_sent_at?: string;
  approved_at?: string;
  converted_project_id?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface Project {
  id: string;
  company_id: string;
  building_id: string;
  job_request_id?: string;
  unit_number?: string;
  name: string;
  description?: string;
  status: ProjectStatus;
  project_value: number;
  other_cost: number;
  needs_transportation: boolean;
  start_date?: string;
  target_end_date?: string;
  actual_end_date?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface ProjectWorkType {
  id: string;
  project_id: string;
  work_type: WorkType;
}

export interface Employee {
  id: string;
  company_id: string;
  first_name: string;
  last_name: string;
  title: string;
  phone?: string;
  email?: string;
  day_rate: number;
  is_driver: boolean;
  active: boolean;
  hire_date?: string;
  notes?: string;
  created_at: string;
}

export interface EmployeeSkill {
  id: string;
  employee_id: string;
  capability: StaffCapability;
}

export interface EmployeeAvailability {
  id: string;
  employee_id: string;
  schedule_date: string;
  status: AvailabilityStatus;
  notes?: string;
}

export interface ProjectCrewRequirement {
  id: string;
  company_id: string;
  project_id: string;
  schedule_date?: string | null;
  role: StaffCapability;
  quantity: number;
}

export interface ScheduleAssignment {
  id: string;
  company_id: string;
  project_id: string;
  employee_id: string;
  schedule_date: string;
  role_on_job: StaffCapability;
  base_day_rate: number;
  rate_multiplier: number;
  time_and_half: boolean;
  assignment_cost: number;
  notes?: string;
  created_at: string;
}

export interface Material {
  id: string;
  company_id: string;
  name: string;
  category?: string;
  supplier?: string;
  unit?: string;
  created_at: string;
}

export interface ProjectMaterial {
  id: string;
  company_id: string;
  project_id: string;
  material_id?: string;
  description: string;
  quantity: number;
  unit?: string;
  cost: number;
  status: MaterialStatus;
  supplier?: string;
  ordered_at?: string;
  expected_delivery?: string;
  delivered_at?: string;
  notes?: string;
  created_at: string;
}

export interface Task {
  id: string;
  company_id: string;
  title: string;
  description?: string;
  related_type?: RelatedRecordType;
  related_id?: string;
  assigned_to?: string;
  due_date?: string;
  status: TaskStatus;
  created_at: string;
  updated_at: string;
}

export interface Communication {
  id: string;
  company_id: string;
  related_type: RelatedRecordType;
  related_id: string;
  contact_id?: string;
  direction: "inbound" | "outbound";
  channel: "phone" | "email" | "text" | "in-person";
  summary: string;
  occurred_at: string;
  created_at: string;
}

export interface ProjectNote {
  id: string;
  company_id: string;
  project_id: string;
  author_name?: string;
  body: string;
  created_at: string;
}

export interface DocumentRecord {
  id: string;
  company_id: string;
  related_type: RelatedRecordType;
  related_id: string;
  file_name: string;
  storage_path?: string;
  content_type?: string;
  size_bytes?: number;
  uploaded_by?: string;
  created_at: string;
}

export interface PhotoRecord {
  id: string;
  company_id: string;
  related_type: RelatedRecordType;
  related_id: string;
  file_name: string;
  storage_path?: string;
  caption?: string;
  taken_at?: string;
  uploaded_by?: string;
  created_at: string;
}

export interface NewBusinessLead {
  id: string;
  company_id: string;
  company_name: string;
  contact_name?: string;
  phone?: string;
  email?: string;
  source?: string;
  status: LeadStatus;
  estimated_value?: number;
  notes?: string;
  converted_client_company_id?: string;
  created_at: string;
  updated_at: string;
}

export interface ActivityLogEntry {
  id: string;
  company_id: string;
  actor_name?: string;
  action: string;
  related_type?: RelatedRecordType;
  related_id?: string;
  detail?: string;
  created_at: string;
}

export interface CompanySetupAnswer {
  id: string;
  company_id: string;
  section: string;
  question_key: string;
  answer: string;
  updated_at: string;
}
