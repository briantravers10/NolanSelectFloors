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
  "In Progress",
  "Archived",
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

// ---------------------------------------------------------------------
// PROJECT PIPELINE STAGE — simplified to 5 values per the client's own
// words: "When a project is started, all i need is bid send, bid accepted,
// scheduled, in progress and then complete. I dont need any more info on
// the status of the job." (build 9, see
// supabase/migrations/0010_simplify_project_status.sql and README "Project
// Pipeline Stage Simplification"). This REPLACES the old 6-stage
// PIPELINE_STAGES ("Project Bid" -> ... -> "Project Completed") AND the old
// 13-value `ProjectStatus`/`PROJECT_STATUSES` detailed-status enum, which
// both previously lived on this same `projects` row — see the migration
// and README for exactly how the old values map onto these 5 and why the
// old `status` column was dropped rather than kept-but-hidden.
// ---------------------------------------------------------------------
export const PIPELINE_STAGES = ["Bid Sent", "Bid Accepted", "Scheduled", "In Progress", "Complete"] as const;
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

// Labor-cost / pay-rate visibility permission tier — deliberately SEPARATE
// from `OfficeUserRole` above (estimator/manager), which only governs the
// bid-claim workflow. See supabase/migrations/0006_labor_cost_tracking.sql
// and README "Labor Cost Tracking — Access Control" for the mapping:
//   owner_admin     — full access: view AND edit pay rates / labor costs
//   office_staff    — view-only access to pay rates / labor costs
//   field_employee  — no access; rate/cost figures are hidden entirely
export const ACCESS_ROLES = ["owner_admin", "office_staff", "field_employee"] as const;
export type AccessRole = (typeof ACCESS_ROLES)[number];

// ---------------------------------------------------------------------
// PER-SECTION PERMISSIONS (build 11) — see lib/permissions.ts and README
// "Permissions & Staff Access". This is the NEW fine-grained layer the
// client asked for ("some project managers only need to be able to see
// and/or edit certain things"), additive on top of (not a replacement
// for) the ACCESS_ROLES tier above — see README for exactly how the two
// relate. One SectionKey per real nav destination in
// components/nav-items.ts, plus `quickbooks` (a sub-route of Company
// Setup with its own existing access_role gate — see lib/current-user.ts
// canViewQuickBooks — that section_permissions now ALSO covers at the
// nav/route level).
// ---------------------------------------------------------------------
export const SECTION_KEYS = [
  "dashboard",
  "clients",
  "buildings",
  "job_requests",
  "projects",
  "schedule",
  "staff",
  "materials",
  "pricing",
  "invoices",
  "reports",
  "company_setup",
  "quickbooks",
] as const;
export type SectionKey = (typeof SECTION_KEYS)[number];

export const SECTION_LABELS: Record<SectionKey, string> = {
  dashboard: "Dashboard",
  clients: "Clients",
  buildings: "Buildings",
  job_requests: "Job Requests",
  projects: "Projects",
  schedule: "Schedule",
  staff: "Staff",
  materials: "Materials",
  pricing: "Pricing",
  invoices: "Invoices",
  reports: "Reports",
  company_setup: "Company Setup",
  quickbooks: "QuickBooks",
};

export const SECTION_ACCESS_LEVELS = ["none", "view", "edit"] as const;
export type SectionAccessLevel = (typeof SECTION_ACCESS_LEVELS)[number];

export interface SectionPermission {
  id: string;
  company_id: string;
  office_user_id: string;
  section_key: SectionKey;
  access_level: SectionAccessLevel;
  updated_by?: string;
  updated_at: string;
}

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
  | "lead"
  | "office_user"
  | "section_permission";

export interface Company {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  address?: string;
  logo_url?: string;
  /** Shared code staff enter with their email to set their own password on
   * first login (/login → "Set up my password"). Owner-managed. */
  staff_setup_code?: string | null;
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
  // Main point of contact at the management company — a contacts row
  // (client_company_id = this client) so it also appears under Contacts.
  main_contact_id?: string;
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
  // Who hit "Start job" (office_users.id + name snapshot) and when — the
  // request shows as In Progress under their name until the job's created.
  started_by_user_id?: string | null;
  started_by_name?: string | null;
  started_at?: string | null;
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
  // "Invoice Sent" — reminder on every dashboard for a completed job
  // until someone marks it (migration 0025).
  invoice_sent_at?: string | null;
  invoice_sent_by?: string | null;
}

export interface OfficeUser {
  id: string;
  company_id: string;
  full_name: string;
  email?: string;
  role: OfficeUserRole;
  // See ACCESS_ROLES above — the permission boundary for pay rates /
  // labor-cost dollar figures. Added in 0006_labor_cost_tracking.sql.
  access_role: AccessRole;
  active: boolean;
  created_at: string;
  // --- build 11: real-auth readiness + Owner flag, see
  // supabase/migrations/0012_permissions_and_auth.sql and README
  // "Permissions & Staff Access" ---
  // Null until a real Supabase Auth user exists for this person (demo
  // mode — see lib/auth.ts). Will hold that Supabase Auth user's id once
  // "Add Staff Account" creates a real account.
  auth_user_id?: string | null;
  // Owner/Admin gets unrestricted access to every section always, per the
  // client's own description of how his friend's access works — NOT
  // subject to the section_permissions grid. Only another is_owner user
  // (or the hardcoded owner/manager acting-user sentinel) can grant this.
  is_owner: boolean;
}

export interface ProjectWorkType {
  id: string;
  project_id: string;
  work_type: WorkType;
}

// Pay type for the ACTUAL-hours labor-cost system (build 6) — see
// README "Labor Cost Tracking". Separate from the PLANNED-cost system
// still driven by `day_rate` below (used to snapshot
// schedule_assignments.base_day_rate) — both are kept, see README
// "Reconciling planned vs. actual labor cost".
export const PAY_TYPES = ["daily", "hourly"] as const;
export type PayType = (typeof PAY_TYPES)[number];

// Tax/payroll classification: W-4 = payroll employee (withholding), 1099 =
// independent contractor. Optional so existing rows are "not set" until
// the office fills it in.
export const TAX_STATUSES = ["W-4", "1099"] as const;
export type TaxStatus = (typeof TAX_STATUSES)[number];

export interface Employee {
  id: string;
  company_id: string;
  first_name: string;
  last_name: string;
  title: string;
  phone?: string;
  email?: string;
  // PLANNED-cost system (builds 1-2) — unchanged. Still the source for
  // schedule_assignments.base_day_rate. Left in place; do not remove.
  day_rate: number;
  // ACTUAL-cost system (build 6). Whichever field applies to `pay_type` is
  // the one that matters; the other is typically left unset/0.
  pay_type: PayType;
  daily_rate?: number;
  hourly_rate?: number;
  is_driver: boolean;
  active: boolean;
  hire_date?: string;
  notes?: string;
  tax_status?: TaxStatus;
  // What the crew actually call them — searchable in the crew picker and
  // shown in brackets after the full name on the schedule.
  nickname?: string;
  created_at: string;
  // ANNUAL time-off allowance (build 7, Vacation & Sick Day Tracker) — per
  // employee, NOT a flat company-wide number. Nullable: unset means "not
  // tracked yet", not "zero allowed". See README.
  vacation_days_allowed?: number;
  sick_days_allowed?: number;
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

// ---------------------------------------------------------------------
// VACATION & SICK DAY TRACKER (build 7, see
// supabase/migrations/0007_time_off.sql and README "Vacation & Sick Day
// Tracker" for why this is a NEW table rather than an extension of
// `EmployeeAvailability` above).
// ---------------------------------------------------------------------

export const TIME_OFF_TYPES = ["Vacation", "Sick", "Personal", "Unpaid"] as const;
export type TimeOffType = (typeof TIME_OFF_TYPES)[number];

/**
 * A simple day-off LOG entry — a single day is start_date === end_date.
 * Deliberately NOT an accrual/balance system: no "days remaining" concept
 * is tracked here or anywhere else. See README.
 */
export interface TimeOffEntry {
  id: string;
  company_id: string;
  employee_id: string;
  start_date: string;
  end_date: string;
  type: TimeOffType;
  notes?: string;
  created_by?: string;
  created_at: string;
  updated_by?: string;
  updated_at: string;
}

export interface ProjectCrewRequirement {
  id: string;
  company_id: string;
  project_id: string;
  schedule_date?: string | null;
  role: StaffCapability;
  quantity: number;
  // Estimating: the specific people pencilled in for this role (their
  // day rates drive the labor estimate) and how many days.
  employee_ids?: string[];
  estimated_days?: number | null;
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
  // Price per unit; `cost` = quantity × unit_price (kept as the stored
  // total so older rows and reports keep working).
  unit_price?: number | null;
  cost: number;
  status: MaterialStatus;
  supplier?: string;
  // Optional invoice/receipt file in Supabase Storage.
  invoice_path?: string | null;
  invoice_name?: string | null;
  // Set when this line was created from a schedule "item to collect".
  pickup_item_id?: string | null;
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

/**
 * Procore-inspired "Photos" tool (build 9, see
 * supabase/migrations/0010_simplify_project_status.sql and README "Photos &
 * Drawings"). `category` doubles as the album a photo is grouped into on
 * the gallery grid (Before/Progress/After/Floor Plan/Other) — a separate
 * `album` column was deliberately NOT added since `category` already
 * expresses exactly that grouping; see README for the reasoning. `title` is
 * a new, explicitly OPTIONAL short label shown above the (also optional)
 * longer `caption`/note — per the client's own words: "photos with titles
 * on them (optional)".
 */
export interface PhotoRecord {
  id: string;
  company_id: string;
  related_type: RelatedRecordType;
  related_id: string;
  file_name: string;
  storage_path?: string;
  category?: PhotoCategory;
  title?: string;
  caption?: string;
  taken_at?: string;
  uploaded_by?: string;
  // Set when an upload was attempted but photo storage wasn't configured —
  // the entry (caption/category/date) is still saved, just without an
  // image. See lib/storage.ts.
  storage_unavailable?: boolean;
  created_at: string;
}

// ---------------------------------------------------------------------
// DRAWINGS (build 9) — Procore-inspired "Drawings" tool: a project's plan
// files with version history. See supabase/migrations/0010_simplify_project_status.sql
// and README "Photos & Drawings" for the full write-up. A new drawing
// (matched by drawing_name, optionally + drawing_number) starts at version
// 1 with is_current_version = true. Uploading a new version of an EXISTING
// drawing inserts a NEW row at version+1 with is_current_version = true and
// flips the previous current row's is_current_version to false — the old
// row is never deleted, so full version history stays available.
// ---------------------------------------------------------------------
export interface ProjectDrawing {
  id: string;
  company_id: string;
  project_id: string;
  drawing_name: string;
  drawing_number?: string;
  version: number;
  file_reference?: string;
  is_current_version: boolean;
  uploaded_by?: string;
  uploaded_at: string;
  notes?: string;
  // Same soft-fail storage pattern as PhotoRecord.storage_unavailable — set
  // when an upload was attempted but file storage wasn't configured. See
  // lib/storage.ts.
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

// ---------------------------------------------------------------------
// SCHEDULE REDESIGN (see supabase/migrations/0005_schedule_redesign.sql
// and README "Schedule Redesign")
// ---------------------------------------------------------------------

/** Schedule-facing work type lookup — editable (add/rename/deactivate)
 * from Company Setup, independent of the existing `WORK_TYPES` enum used
 * by project_work_types/pricing_formulas (see README for why). */
export interface WorkTypeRecord {
  id: string;
  company_id: string;
  name: string;
  active: boolean;
  created_at: string;
}

// Sort/display priority order: Yellow first, then Blue, Gray, Pink.
export const SCHEDULE_COLORS = ["Yellow", "Blue", "Gray", "Pink"] as const;
export type ScheduleColor = (typeof SCHEDULE_COLORS)[number];

export const COI_STATUSES = ["Not Sent", "Sent", "In Progress", "Approved"] as const;
export type CoiStatus = (typeof COI_STATUSES)[number];

/** Deliberately coarser than `MaterialStatus` — a quick-glance rollup for
 * the schedule row, not a replacement for the detailed per-material
 * statuses on the Materials feature. See README. */
export const SCHEDULE_MATERIALS_STATUSES = ["Not Ordered", "Ordered", "Sent/Delivered"] as const;
export type ScheduleMaterialsStatus = (typeof SCHEDULE_MATERIALS_STATUSES)[number];

/** Separate from `ProjectStatus`/`PipelineStage`. Setting this from the
 * Schedule always updates the real `projects.pipeline_stage` too — see
 * lib/schedule.ts mapJobStatusToPipelineStage / README. */
export const SCHEDULE_JOB_STATUSES = ["Scheduled", "In Progress", "Complete"] as const;
export type ScheduleJobStatus = (typeof SCHEDULE_JOB_STATUSES)[number];

/**
 * The "one row per job per day" entity the Daily schedule list actually
 * renders — one per project_id + schedule_date. `schedule_assignments`
 * (per-employee planned crew) sits underneath this, unchanged.
 */
export interface ProjectScheduleDay {
  id: string;
  company_id: string;
  project_id: string;
  schedule_date: string;
  schedule_color: ScheduleColor;
  coi_status: CoiStatus;
  materials_status: ScheduleMaterialsStatus;
  job_status: ScheduleJobStatus;
  work_type_id?: string | null;
  notes?: string;
  // Manual position within the colour group (drag to rearrange on
  // Create/Edit Schedule). Colour priority always comes first.
  sort_order?: number | null;
  created_by?: string;
  updated_by?: string;
  created_at: string;
  updated_at: string;
}

export const SCHEDULE_PICKUP_STATUSES = ["Needed", "Collected"] as const;
export type SchedulePickupStatus = (typeof SCHEDULE_PICKUP_STATUSES)[number];

/**
 * "Items to Order / Collect" — a lightweight, per-schedule-entry checklist
 * (build 8), e.g. "3 buckets of glue" or "pick up dumpster key from super".
 * Deliberately NOT the heavier `project_materials`/`Material` system (which
 * tracks supplier/cost/delivery-date at the project level) — see README.
 * One free-text `description` (the quantity, if any, is typed right into
 * it) and a two-value status are enough for a quick "grab this" list.
 */
export interface SchedulePickupItem {
  id: string;
  company_id: string;
  project_schedule_day_id: string;
  description: string;
  status: SchedulePickupStatus;
  // Optional price, set from the project page so the pickup counts toward
  // the job's materials cost (migration 0019).
  cost?: number | null;
  created_by?: string;
  updated_by?: string;
  created_at: string;
  updated_at: string;
}

/**
 * Actual hours worked — separate from the planned `schedule_assignments`
 * rows. An employee can have multiple entries on the same day across
 * different jobs. Never overwrites the planned schedule.
 */
export interface ActualLaborEntry {
  id: string;
  company_id: string;
  employee_id: string;
  project_id: string;
  work_date: string;
  hours: number;
  start_time?: string;
  end_time?: string;
  notes?: string;
  // HISTORICAL PAY RATE ACCURACY: snapshotted from the employee's pay_type
  // + applicable rate at the moment this entry is created — NEVER
  // recalculated from the employee's current rate later. A later raise (or
  // pay-type change) must not retroactively change an already-logged
  // entry's cost. See lib/labor-cost.ts and README.
  rate_type?: PayType;
  rate_amount?: number;
  created_by?: string;
  updated_by?: string;
  created_at: string;
  updated_at: string;
}

/** One row per (company, work_date) — "Confirm Day" from the End-of-Day
 * Review. Upsert-style; does NOT lock the day. */
export interface DailyScheduleConfirmation {
  id: string;
  company_id: string;
  work_date: string;
  confirmed_by: string;
  confirmed_at: string;
  notes?: string;
}

// ---------------------------------------------------------------------
// OWNER'S PERSONAL AGENDA (build 8, see
// supabase/migrations/0008_owner_agenda.sql). SEPARATE from the
// operational job Schedule above — this is the owner's own meetings, site
// visits and personal reminders. Architected for a future Google Calendar
// sync (see lib/google-calendar.ts and README "Owner's Agenda & Future
// Google Calendar Sync") but no live Google API call is made anywhere in
// this codebase yet.
// ---------------------------------------------------------------------

export const AGENDA_EVENT_SOURCES = ["Manual", "Google Calendar"] as const;
export type AgendaEventSource = (typeof AGENDA_EVENT_SOURCES)[number];

export interface AgendaEvent {
  id: string;
  company_id: string;
  /** office_users.id, or the OWNER_ACTING_ID sentinel "owner" — see
   * lib/current-user.ts. Plain text, not a foreign key, since there is no
   * users table yet. */
  owner_user_id: string;
  title: string;
  event_date: string;
  start_time?: string | null;
  end_time?: string | null;
  location?: string | null;
  notes?: string | null;
  related_type?: RelatedRecordType | null;
  related_id?: string | null;
  source: AgendaEventSource;
  // Ticked off (from My Agenda or End of Day Review); who added it, so
  // the office can fill the boss's agenda and he can see who asked.
  completed_at?: string | null;
  created_by_name?: string | null;
  /** Placeholder for a future Google Calendar event id, to prevent
   * duplicate sync inserts. Always null until real sync is built. */
  external_event_id?: string | null;
  created_at: string;
  updated_at: string;
}

// ---------------------------------------------------------------------
// QUICKBOOKS ONLINE INTEGRATION (build 10, see
// supabase/migrations/0011_quickbooks_integration.sql and
// lib/quickbooks.ts). QuickBooks is accounting (customers, estimates,
// invoices, payments); this app stays operational (jobs, schedule, crew,
// labor, COI, materials). Every QB document maps to an internal
// project/job via `quickbooks_documents` — a job can have MULTIPLE
// estimates and invoices (one-to-many), never a single
// estimate_number/invoice_number field on `projects`. Follows the exact
// "architected but not live" pattern as lib/routing.ts and
// lib/google-calendar.ts: every function here is safe to call with zero
// credentials configured, never throws, never fakes success.
// ---------------------------------------------------------------------

export const QUICKBOOKS_ENVIRONMENTS = ["sandbox", "production"] as const;
export type QuickBooksEnvironment = (typeof QUICKBOOKS_ENVIRONMENTS)[number];

/** One row per company per QuickBooks realm (company file) that has ever
 * been connected. `disconnected_at` set = not currently connected (kept,
 * rather than deleted, as connection history). access_token/refresh_token
 * are SERVER-SIDE ONLY — never read by a client component; see
 * lib/quickbooks.ts and README "Security". */
export interface QuickBooksConnection {
  id: string;
  company_id: string;
  realm_id: string;
  access_token: string;
  refresh_token: string;
  token_expires_at: string;
  environment: QuickBooksEnvironment;
  /** QuickBooks CompanyInfo.CompanyName, fetched right after connecting. */
  company_name?: string;
  connected_at: string;
  connected_by?: string;
  disconnected_at?: string | null;
  last_sync_at?: string | null;
  /** Set when a token refresh fails (revoked/expired auth) — surfaces the
   * "QuickBooks Connection Needs Attention" / "Reconnect" state without
   * ever throwing out of a page render. See lib/quickbooks.ts. */
  needs_reconnect?: boolean;
}

/** management_companies (client_companies in this app's schema) <->
 * QuickBooks Customer. Never created from a fuzzy match alone — always an
 * explicit [Link] / [Create New QuickBooks Customer] action. */
export interface QuickBooksCustomerMapping {
  id: string;
  company_id: string;
  client_company_id: string;
  qb_customer_id: string;
  qb_customer_name: string;
  linked_at: string;
  linked_by?: string;
}

/** A candidate QuickBooks customer surfaced by fuzzy name matching against
 * an internal client_company — "possible match" only, never auto-linked.
 * See lib/quickbooks.ts findCustomerMatchCandidates(). */
export interface QuickBooksCustomerCandidate {
  qb_customer_id: string;
  qb_customer_name: string;
  /** 0–1 fuzzy similarity score, for sorting/display only. */
  score: number;
}

// Modeled from the QuickBooks Online API's documented Estimate/Invoice
// TxnStatus-style values (see README "QuickBooks Online Integration —
// Research Findings" for exactly what was found/cited) — this app's own
// enum, not a literal passthrough of QBO's internal fields.
export const QB_ESTIMATE_STATUSES = ["Pending", "Accepted", "Closed", "Rejected"] as const;
export type QBEstimateStatus = (typeof QB_ESTIMATE_STATUSES)[number];

export const QB_INVOICE_STATUSES = ["Unsent", "Open", "Partially Paid", "Paid", "Overdue", "Voided"] as const;
export type QBInvoiceStatus = (typeof QB_INVOICE_STATUSES)[number];

export type QuickBooksEntityType = "Estimate" | "Invoice";
export type QBDocumentStatus = QBEstimateStatus | QBInvoiceStatus;

/** One line item on a "Prepare Estimate/Invoice" review screen, and on the
 * QBO entity itself once created. */
export interface QuickBooksLineItem {
  description: string;
  quantity: number;
  rate: number;
  amount: number;
}

/**
 * The one place every QB Estimate/Invoice maps to an internal project/job.
 * A job can have MANY estimates and invoices — one-to-many via project_id,
 * never a single field on `projects`. `amount_paid` is only meaningful for
 * Invoice rows (see README for what the QBO Invoice API actually exposes
 * for payment status/balance, and why this app tracks it at the
 * invoice-status level rather than per-payment).
 */
export interface QuickBooksDocument {
  id: string;
  company_id: string;
  project_id: string;
  qb_realm_id: string;
  entity_type: QuickBooksEntityType;
  qb_entity_id: string;
  document_number?: string;
  status: QBDocumentStatus;
  amount: number;
  amount_paid?: number;
  qb_customer_id: string;
  created_at: string;
  updated_at: string;
  last_synced_at?: string;
}

/** Idempotency ledger for app/api/quickbooks/webhook — a redelivered
 * event_id is recognized and skipped rather than double-processed. */
export interface QuickBooksWebhookEvent {
  id: string;
  event_id: string;
  received_at: string;
  processed_at?: string | null;
  payload_summary: string;
}

/** Every meaningful QuickBooks action, shown in an admin-only Sync Log
 * view AND mirrored to the existing `activity_log` (see lib/quickbooks.ts /
 * lib/db.ts) for consistency with the rest of the app's audit trail. */
export interface QuickBooksSyncLogEntry {
  id: string;
  company_id: string;
  created_at: string;
  action: string;
  project_id?: string;
  entity_type?: QuickBooksEntityType;
  qb_entity_id?: string;
  document_number?: string;
  success: boolean;
  error_detail?: string;
  initiated_by?: string;
}

/** Placeholder management company a Quick Job building is filed under when
 * the real company isn't known yet (see lib/db.ts getOrCreateUnassignedClient). */
export const UNASSIGNED_CLIENT_NAME = "Unassigned — add management company later";

// ---------------------------------------------------------------------
// EMAIL INTAKE — drawings / invoices forwarded from the office Gmail to
// the app's intake address (see app/api/inbound/resend/route.ts and
// migration 0023). Auto-filed when the building/job match is certain,
// otherwise held in the Unfiled tray at /inbox.
// ---------------------------------------------------------------------
export type InboundKind = "drawing" | "invoice" | "unknown";
export type InboundStatus = "unfiled" | "filed" | "ignored";

export interface InboundAttachment {
  id: string;
  filename: string;
  content_type?: string;
  size?: number;
  storage_path?: string; // in bucket "inbound-email"
}

export interface InboundEmail {
  id: string;
  company_id: string;
  provider_email_id: string;
  from_email?: string | null;
  from_name?: string | null;
  to_email?: string | null;
  subject?: string | null;
  text_preview?: string | null;
  received_at: string;
  kind: InboundKind;
  status: InboundStatus;
  suggested_building_id?: string | null;
  suggested_project_id?: string | null;
  filed_project_id?: string | null;
  filed_kind?: string | null;
  filed_by?: string | null;
  filed_at?: string | null;
  attachments: InboundAttachment[];
  created_at: string;
}
