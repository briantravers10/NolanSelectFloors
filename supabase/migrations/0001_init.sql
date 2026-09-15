-- Nolan Select Floors — core schema
-- A multi-tenant flooring contractor operations platform.
-- All tables carry company_id where relevant so a "Platform Admin" tier
-- can later host multiple contractor companies on one instance.

create extension if not exists "pgcrypto";

-- =========================================================================
-- ENUM TYPES
-- =========================================================================

create type user_role as enum (
  'platform_admin', 'company_owner', 'manager', 'office_staff', 'field_worker'
);

create type contact_role as enum (
  'Property Manager', 'Assistant Property Manager', 'Building Manager',
  'Superintendent', 'Facilities Manager', 'Regional Manager',
  'Accounts Payable', 'Owner', 'Other'
);

create type job_request_status as enum (
  'New Request', 'Site Visit Required', 'Site Visit Scheduled',
  'Estimate Required', 'Estimate Sent', 'Awaiting Approval', 'Approved',
  'Ready to Schedule', 'Converted to Project', 'Declined', 'Cancelled'
);

create type project_status as enum (
  'Approved', 'Pre-Construction', 'Materials Required', 'Materials Ordered',
  'Materials Ready', 'Ready to Schedule', 'Scheduled', 'In Progress',
  'Paused', 'Punch List', 'Completed', 'Invoiced', 'Paid'
);

create type work_type as enum (
  'Hardwood Installation', 'Floor Sanding', 'Staining', 'Finishing',
  'LVP Installation', 'Laminate Installation', 'Carpet Installation',
  'Tile', 'Demolition', 'Floor Preparation', 'Subfloor Repair',
  'Baseboard/Trim', 'Furniture Moving', 'Repairs', 'Other'
);

create type staff_capability as enum (
  'Installer', 'Sander', 'Finisher', 'Staining', 'Hardwood', 'LVP',
  'Laminate', 'Carpet', 'Tile', 'Demolition', 'Floor Prep',
  'Subfloor Repair', 'Baseboard/Trim', 'Laborer', 'Furniture Moving',
  'Delivery/Pickup', 'Driver', 'Supervisor/Foreman'
);

create type availability_status as enum (
  'working', 'available', 'day_off', 'vacation', 'unavailable'
);

create type material_status as enum (
  'Needed', 'Quote Requested', 'Ordered', 'Partially Delivered',
  'Delivered', 'Problem', 'Returned'
);

create type task_status as enum (
  'To Do', 'In Progress', 'Waiting', 'Completed'
);

create type lead_status as enum (
  'New', 'Contacted', 'Site Visit', 'Estimate', 'Follow Up', 'Won', 'Lost'
);

create type related_record_type as enum (
  'client_company', 'building', 'job_request', 'project', 'employee', 'lead'
);

-- =========================================================================
-- CORE / TENANCY
-- =========================================================================

create table companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text,
  email text,
  address text,
  logo_url text,
  created_at timestamptz not null default now()
);

-- Stub users table. Auth is not wired up yet; this exists so role-based
-- auth can be bolted on later without a schema rewrite. See README.
create table users (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references companies(id) on delete cascade,
  email text unique not null,
  full_name text not null,
  role user_role not null default 'office_staff',
  phone text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- =========================================================================
-- CLIENTS / CONTACTS / BUILDINGS
-- =========================================================================

create table client_companies (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  name text not null,
  type text not null default 'Property Management', -- future: HOA, Developer, etc.
  phone text,
  email text,
  address text,
  billing_notes text,
  notes text,
  created_at timestamptz not null default now()
);
create index idx_client_companies_company on client_companies(company_id);

create table contacts (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  client_company_id uuid references client_companies(id) on delete cascade,
  first_name text not null,
  last_name text not null,
  title text,
  phone text,
  mobile_phone text,
  email text,
  notes text,
  created_at timestamptz not null default now()
);
create index idx_contacts_company on contacts(company_id);
create index idx_contacts_client_company on contacts(client_company_id);

create table buildings (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  client_company_id uuid not null references client_companies(id) on delete cascade,
  name text not null,
  address text not null,
  city text not null,
  state text not null,
  zip text not null,
  primary_contact_id uuid references contacts(id) on delete set null,
  superintendent_name text,
  superintendent_phone text,
  access_instructions text,
  working_hours text,
  coi_requirements text,
  parking_loading text,
  elevator_info text,
  delivery_instructions text,
  building_rules text,
  notes text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create index idx_buildings_company on buildings(company_id);
create index idx_buildings_client_company on buildings(client_company_id);

-- Join table: a contact can manage multiple buildings, with a role that
-- may differ per building (e.g. Regional Manager at one, PM at another).
create table building_contacts (
  id uuid primary key default gen_random_uuid(),
  building_id uuid not null references buildings(id) on delete cascade,
  contact_id uuid not null references contacts(id) on delete cascade,
  role contact_role not null default 'Property Manager',
  is_primary boolean not null default false,
  unique (building_id, contact_id)
);
create index idx_building_contacts_building on building_contacts(building_id);
create index idx_building_contacts_contact on building_contacts(contact_id);

-- =========================================================================
-- JOB REQUESTS -> PROJECTS
-- =========================================================================

create table job_requests (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  building_id uuid not null references buildings(id) on delete cascade,
  contact_id uuid references contacts(id) on delete set null,
  unit_number text,
  description text not null,
  status job_request_status not null default 'New Request',
  received_via text, -- phone / email / text / portal
  received_at timestamptz not null default now(),
  site_visit_date date,
  estimate_amount numeric(12,2),
  estimate_sent_at timestamptz,
  approved_at timestamptz,
  converted_project_id uuid, -- fk added below after projects exists
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_job_requests_company on job_requests(company_id);
create index idx_job_requests_building on job_requests(building_id);
create index idx_job_requests_status on job_requests(status);

create table projects (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  building_id uuid not null references buildings(id) on delete cascade,
  job_request_id uuid references job_requests(id) on delete set null,
  unit_number text,
  name text not null,
  description text,
  status project_status not null default 'Approved',
  project_value numeric(12,2) not null default 0,
  other_cost numeric(12,2) not null default 0,
  needs_transportation boolean not null default true,
  start_date date,
  target_end_date date,
  actual_end_date date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_projects_company on projects(company_id);
create index idx_projects_building on projects(building_id);
create index idx_projects_status on projects(status);
create index idx_projects_start_date on projects(start_date);

alter table job_requests
  add constraint fk_job_requests_converted_project
  foreign key (converted_project_id) references projects(id) on delete set null;

create table project_work_types (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  work_type work_type not null,
  unique (project_id, work_type)
);
create index idx_project_work_types_project on project_work_types(project_id);

-- =========================================================================
-- STAFF
-- =========================================================================

create table employees (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  first_name text not null,
  last_name text not null,
  title text not null default 'Installer',
  phone text,
  email text,
  day_rate numeric(10,2) not null default 0,
  is_driver boolean not null default false,
  active boolean not null default true,
  hire_date date,
  notes text,
  created_at timestamptz not null default now()
);
create index idx_employees_company on employees(company_id);

create table employee_skills (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references employees(id) on delete cascade,
  capability staff_capability not null,
  unique (employee_id, capability)
);
create index idx_employee_skills_employee on employee_skills(employee_id);

create table employee_availability (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references employees(id) on delete cascade,
  schedule_date date not null,
  status availability_status not null default 'available',
  notes text,
  unique (employee_id, schedule_date)
);
create index idx_employee_availability_employee_date on employee_availability(employee_id, schedule_date);
create index idx_employee_availability_date on employee_availability(schedule_date);

-- =========================================================================
-- CREW REQUIREMENTS + SCHEDULE
-- =========================================================================

create table project_crew_requirements (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  project_id uuid not null references projects(id) on delete cascade,
  schedule_date date, -- nullable: null = applies to every scheduled day
  role staff_capability not null,
  quantity int not null check (quantity > 0)
);
create index idx_crew_req_project on project_crew_requirements(project_id);
create index idx_crew_req_date on project_crew_requirements(schedule_date);

create table schedule_assignments (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  project_id uuid not null references projects(id) on delete cascade,
  employee_id uuid not null references employees(id) on delete cascade,
  schedule_date date not null,
  role_on_job staff_capability not null,
  base_day_rate numeric(10,2) not null,
  rate_multiplier numeric(4,2) not null default 1.0,
  time_and_half boolean not null default false,
  -- Snapshotted at assignment time. NEVER recalculated from the employee's
  -- current rate — a later raise must not retroactively change history.
  assignment_cost numeric(12,2) not null,
  notes text,
  created_at timestamptz not null default now()
);
create index idx_schedule_assignments_company_date on schedule_assignments(company_id, schedule_date);
create index idx_schedule_assignments_project on schedule_assignments(project_id);
create index idx_schedule_assignments_employee_date on schedule_assignments(employee_id, schedule_date);

-- =========================================================================
-- MATERIALS
-- =========================================================================

create table materials (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  name text not null,
  category text,
  supplier text,
  unit text default 'unit',
  created_at timestamptz not null default now()
);
create index idx_materials_company on materials(company_id);

create table project_materials (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  project_id uuid not null references projects(id) on delete cascade,
  material_id uuid references materials(id) on delete set null,
  description text not null,
  quantity numeric(10,2) not null default 1,
  unit text default 'unit',
  cost numeric(12,2) not null default 0,
  status material_status not null default 'Needed',
  supplier text,
  ordered_at timestamptz,
  expected_delivery date,
  delivered_at timestamptz,
  notes text,
  created_at timestamptz not null default now()
);
create index idx_project_materials_project on project_materials(project_id);
create index idx_project_materials_status on project_materials(status);

-- =========================================================================
-- TASKS / COMMUNICATIONS / NOTES / DOCS / PHOTOS
-- =========================================================================

create table tasks (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  title text not null,
  description text,
  related_type related_record_type,
  related_id uuid,
  assigned_to uuid references employees(id) on delete set null,
  due_date date,
  status task_status not null default 'To Do',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_tasks_company on tasks(company_id);
create index idx_tasks_due_date on tasks(due_date);
create index idx_tasks_related on tasks(related_type, related_id);

create table communications (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  related_type related_record_type not null,
  related_id uuid not null,
  contact_id uuid references contacts(id) on delete set null,
  direction text not null default 'inbound', -- inbound / outbound
  channel text not null default 'phone', -- phone / email / text / in-person
  summary text not null,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index idx_communications_related on communications(related_type, related_id);

create table project_notes (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  project_id uuid not null references projects(id) on delete cascade,
  author_name text,
  body text not null,
  created_at timestamptz not null default now()
);
create index idx_project_notes_project on project_notes(project_id);

-- Metadata only — actual bytes live in Supabase Storage buckets
-- ("project-documents", "project-photos"). See README for architecture.
create table documents (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  related_type related_record_type not null,
  related_id uuid not null,
  file_name text not null,
  storage_path text,
  content_type text,
  size_bytes bigint,
  uploaded_by text,
  created_at timestamptz not null default now()
);
create index idx_documents_related on documents(related_type, related_id);

create table photos (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  related_type related_record_type not null,
  related_id uuid not null,
  file_name text not null,
  storage_path text,
  caption text,
  taken_at timestamptz,
  uploaded_by text,
  created_at timestamptz not null default now()
);
create index idx_photos_related on photos(related_type, related_id);

-- =========================================================================
-- NEW BUSINESS (secondary feature)
-- =========================================================================

create table new_business_leads (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  company_name text not null,
  contact_name text,
  phone text,
  email text,
  source text,
  status lead_status not null default 'New',
  estimated_value numeric(12,2),
  notes text,
  converted_client_company_id uuid references client_companies(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_leads_company on new_business_leads(company_id);
create index idx_leads_status on new_business_leads(status);

-- =========================================================================
-- ACTIVITY LOG
-- =========================================================================

create table activity_log (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  actor_name text,
  action text not null,
  related_type related_record_type,
  related_id uuid,
  detail text,
  created_at timestamptz not null default now()
);
create index idx_activity_log_company on activity_log(company_id);
create index idx_activity_log_related on activity_log(related_type, related_id);

-- =========================================================================
-- COMPANY SETUP / DISCOVERY QUESTIONNAIRE
-- =========================================================================

create table company_setup_answers (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  section text not null, -- BUSINESS / CLIENTS / JOB_REQUESTS / ...
  question_key text not null,
  answer text,
  updated_at timestamptz not null default now(),
  unique (company_id, section, question_key)
);
create index idx_company_setup_company on company_setup_answers(company_id);
