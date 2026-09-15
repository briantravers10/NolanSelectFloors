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

// The 6 primary lifecycle stages a project moves through, entered once and
// updated on the SAME projects row (never duplicated per stage). This is
// separate from the more granular `ProjectStatus` above, which continues to
// track fine-grained sub-states (materials, punch list, invoicing, etc.)
// within these primary stages. See supabase/migrations/0002_bid_workflow.sql
// for the reconciliation notes.
export const PIPELINE_STAGES = [
  "Project Bid",
  "Bid Accepted",
  "Scheduled",
  "Sent to Crew",
  "Project In Process",
  "Project Completed",
] as const;
export type PipelineStage = (typeof PIPELINE_STAGES)[number];

export const BID_STATUSES = [
  "Unclaimed",
  "Claimed",
  "In Progress",
  "Ready for Review",
  "Completed/Sent",
  "Accepted",
  "Rejected",
] as const;
export type BidStatus = (typeof BID_STATUSES)[number];

export const OFFICE_USER_ROLES = ["estimator", "manager"] as const;
export type OfficeUserRole = (typeof OFFICE_USER_ROLES)[number];

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
  website?: string;
  ap_contact_name?: string;
  ap_contact_phone?: string;
  ap_contact_email?: string;
  relationship_start_date?: string;
  active?: boolean;
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

export const BUILDING_REGIONS = [
  "Manhattan",
  "Brooklyn",
  "Queens",
  "Bronx",
  "Staten Island",
  "New Jersey",
  "Long Island",
  "Other",
] as const;
export type BuildingRegion = (typeof BUILDING_REGIONS)[number];

export interface Building {
  id: string;
  company_id: string;
  client_company_id: string;
  name: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  region: BuildingRegion;
  latitude?: number | null;
  longitude?: number | null;
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
  // Optional suggested price saved from the Estimate Calculator (see
  // lib/pricing.ts), kept separate from `estimate_amount` (the amount
  // actually sent to the client) so a calculator save never overwrites it.
  estimated_value?: number;
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
  // Bid workflow / pipeline (see 0002_bid_workflow.sql)
  pipeline_stage: PipelineStage;
  bid_status: BidStatus;
  assigned_estimator_id?: string | null;
  claimed_at?: string | null;
  bid_claimed_at?: string | null;
  bid_completed_at?: string | null;
  bid_sent_at?: string | null;
  bid_accepted_at?: string | null;
  scheduled_at?: string | null;
  sent_to_crew_at?: string | null;
  project_started_at?: string | null;
  project_completed_at?: string | null;
}

export interface OfficeUser {
  id: string;
  company_id: string;
  full_name: string;
  email?: string;
  role: OfficeUserRole;
  active: boolean;
  created_at: string;
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
  // Reporting time for this specific worker on this specific day, shown in
  // the Send Schedule preview message. Nullable text (not a DB `time` type)
  // so it can hold free-form values like "7:00 AM" without timezone fuss.
  call_time?: string | null;
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

export const PHOTO_CATEGORIES = ["Before", "Progress", "After", "Floor Plan", "Other"] as const;
export type PhotoCategory = (typeof PHOTO_CATEGORIES)[number];

export interface PhotoRecord {
  id: string;
  company_id: string;
  related_type: RelatedRecordType;
  related_id: string;
  file_name: string;
  storage_path?: string;
  category?: PhotoCategory;
  caption?: string;
  taken_at?: string;
  uploaded_by?: string;
  // Set when an upload was attempted but photo storage wasn't configured —
  // the entry (caption/category/date) is still saved, just without an
  // image. See lib/storage.ts.
  storage_unavailable?: boolean;
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

// ---------------------------------------------------------------------
// PRICING & ESTIMATING FORMULAS (see supabase/migrations/0004_pricing_and_invoices.sql)
// ---------------------------------------------------------------------

export const MATERIAL_RATE_CATEGORIES = ["Material", "Underlayment", "Adhesive", "Trim", "Other"] as const;
export type MaterialRateCategory = (typeof MATERIAL_RATE_CATEGORIES)[number];

export interface MaterialRateItem {
  id: string;
  company_id: string;
  name: string;
  unit: string;
  unit_cost: number;
  supplier?: string;
  category: MaterialRateCategory;
  notes?: string;
  active: boolean;
  created_at: string;
}

export interface PricingFormula {
  id: string;
  company_id: string;
  name: string;
  work_type: WorkType;
  labor_rate_per_sqft?: number;
  markup_percent?: number;
  notes?: string;
  active: boolean;
  created_at: string;
}

export interface PricingFormulaComponent {
  id: string;
  company_id: string;
  formula_id: string;
  material_rate_item_id: string;
  quantity_per_unit_area: number;
  notes?: string;
  created_at: string;
}

// ---------------------------------------------------------------------
// INVOICES & EMAIL ROUTING RULES (foundation for a future Gmail-based
// assistant — see README "Email Assistant & Invoice Routing")
// ---------------------------------------------------------------------

export const INVOICE_STATUSES = ["Needed", "Received", "Filed", "Paid", "Disputed"] as const;
export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];

export const INVOICE_SOURCES = ["Manual Entry", "Email Auto-Routed"] as const;
export type InvoiceSource = (typeof INVOICE_SOURCES)[number];

export interface Invoice {
  id: string;
  company_id: string;
  supplier: string;
  amount?: number;
  invoice_date?: string;
  due_date?: string;
  related_project_id?: string;
  related_building_id?: string;
  status: InvoiceStatus;
  source: InvoiceSource;
  file_reference?: string;
  notes?: string;
  created_at: string;
}

export const EMAIL_ROUTING_ACTIONS = ["File As Invoice", "Flag For Calendar", "Flag For Review", "Ignore"] as const;
export type EmailRoutingAction = (typeof EMAIL_ROUTING_ACTIONS)[number];

export const EMAIL_ROUTING_BY = ["Supplier", "Building Address", "Manual/Case-by-Case"] as const;
export type EmailRoutingBy = (typeof EMAIL_ROUTING_BY)[number];

export interface EmailRoutingRule {
  id: string;
  company_id: string;
  keyword: string;
  action_type: EmailRoutingAction;
  route_by: EmailRoutingBy;
  active: boolean;
  notes?: string;
  created_at: string;
}
