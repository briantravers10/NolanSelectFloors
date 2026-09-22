// Demo seed data for Nolan Select Floors.
// Generates a fully interconnected dataset anchored to "today" so the
// Dashboard / Schedule pages always have a live current week to show.
// This module is the single source of truth for both:
//   - the in-memory fallback store used when Supabase isn't configured
//   - `npm run seed`, which can push the same data into a live Supabase project
import { addDays, isoDate, startOfWeek } from "./dates";
import type {
  ActivityLogEntry,
  ActualLaborEntry,
  AgendaEvent,
  Building,
  BuildingRegion,
  BuildingContact,
  ClientCompany,
  Communication,
  Company,
  CompanySetupAnswer,
  Contact,
  DailyScheduleConfirmation,
  DocumentRecord,
  EmailRoutingRule,
  Employee,
  EmployeeAvailability,
  EmployeeSkill,
  Invoice,
  JobRequest,
  Material,
  MaterialRateItem,
  NewBusinessLead,
  OfficeUser,
  PhotoRecord,
  SectionKey,
  SectionPermission,
  PricingFormula,
  PricingFormulaComponent,
  Project,
  ProjectCrewRequirement,
  ProjectDrawing,
  ProjectMaterial,
  ProjectNote,
  ProjectScheduleDay,
  ProjectWorkType,
  QuickBooksConnection,
  QuickBooksCustomerMapping,
  QuickBooksDocument,
  QuickBooksSyncLogEntry,
  QuickBooksWebhookEvent,
  ScheduleAssignment,
  SchedulePickupItem,
  Task,
  TimeOffEntry,
  User,
  WorkTypeRecord,
  InboundEmail,
  ProjectOutboundInvoice,
} from "./types";

// A fixed, valid UUID rather than a readable "co-1"-style id: this value is
// stamped onto every record the app creates at runtime (via
// getCurrentCompanyId()), so against a real Supabase project it must be a
// real uuid AND match the companies row there — see
// supabase/migrations/0014_canonical_company_id.sql, which pins the live
// database to this exact value.
export const COMPANY_ID = "11111111-1111-4111-8111-111111111111";

export function buildSeedData() {
  const now = new Date();
  const monday = startOfWeek(now);
  // `t(offset)` walks relative to the actual current date — used throughout
  // so "starts in 3 days" / "was received yesterday" / "the work week
  // starting today" stay true no matter what day the app happens to be
  // viewed on (this module runs fresh each time the server process boots).
  const t = (offset: number) => isoDate(addDays(now, offset));
  const nowIso = isoDate(now);

  const company: Company = {
    id: COMPANY_ID,
    name: "Nolan Select Floors",
    phone: "(917) 555-0142",
    email: "office@nolanselectfloors.com",
    address: "118 Coleman Avenue, Jersey City, NJ 07305",
    created_at: "2019-03-01T00:00:00.000Z",
  };

  const users: User[] = [
    {
      id: "user-1",
      company_id: COMPANY_ID,
      email: "travers.brian10@gmail.com",
      full_name: "Brian Travers",
      role: "company_owner",
      phone: "(917) 555-0101",
      active: true,
      created_at: "2019-03-01T00:00:00.000Z",
    },
  ];

  // Simulated office estimators. Placeholder for real per-user auth — see
  // README "Dev user selector" section. The dev "acting as" selector in the
  // TopBar lets staff pick one of these three (or the company owner, who
  // acts as the Manager/Owner role for reassign/release actions) so the
  // bid-claiming UI has someone concrete to claim/lock bids as.
  // access_role (build 6) is the labor-cost/pay-rate visibility permission
  // tier — separate from `role` (estimator/manager) above, which only
  // governs bid claiming. See lib/types.ts ACCESS_ROLES / README.
  // is_owner / auth_user_id added in 0012_permissions_and_auth.sql (build
  // 11) — see lib/permissions.ts and README "Permissions & Staff Access".
  // Sarah is the section-level Owner/Admin ("my friend" in the client's own
  // words): unrestricted access to every section, not subject to the
  // sectionPermissions grid below. auth_user_id stays null for everyone —
  // there is no real Supabase Auth project connected yet (see lib/auth.ts).
  const officeUsers: OfficeUser[] = [
    { id: "ou-1", company_id: COMPANY_ID, full_name: "Sarah Bennett", email: "sbennett@nolanselectfloors.com", role: "estimator", access_role: "owner_admin", active: true, created_at: "2021-01-11T00:00:00.000Z", auth_user_id: null, is_owner: true },
    { id: "ou-2", company_id: COMPANY_ID, full_name: "Emma Castillo", email: "ecastillo@nolanselectfloors.com", role: "estimator", access_role: "office_staff", active: true, created_at: "2021-06-04T00:00:00.000Z", auth_user_id: null, is_owner: false },
    { id: "ou-3", company_id: COMPANY_ID, full_name: "David Okoye", email: "dokoye@nolanselectfloors.com", role: "estimator", access_role: "field_employee", active: true, created_at: "2022-03-21T00:00:00.000Z", auth_user_id: null, is_owner: false },
  ];

  // ---------------------------------------------------------------------
  // SECTION_PERMISSIONS (build 11) — per-nav-section View/None/Edit grants.
  // No row for a (user, section) pair = 'none' (secure by default). Mirrors
  // the seed in supabase/migrations/0012_permissions_and_auth.sql exactly,
  // so demo mode and a connected Supabase project show the same scenario.
  // ---------------------------------------------------------------------
  const sectionPermUpdatedAt = "2026-01-05T00:00:00.000Z";
  let sectionPermSeq = 0;
  const sectionPermission = (officeUserId: string, sectionKey: SectionKey, accessLevel: SectionPermission["access_level"]): SectionPermission => ({
    id: `sp-${++sectionPermSeq}`,
    company_id: COMPANY_ID,
    office_user_id: officeUserId,
    section_key: sectionKey,
    access_level: accessLevel,
    updated_by: "Sarah Bennett",
    updated_at: sectionPermUpdatedAt,
  });
  const sectionPermissions: SectionPermission[] = [
    // Emma Castillo — office estimator: edit access to most operational
    // sections, view-only on Company Setup / QuickBooks (connection
    // management itself stays Owner/Admin-only via the existing
    // access_role gate — see lib/current-user.ts canManageQuickBooksConnection).
    ...(["dashboard", "clients", "buildings", "job_requests", "projects", "schedule", "staff", "materials", "pricing", "reports"] as SectionKey[]).map(
      (key) => sectionPermission("ou-2", key, "edit")
    ),
    sectionPermission("ou-2", "company_setup", "view"),
    sectionPermission("ou-2", "quickbooks", "view"),
    // David Okoye — the "project manager only needs to see certain things"
    // persona the client described: view-only, and only on a subset
    // (Dashboard, Schedule, Projects, Tasks). Everything else defaults to
    // 'none' — no row.
    ...(["dashboard", "schedule", "projects", "tasks"] as SectionKey[]).map((key) => sectionPermission("ou-3", key, "view")),
  ];

  // ---------------------------------------------------------------------
  // CLIENT COMPANIES (management companies)
  // ---------------------------------------------------------------------
  const clientCompanies: ClientCompany[] = [
    {
      id: "cc-1",
      company_id: COMPANY_ID,
      name: "Vanguard Property Group",
      type: "Property Management",
      phone: "(201) 555-3100",
      email: "ops@vanguardpg.com",
      address: "70 Hudson St, Jersey City, NJ 07302",
      notes: "Largest recurring client. Net-30 billing, PO required on every job over $2,000.",
      created_at: "2019-04-10T00:00:00.000Z",
    },
    {
      id: "cc-2",
      company_id: COMPANY_ID,
      name: "Meridian Residential Management",
      type: "Property Management",
      phone: "(212) 555-7788",
      email: "requests@meridianrm.com",
      address: "500 Amsterdam Ave, New York, NY 10024",
      notes: "Prefers all requests via their vendor portal, but calls when urgent.",
      created_at: "2020-01-15T00:00:00.000Z",
    },
    {
      id: "cc-3",
      company_id: COMPANY_ID,
      name: "Cobblestone Realty Partners",
      type: "Property Management",
      phone: "(718) 555-4421",
      email: "maintenance@cobblestonerp.com",
      address: "195 Montague St, Brooklyn, NY 11201",
      notes: "Slow to approve estimates over $5,000 — needs board sign-off.",
      created_at: "2020-06-22T00:00:00.000Z",
    },
    {
      id: "cc-4",
      company_id: COMPANY_ID,
      name: "Harborview Management Co.",
      type: "Property Management",
      phone: "(203) 555-9012",
      email: "info@harborviewmgmt.com",
      address: "1 Landmark Sq, Stamford, CT 06901",
      notes: "Strict COI renewal requirement every January.",
      created_at: "2021-02-08T00:00:00.000Z",
    },
    {
      id: "cc-5",
      company_id: COMPANY_ID,
      name: "Sterling Community Associates",
      type: "Property Management",
      phone: "(718) 555-6630",
      email: "service@sterlingca.com",
      address: "41-25 Kissena Blvd, Queens, NY 11355",
      notes: "Co-op board approves all work in writing; email confirmation required.",
      created_at: "2021-09-30T00:00:00.000Z",
    },
  ];

  // ---------------------------------------------------------------------
  // CONTACTS
  // ---------------------------------------------------------------------
  const contacts: Contact[] = [
    { id: "ct-1", company_id: COMPANY_ID, client_company_id: "cc-1", first_name: "Denise", last_name: "Whitfield", title: "Property Manager", phone: "(201) 555-3101", email: "dwhitfield@vanguardpg.com", created_at: "2019-04-10T00:00:00.000Z" },
    { id: "ct-2", company_id: COMPANY_ID, client_company_id: "cc-1", first_name: "Marcus", last_name: "Ionescu", title: "Assistant Property Manager", phone: "(201) 555-3112", email: "mionescu@vanguardpg.com", created_at: "2019-04-10T00:00:00.000Z" },
    { id: "ct-3", company_id: COMPANY_ID, client_company_id: "cc-2", first_name: "Carla", last_name: "Jimenez", title: "Property Manager", phone: "(212) 555-7790", email: "cjimenez@meridianrm.com", created_at: "2020-01-15T00:00:00.000Z" },
    { id: "ct-4", company_id: COMPANY_ID, client_company_id: "cc-2", first_name: "Tom", last_name: "Delgado", title: "Regional Manager", phone: "(212) 555-7701", email: "tdelgado@meridianrm.com", created_at: "2020-01-15T00:00:00.000Z" },
    { id: "ct-5", company_id: COMPANY_ID, client_company_id: "cc-2", first_name: "Priya", last_name: "Nair", title: "Property Manager", phone: "(212) 555-7715", email: "pnair@meridianrm.com", created_at: "2020-03-02T00:00:00.000Z" },
    { id: "ct-6", company_id: COMPANY_ID, client_company_id: "cc-3", first_name: "Gregory", last_name: "Hahn", title: "Property Manager", phone: "(718) 555-4422", email: "ghahn@cobblestonerp.com", created_at: "2020-06-22T00:00:00.000Z" },
    { id: "ct-7", company_id: COMPANY_ID, client_company_id: "cc-3", first_name: "Alicia", last_name: "Rowe", title: "Accounts Payable", phone: "(718) 555-4430", email: "arowe@cobblestonerp.com", created_at: "2020-06-22T00:00:00.000Z" },
    { id: "ct-8", company_id: COMPANY_ID, client_company_id: "cc-4", first_name: "Steven", last_name: "Okafor", title: "Property Manager", phone: "(203) 555-9013", email: "sokafor@harborviewmgmt.com", created_at: "2021-02-08T00:00:00.000Z" },
    { id: "ct-9", company_id: COMPANY_ID, client_company_id: "cc-4", first_name: "Beatrice", last_name: "Lin", title: "Facilities Manager", phone: "(203) 555-9020", email: "blin@harborviewmgmt.com", created_at: "2021-02-08T00:00:00.000Z" },
    { id: "ct-10", company_id: COMPANY_ID, client_company_id: "cc-5", first_name: "Nadia", last_name: "Petrov", title: "Property Manager", phone: "(718) 555-6631", email: "npetrov@sterlingca.com", created_at: "2021-09-30T00:00:00.000Z" },
    { id: "ct-11", company_id: COMPANY_ID, client_company_id: "cc-5", first_name: "Owen", last_name: "Blackwell", title: "Building Manager", phone: "(718) 555-6642", email: "oblackwell@sterlingca.com", created_at: "2021-09-30T00:00:00.000Z" },
    { id: "ct-12", company_id: COMPANY_ID, client_company_id: "cc-5", first_name: "Felicia", last_name: "Grant", title: "Property Manager", phone: "(718) 555-6650", email: "fgrant@sterlingca.com", created_at: "2022-01-11T00:00:00.000Z" },
  ];

  // ---------------------------------------------------------------------
  // BUILDINGS
  // ---------------------------------------------------------------------
  type BSeed = Omit<Building, "company_id" | "active" | "created_at" | "region" | "latitude" | "longitude">;
  const buildingSeeds: BSeed[] = [
    { id: "b-1", client_company_id: "cc-1", name: "The Wexford", address: "220 Grove Street", city: "Jersey City", state: "NJ", zip: "07302", primary_contact_id: "ct-1", superintendent_name: "Hector Ramos", superintendent_phone: "(201) 555-8801", access_instructions: "Check in with doorman, sign in on log at front desk. Freight elevator key held by super.", working_hours: "Mon-Fri 8:00am-4:30pm, no work on weekends without written approval.", coi_requirements: "$2M general liability; The Wexford Condominium Assoc. and Vanguard Property Group as additional insured.", parking_loading: "Loading dock on Grove St side, 30-min max, cone off with building cones.", elevator_info: "Freight elevator (Elevator 3) padded on request, 300 lb weight limit.", delivery_instructions: "Deliveries after 9am only, notify doorman 24 hrs ahead.", building_rules: "Floor protection required in all hallways. No debris in common trash rooms." },
    { id: "b-2", client_company_id: "cc-1", name: "Liberty Harbor Lofts", address: "145 Bay Street", city: "Jersey City", state: "NJ", zip: "07302", primary_contact_id: "ct-1", superintendent_name: "Wanda Kessler", superintendent_phone: "(201) 555-8815", access_instructions: "Super meets crew at loading entrance, badge access required for all common areas.", working_hours: "Mon-Sat 8:00am-5:00pm.", coi_requirements: "$1M/$2M general liability naming Liberty Harbor Lofts Condo Assoc.", parking_loading: "Street parking only; loading zone on Bay St 7-10am.", elevator_info: "Passenger elevator only, no freight — pad walls before moving materials.", delivery_instructions: "Text super 1 day ahead for delivery windows.", building_rules: "No power tools before 9am on weekdays." },
    { id: "b-3", client_company_id: "cc-1", name: "Hamilton Park Residences", address: "88 Erie Street", city: "Jersey City", state: "NJ", zip: "07302", primary_contact_id: "ct-2", superintendent_name: "Devon Marsh", superintendent_phone: "(201) 555-8830", access_instructions: "Lockbox code from management office, code changes monthly — confirm morning of.", working_hours: "Mon-Fri 9:00am-4:00pm.", coi_requirements: "$2M general liability, Hamilton Park HOA as additional insured.", parking_loading: "No dedicated loading zone; use visitor spots for max 1 hr.", elevator_info: "Freight elevator, reservation required 48 hrs ahead through super.", delivery_instructions: "All deliveries staged in basement storage room B.", building_rules: "Hallway runners mandatory, remove all trash same day." },
    { id: "b-4", client_company_id: "cc-1", name: "Newport Crossing", address: "33 Washington Blvd", city: "Jersey City", state: "NJ", zip: "07310", primary_contact_id: "ct-1", superintendent_name: "Ray Coston", superintendent_phone: "(201) 555-8845", access_instructions: "Concierge issues temp fob, return at end of day.", working_hours: "Mon-Fri 8:00am-6:00pm, Sat by approval.", coi_requirements: "$2M general liability + $1M umbrella, Newport Crossing Owners Corp additional insured.", parking_loading: "Underground loading dock, garage clearance 7'2\".", elevator_info: "Freight elevator (Elevator 4), max 500 lb.", delivery_instructions: "Schedule dock time with concierge 24 hrs in advance.", building_rules: "Hard hat area near lobby renovation — follow posted signage." },
    { id: "b-5", client_company_id: "cc-2", name: "The Vermeer", address: "210 West 70th Street", city: "New York", state: "NY", zip: "10023", primary_contact_id: "ct-3", superintendent_name: "Louis Petraglia", superintendent_phone: "(212) 555-2201", access_instructions: "Doorman building — sign in, super escorts to unit first visit.", working_hours: "Mon-Fri 8:30am-4:30pm strictly enforced by board.", coi_requirements: "$2M general liability naming The Vermeer Owners Corp and Meridian Residential Management.", parking_loading: "No loading dock — hand-carry from curb, 20 min parking limit on 70th St.", elevator_info: "Service elevator only for contractors, padded.", delivery_instructions: "Deliveries only 10am-2pm, prior written notice to super required.", building_rules: "No radios/music, quiet work only. Masking of all common area floors mandatory." },
    { id: "b-6", client_company_id: "cc-2", name: "Riverside Gardens", address: "465 West End Ave", city: "New York", state: "NY", zip: "10024", primary_contact_id: "ct-4", superintendent_name: "Faye Bergstrom", superintendent_phone: "(212) 555-2215", access_instructions: "Check in with lobby staff, ID required, badge issued for the day.", working_hours: "Mon-Fri 9:00am-5:00pm.", coi_requirements: "$2M general liability, Riverside Gardens Corp additional insured.", parking_loading: "Loading dock on West End Ave, book with super.", elevator_info: "Freight elevator, key from lobby desk.", delivery_instructions: "48 hrs notice for large deliveries.", building_rules: "All materials must be removed from lobby by end of day." },
    { id: "b-7", client_company_id: "cc-2", name: "Kips Bay Court", address: "350 East 30th Street", city: "New York", state: "NY", zip: "10016", primary_contact_id: "ct-5", superintendent_name: "Arturo Vega", superintendent_phone: "(212) 555-2230", access_instructions: "Super on-site 7am-3pm, after hours call management office.", working_hours: "Mon-Sat 8:00am-5:00pm.", coi_requirements: "$1M general liability, standard ACORD 25 to management office.", parking_loading: "Loading zone on 30th St, 2-hr meters, bring quarters or app.", elevator_info: "Passenger elevator, protect with pads for materials.", delivery_instructions: "Coordinate directly with super via text.", building_rules: "No deliveries blocking lobby doors." },
    { id: "b-8", client_company_id: "cc-2", name: "Chelsea Mercantile", address: "252 Seventh Ave", city: "New York", state: "NY", zip: "10001", primary_contact_id: "ct-3", superintendent_name: "Ingrid Halvorsen", superintendent_phone: "(212) 555-2244", access_instructions: "Freight entrance on 25th St, ring buzzer for porter.", working_hours: "Mon-Fri 8:00am-4:00pm, no weekend work.", coi_requirements: "$2M general liability, Chelsea Mercantile Condominium additional insured.", parking_loading: "Freight loading dock, sign-up sheet with porter.", elevator_info: "Freight elevator only, reserve slot day before.", delivery_instructions: "Porter logs all deliveries — check in every load.", building_rules: "Corridor floor protection mandatory at all times." },
    { id: "b-9", client_company_id: "cc-3", name: "Cobble Hill Commons", address: "175 Atlantic Ave", city: "Brooklyn", state: "NY", zip: "11201", primary_contact_id: "ct-6", superintendent_name: "Julio Fontanez", superintendent_phone: "(718) 555-5501", access_instructions: "Super lives on-site, buzz apt 1A.", working_hours: "Mon-Fri 8:00am-5:00pm.", coi_requirements: "$2M general liability, Cobble Hill Commons HOA additional insured.", parking_loading: "Alley access off Clinton St for loading, narrow — vans only.", elevator_info: "No elevator, 4-story walk-up building.", delivery_instructions: "Stage materials in alley, move promptly — no blocking neighbors.", building_rules: "Quiet hours after 5pm, brownstone block association is strict." },
    { id: "b-10", client_company_id: "cc-3", name: "Fort Greene Terrace", address: "88 South Portland Ave", city: "Brooklyn", state: "NY", zip: "11217", primary_contact_id: "ct-6", superintendent_name: "Marlene Etienne", superintendent_phone: "(718) 555-5515", access_instructions: "Lockbox on gate, code from management.", working_hours: "Mon-Fri 9:00am-4:00pm.", coi_requirements: "$1M general liability minimum, ACORD certificate to Cobblestone Realty Partners.", parking_loading: "Street parking, alternate side rules apply — check signage.", elevator_info: "No elevator, garden-level and 2nd floor units only.", delivery_instructions: "Notify management 24 hrs ahead of deliveries.", building_rules: "No debris left on sidewalk overnight." },
    { id: "b-11", client_company_id: "cc-3", name: "Park Slope Manor", address: "456 6th Avenue", city: "Brooklyn", state: "NY", zip: "11215", primary_contact_id: "ct-7", superintendent_name: "Otis Greenwood", superintendent_phone: "(718) 555-5530", access_instructions: "Ring super's bell, he opens service entrance.", working_hours: "Mon-Fri 8:00am-4:30pm.", coi_requirements: "$2M general liability naming Park Slope Manor Condo Board.", parking_loading: "No dedicated loading — double park briefly with flashers, watch for enforcement.", elevator_info: "Freight elevator in rear, super operates.", delivery_instructions: "Call super 30 min before arrival.", building_rules: "Board requires written work schedule posted in lobby." },
    { id: "b-12", client_company_id: "cc-3", name: "Boerum Hill Flats", address: "320 Bond Street", city: "Brooklyn", state: "NY", zip: "11231", primary_contact_id: "ct-6", superintendent_name: "Reggie Okonkwo", superintendent_phone: "(718) 555-5545", access_instructions: "Property manager unlocks unit for first visit, super has key after.", working_hours: "Mon-Fri 8:30am-5:00pm.", coi_requirements: "$2M general liability, Boerum Hill Flats LLC additional insured.", parking_loading: "Loading zone on Bond St, watch street cleaning schedule.", elevator_info: "No elevator, 3-story building.", delivery_instructions: "Coordinate with super for staging in basement.", building_rules: "Tenants below must be notified 48 hrs before sanding work." },
    { id: "b-13", client_company_id: "cc-4", name: "Harborview Tower", address: "1 Harbor Drive", city: "Stamford", state: "CT", zip: "06902", primary_contact_id: "ct-8", superintendent_name: "Neil Aspinwall", superintendent_phone: "(203) 555-6601", access_instructions: "Security desk issues contractor badge, photo ID required.", working_hours: "Mon-Fri 7:00am-5:00pm.", coi_requirements: "$3M general liability, Harborview Tower Owners Assoc + Harborview Management Co additional insured.", parking_loading: "Dedicated loading dock, level P1, freight elevator access from dock.", elevator_info: "Freight elevator, badge-activated, 1000 lb capacity.", delivery_instructions: "Schedule dock reservation through building portal 48 hrs ahead.", building_rules: "Hard hats and safety vests required in loading dock area." },
    { id: "b-14", client_company_id: "cc-4", name: "Shippan Landing", address: "750 Shippan Ave", city: "Stamford", state: "CT", zip: "06902", primary_contact_id: "ct-9", superintendent_name: "Colleen Marsh", superintendent_phone: "(203) 555-6615", access_instructions: "Front desk logs contractors in/out, gate code for parking lot.", working_hours: "Mon-Sat 8:00am-5:00pm.", coi_requirements: "$2M general liability naming Shippan Landing Condominium.", parking_loading: "Rear lot loading area, marked spaces for contractors.", elevator_info: "Passenger elevator, protect floors before use.", delivery_instructions: "Deliveries logged at front desk, staged in rear hallway.", building_rules: "No blocking fire lanes at any time." },
    { id: "b-15", client_company_id: "cc-4", name: "Springdale Court", address: "44 Hope Street", city: "Stamford", state: "CT", zip: "06905", primary_contact_id: "ct-8", superintendent_name: "Gene Whitfield", superintendent_phone: "(203) 555-6630", access_instructions: "Super meets crew each morning at unit, has master key.", working_hours: "Mon-Fri 8:00am-4:00pm.", coi_requirements: "$2M general liability, Springdale Court HOA additional insured.", parking_loading: "Small lot, 2 spaces reserved for contractors with permit from office.", elevator_info: "No elevator, garden-style 2-story buildings.", delivery_instructions: "Deliveries direct to unit, no staging area.", building_rules: "Keep landscaping clear, no material staged on grass." },
    { id: "b-16", client_company_id: "cc-4", name: "Glenbrook Residences", address: "900 Hope Street", city: "Stamford", state: "CT", zip: "06906", primary_contact_id: "ct-9", superintendent_name: "Priscilla Nunes", superintendent_phone: "(203) 555-6645", access_instructions: "Management office issues access card each visit.", working_hours: "Mon-Fri 8:30am-5:00pm.", coi_requirements: "$2M general liability naming Glenbrook Residences LLC.", parking_loading: "Loading zone by service entrance, first-come basis.", elevator_info: "Freight elevator, reserve with office.", delivery_instructions: "Text management office on arrival.", building_rules: "No smoking anywhere on property, including crew breaks." },
    { id: "b-17", client_company_id: "cc-5", name: "Sterling Pointe", address: "2200 Northern Blvd", city: "Queens", state: "NY", zip: "11358", primary_contact_id: "ct-10", superintendent_name: "Anthony Musco", superintendent_phone: "(718) 555-7701", access_instructions: "Super has master key, meets crew at 8am sharp.", working_hours: "Mon-Fri 8:00am-4:30pm.", coi_requirements: "$2M general liability, Sterling Pointe Co-op Corp additional insured.", parking_loading: "Lot in rear, 2 spots designated for vendors.", elevator_info: "Passenger elevator only, pad before hauling materials.", delivery_instructions: "Notify board liaison 48 hrs before large deliveries.", building_rules: "Co-op requires alteration agreement on file before any work begins." },
    { id: "b-18", client_company_id: "cc-5", name: "Bayside Commons", address: "45-15 Bell Blvd", city: "Queens", state: "NY", zip: "11361", primary_contact_id: "ct-11", superintendent_name: "Diane Okafor", superintendent_phone: "(718) 555-7715", access_instructions: "Buzz super's unit for entry, or coordinate via office.", working_hours: "Mon-Sat 8:00am-5:00pm.", coi_requirements: "$1M general liability, Bayside Commons HOA additional insured.", parking_loading: "Street parking, loading zone on Bell Blvd 8-10am.", elevator_info: "No elevator, 3-story walk-up.", delivery_instructions: "Stage in building vestibule briefly, move quickly.", building_rules: "No loud tools before 9am weekdays, 10am Saturday." },
    { id: "b-19", client_company_id: "cc-5", name: "Forest Hills Gardens Co-op", address: "1 Continental Ave", city: "Queens", state: "NY", zip: "11375", primary_contact_id: "ct-12", superintendent_name: "Salvatore Greco", superintendent_phone: "(718) 555-7730", access_instructions: "Board requires 72-hr notice, super escorts to unit.", working_hours: "Mon-Fri 9:00am-4:00pm strictly, no exceptions.", coi_requirements: "$2M general liability + alteration agreement, Forest Hills Gardens Corp additional insured.", parking_loading: "No vehicles beyond visitor lot; hand-truck materials in.", elevator_info: "No elevator, pre-war walk-up.", delivery_instructions: "Coordinate all deliveries through management office only.", building_rules: "Historic district — no dumpsters visible from street." },
    { id: "b-20", client_company_id: "cc-5", name: "Astoria Heights", address: "30-30 Broadway", city: "Queens", state: "NY", zip: "11106", primary_contact_id: "ct-10", superintendent_name: "Katarina Volkov", superintendent_phone: "(718) 555-7745", access_instructions: "Front desk issues visitor pass, sign in required each day.", working_hours: "Mon-Fri 8:00am-5:00pm.", coi_requirements: "$2M general liability naming Astoria Heights Owners Corp.", parking_loading: "Underground garage loading area, height limit 6'8\".", elevator_info: "Freight elevator (Elevator 2), reserve via front desk.", delivery_instructions: "Deliveries 9am-3pm only, sign in at desk.", building_rules: "Recycling separated on-site — flooring debris to dumpster only." },
  ];
  // Hand-picked approximate real-world coordinates + region per seeded
  // building — good enough for the Map view / haul-away routing demo
  // without a live geocoding call. See supabase/migrations/0003_regions_and_media.sql.
  const buildingGeo: Record<string, { region: BuildingRegion; lat: number; lng: number }> = {
    "b-1": { region: "New Jersey", lat: 40.7178, lng: -74.0431 },
    "b-2": { region: "New Jersey", lat: 40.7145, lng: -74.0431 },
    "b-3": { region: "New Jersey", lat: 40.7233, lng: -74.0447 },
    "b-4": { region: "New Jersey", lat: 40.7267, lng: -74.0345 },
    "b-5": { region: "Manhattan", lat: 40.7773, lng: -73.9819 },
    "b-6": { region: "Manhattan", lat: 40.7825, lng: -73.9825 },
    "b-7": { region: "Manhattan", lat: 40.7412, lng: -73.9776 },
    "b-8": { region: "Manhattan", lat: 40.7466, lng: -73.9942 },
    "b-9": { region: "Brooklyn", lat: 40.6892, lng: -73.9954 },
    "b-10": { region: "Brooklyn", lat: 40.6889, lng: -73.9739 },
    "b-11": { region: "Brooklyn", lat: 40.6698, lng: -73.9854 },
    "b-12": { region: "Brooklyn", lat: 40.6838, lng: -73.9847 },
    // Stamford, CT falls outside the 5 boroughs + NJ/LI list — "Other".
    "b-13": { region: "Other", lat: 41.0459, lng: -73.5387 },
    "b-14": { region: "Other", lat: 41.0234, lng: -73.531 },
    "b-15": { region: "Other", lat: 41.1034, lng: -73.5387 },
    "b-16": { region: "Other", lat: 41.0812, lng: -73.5296 },
    "b-17": { region: "Queens", lat: 40.7621, lng: -73.7902 },
    "b-18": { region: "Queens", lat: 40.7649, lng: -73.7727 },
    "b-19": { region: "Queens", lat: 40.7196, lng: -73.8448 },
    "b-20": { region: "Queens", lat: 40.7649, lng: -73.9235 },
  };
  const buildings: Building[] = buildingSeeds.map((b) => ({
    ...b,
    company_id: COMPANY_ID,
    active: true,
    created_at: "2022-01-01T00:00:00.000Z",
    region: buildingGeo[b.id]?.region ?? "Other",
    latitude: buildingGeo[b.id]?.lat ?? null,
    longitude: buildingGeo[b.id]?.lng ?? null,
  }));

  const buildingContacts: BuildingContact[] = [
    { id: "bc-1", building_id: "b-1", contact_id: "ct-1", role: "Property Manager", is_primary: true },
    { id: "bc-2", building_id: "b-1", contact_id: "ct-2", role: "Assistant Property Manager", is_primary: false },
    { id: "bc-3", building_id: "b-2", contact_id: "ct-1", role: "Property Manager", is_primary: true },
    { id: "bc-4", building_id: "b-3", contact_id: "ct-2", role: "Assistant Property Manager", is_primary: true },
    { id: "bc-5", building_id: "b-4", contact_id: "ct-1", role: "Property Manager", is_primary: true },
    { id: "bc-6", building_id: "b-5", contact_id: "ct-3", role: "Property Manager", is_primary: true },
    { id: "bc-7", building_id: "b-5", contact_id: "ct-4", role: "Regional Manager", is_primary: false },
    { id: "bc-8", building_id: "b-6", contact_id: "ct-4", role: "Regional Manager", is_primary: true },
    { id: "bc-9", building_id: "b-7", contact_id: "ct-5", role: "Property Manager", is_primary: true },
    { id: "bc-10", building_id: "b-8", contact_id: "ct-3", role: "Property Manager", is_primary: true },
    { id: "bc-11", building_id: "b-9", contact_id: "ct-6", role: "Property Manager", is_primary: true },
    { id: "bc-12", building_id: "b-10", contact_id: "ct-6", role: "Property Manager", is_primary: true },
    { id: "bc-13", building_id: "b-11", contact_id: "ct-7", role: "Accounts Payable", is_primary: true },
    { id: "bc-14", building_id: "b-11", contact_id: "ct-6", role: "Property Manager", is_primary: false },
    { id: "bc-15", building_id: "b-12", contact_id: "ct-6", role: "Property Manager", is_primary: true },
    { id: "bc-16", building_id: "b-13", contact_id: "ct-8", role: "Property Manager", is_primary: true },
    { id: "bc-17", building_id: "b-14", contact_id: "ct-9", role: "Facilities Manager", is_primary: true },
    { id: "bc-18", building_id: "b-15", contact_id: "ct-8", role: "Property Manager", is_primary: true },
    { id: "bc-19", building_id: "b-16", contact_id: "ct-9", role: "Facilities Manager", is_primary: true },
    { id: "bc-20", building_id: "b-17", contact_id: "ct-10", role: "Property Manager", is_primary: true },
    { id: "bc-21", building_id: "b-18", contact_id: "ct-11", role: "Building Manager", is_primary: true },
    { id: "bc-22", building_id: "b-19", contact_id: "ct-12", role: "Property Manager", is_primary: true },
    { id: "bc-23", building_id: "b-20", contact_id: "ct-10", role: "Property Manager", is_primary: true },
  ];

  // ---------------------------------------------------------------------
  // EMPLOYEES
  // ---------------------------------------------------------------------
  // pay_type/daily_rate/hourly_rate (build 6) — the ACTUAL-cost labor
  // tracking rate, kept separate from `day_rate` above (the PLANNED-cost
  // field still used for schedule_assignments.base_day_rate). Deliberately
  // a mix of daily- and hourly-rate employees. See README "Labor Cost
  // Tracking" for the worked examples these seed rows demonstrate:
  //   - e-2 Dennis Cho (daily): works p-15 4h + p-2 4h on the SAME day —
  //     proportional daily-rate allocation ($390 × 4/8 = $195 each).
  //   - e-9 B.J. Fontaine (hourly): works p-15 9h + p-11 9h on the SAME
  //     day — hourly cost is direct per job, no allocation (9×$32.50 each).
  //   - e-8 Sal Marchetti (daily): CURRENT daily_rate is $330, but the old
  //     actual_labor_entries rows for his completed job (p-7, ~12 days ago)
  //     were snapshotted at $300 (his rate before a raise) — proves a later
  //     raise never retroactively changes an already-logged job's cost.
  const employees: Employee[] = [
    // vacation_days_allowed / sick_days_allowed (build 7): deliberately
    // varying per employee, not a flat company-wide number — Tommy (e-7)
    // is seeded with only 3 vacation days allowed against a 4-day logged
    // vacation below, so the "over allowance" warning/badge has a real
    // seeded case to demonstrate.
    { id: "e-1", company_id: COMPANY_ID, first_name: "Miguel", last_name: "Alvarez", title: "Foreman / Supervisor", phone: "(917) 555-2201", email: "malvarez@nolanselectfloors.com", day_rate: 430, pay_type: "daily", daily_rate: 430, is_driver: true, active: true, hire_date: "2016-05-02", vacation_days_allowed: 15, sick_days_allowed: 7, created_at: "2016-05-02T00:00:00.000Z" },
    { id: "e-2", company_id: COMPANY_ID, first_name: "Dennis", last_name: "Cho", title: "Lead Installer", phone: "(917) 555-2202", email: "dcho@nolanselectfloors.com", day_rate: 390, pay_type: "daily", daily_rate: 390, is_driver: true, active: true, hire_date: "2017-08-14", vacation_days_allowed: 12, sick_days_allowed: 6, created_at: "2017-08-14T00:00:00.000Z" },
    { id: "e-3", company_id: COMPANY_ID, first_name: "Jamal", last_name: "Turner", title: "Floor Sander", phone: "(917) 555-2203", email: "jturner@nolanselectfloors.com", day_rate: 360, pay_type: "hourly", hourly_rate: 45, is_driver: false, active: true, hire_date: "2018-02-19", vacation_days_allowed: 10, sick_days_allowed: 5, created_at: "2018-02-19T00:00:00.000Z" },
    { id: "e-4", company_id: COMPANY_ID, first_name: "Ray", last_name: "Kowalski", title: "Finisher", phone: "(917) 555-2204", email: "rkowalski@nolanselectfloors.com", day_rate: 365, pay_type: "daily", daily_rate: 365, is_driver: false, active: true, hire_date: "2018-06-11", vacation_days_allowed: 10, sick_days_allowed: 5, created_at: "2018-06-11T00:00:00.000Z" },
    { id: "e-5", company_id: COMPANY_ID, first_name: "Victor", last_name: "Sousa", title: "Installer", phone: "(917) 555-2205", email: "vsousa@nolanselectfloors.com", day_rate: 340, pay_type: "hourly", hourly_rate: 42.5, is_driver: false, active: true, hire_date: "2019-01-07", vacation_days_allowed: 8, sick_days_allowed: 4, created_at: "2019-01-07T00:00:00.000Z" },
    { id: "e-6", company_id: COMPANY_ID, first_name: "Andre", last_name: "Willis", title: "Installer / Laborer", phone: "(917) 555-2206", email: "awillis@nolanselectfloors.com", day_rate: 325, pay_type: "daily", daily_rate: 325, is_driver: true, active: true, hire_date: "2019-09-23", vacation_days_allowed: 10, sick_days_allowed: 5, created_at: "2019-09-23T00:00:00.000Z" },
    { id: "e-7", company_id: COMPANY_ID, first_name: "Tommy", last_name: "Nguyen", title: "Tile Installer", phone: "(917) 555-2207", email: "tnguyen@nolanselectfloors.com", day_rate: 350, pay_type: "hourly", hourly_rate: 43.75, is_driver: false, active: true, hire_date: "2020-03-16", vacation_days_allowed: 3, sick_days_allowed: 5, created_at: "2020-03-16T00:00:00.000Z" },
    { id: "e-8", company_id: COMPANY_ID, first_name: "Sal", last_name: "Marchetti", title: "Carpet Installer", phone: "(917) 555-2208", email: "smarchetti@nolanselectfloors.com", day_rate: 330, pay_type: "daily", daily_rate: 330, is_driver: false, active: true, hire_date: "2020-07-01", vacation_days_allowed: 10, sick_days_allowed: 5, created_at: "2020-07-01T00:00:00.000Z" },
    { id: "e-9", company_id: COMPANY_ID, first_name: "B.J.", last_name: "Fontaine", title: "Laborer", phone: "(917) 555-2209", email: "bfontaine@nolanselectfloors.com", day_rate: 260, pay_type: "hourly", hourly_rate: 32.5, is_driver: true, active: true, hire_date: "2021-04-05", vacation_days_allowed: 12, sick_days_allowed: 5, created_at: "2021-04-05T00:00:00.000Z" },
    { id: "e-10", company_id: COMPANY_ID, first_name: "Eric", last_name: "Stavros", title: "Installer", phone: "(917) 555-2210", email: "estavros@nolanselectfloors.com", day_rate: 345, pay_type: "daily", daily_rate: 345, is_driver: false, active: true, hire_date: "2021-10-18", vacation_days_allowed: 10, sick_days_allowed: 5, created_at: "2021-10-18T00:00:00.000Z" },
    { id: "e-11", company_id: COMPANY_ID, first_name: "Paulie", last_name: "Reyes", title: "Demo / Floor Prep", phone: "(917) 555-2211", email: "preyes@nolanselectfloors.com", day_rate: 300, pay_type: "hourly", hourly_rate: 37.5, is_driver: false, active: true, hire_date: "2022-05-09", vacation_days_allowed: 8, sick_days_allowed: 4, created_at: "2022-05-09T00:00:00.000Z" },
    { id: "e-12", company_id: COMPANY_ID, first_name: "Chris", last_name: "Boateng", title: "Laborer", phone: "(917) 555-2212", email: "cboateng@nolanselectfloors.com", day_rate: 250, pay_type: "hourly", hourly_rate: 31.25, is_driver: false, active: true, hire_date: "2023-02-27", created_at: "2023-02-27T00:00:00.000Z" },
  ];

  const skillMap: Record<string, string[]> = {
    "e-1": ["Supervisor/Foreman", "Installer", "Hardwood", "Driver"],
    "e-2": ["Installer", "Hardwood", "LVP", "Driver"],
    "e-3": ["Sander", "Floor Prep"],
    "e-4": ["Finisher", "Staining"],
    "e-5": ["Installer", "LVP", "Laminate"],
    "e-6": ["Installer", "Laborer", "Driver", "Furniture Moving"],
    "e-7": ["Tile", "Floor Prep"],
    "e-8": ["Carpet", "Installer"],
    "e-9": ["Laborer", "Furniture Moving", "Delivery/Pickup", "Driver"],
    "e-10": ["Installer", "Subfloor Repair", "Baseboard/Trim"],
    "e-11": ["Demolition", "Floor Prep", "Laborer"],
    "e-12": ["Laborer", "Furniture Moving"],
  };
  const employeeSkills: EmployeeSkill[] = [];
  let skillId = 1;
  for (const [empId, caps] of Object.entries(skillMap)) {
    for (const cap of caps) {
      employeeSkills.push({ id: `es-${skillId++}`, employee_id: empId, capability: cap as EmployeeSkill["capability"] });
    }
  }

  // A handful of availability records: one vacation, one day off this week.
  const employeeAvailability: EmployeeAvailability[] = [
    { id: "av-1", employee_id: "e-7", schedule_date: t(3), status: "vacation", notes: "Approved vacation — back next Monday." },
    { id: "av-2", employee_id: "e-12", schedule_date: t(4), status: "day_off", notes: "Personal day." },
    { id: "av-3", employee_id: "e-4", schedule_date: t(1), status: "day_off" },
  ];

  // ---------------------------------------------------------------------
  // VACATION & SICK DAY TRACKER (build 7) — see
  // supabase/migrations/0007_time_off.sql and README. A handful of
  // realistic entries: one CURRENTLY ACTIVE vacation and one sick day this
  // week, each deliberately overlapping an existing schedule_assignments
  // row below (e-7 on p-11, e-4 on p-1) so the scheduling-conflict warning
  // in the Crew picker has something real to demonstrate without needing
  // to remove anyone from the crew — plus a past and a future entry for
  // realism.
  // ---------------------------------------------------------------------
  const timeOffEntries: TimeOffEntry[] = [
    {
      id: "to-1",
      company_id: COMPANY_ID,
      employee_id: "e-7", // Tommy Nguyen — scheduled on p-11 (Tile) today through +4 days below
      start_date: t(0),
      end_date: t(3),
      type: "Vacation",
      notes: "Approved vacation — back Thursday. Dispatcher forgot to pull him off p-11.",
      created_by: "Brian Travers",
      created_at: `${t(-10)}T09:00:00.000Z`,
      updated_by: "Brian Travers",
      updated_at: `${t(-10)}T09:00:00.000Z`,
    },
    {
      id: "to-2",
      company_id: COMPANY_ID,
      employee_id: "e-4", // Ray Kowalski — scheduled on p-1 (Finisher) today through +4 days below
      start_date: t(1),
      end_date: t(1),
      type: "Sick",
      notes: "Called in sick this morning.",
      created_by: "Sarah Bennett",
      created_at: `${t(1)}T06:45:00.000Z`,
      updated_by: "Sarah Bennett",
      updated_at: `${t(1)}T06:45:00.000Z`,
    },
    {
      id: "to-3",
      company_id: COMPANY_ID,
      employee_id: "e-9", // B.J. Fontaine — past vacation, realism only
      start_date: t(-20),
      end_date: t(-16),
      type: "Vacation",
      notes: "Annual trip home to visit family.",
      created_by: "Brian Travers",
      created_at: `${t(-35)}T00:00:00.000Z`,
      updated_by: "Brian Travers",
      updated_at: `${t(-35)}T00:00:00.000Z`,
    },
    {
      id: "to-4",
      company_id: COMPANY_ID,
      employee_id: "e-5", // Victor Sousa — future personal day, realism only
      start_date: t(12),
      end_date: t(12),
      type: "Personal",
      notes: "Kid's school event.",
      created_by: "Brian Travers",
      created_at: `${t(-1)}T00:00:00.000Z`,
      updated_by: "Brian Travers",
      updated_at: `${t(-1)}T00:00:00.000Z`,
    },
  ];

  // ---------------------------------------------------------------------
  // OWNER'S PERSONAL AGENDA (build 8) — a handful of realistic entries
  // across the current week: site visit meetings, a management-company
  // check-in, and a personal reminder, so /agenda has something to show
  // out of the box. All owned by the OWNER_ACTING_ID sentinel "owner" (see
  // lib/current-user.ts). Every entry is source: 'Manual' — no Google
  // Calendar sync runs in this environment (see lib/google-calendar.ts).
  // ---------------------------------------------------------------------
  const agendaEvents: AgendaEvent[] = [
    {
      id: "ag-1",
      company_id: COMPANY_ID,
      owner_user_id: "owner",
      title: "Site visit — The Wexford, Unit 4B refinish walkthrough",
      event_date: t(0),
      start_time: "09:00",
      end_time: "09:45",
      location: "220 Grove Street, Jersey City, NJ",
      notes: "Confirm stain color with tenant before crew starts sanding.",
      related_type: "building",
      related_id: "b-1",
      source: "Manual",
      external_event_id: null,
      created_at: `${t(-5)}T08:00:00.000Z`,
      updated_at: `${t(-5)}T08:00:00.000Z`,
    },
    {
      id: "ag-2",
      company_id: COMPANY_ID,
      owner_user_id: "owner",
      title: "Quarterly check-in — Vanguard Property Group",
      event_date: t(1),
      start_time: "13:30",
      end_time: "14:30",
      location: "70 Hudson St, Jersey City, NJ (their office)",
      notes: "Review Q3 job volume, discuss upcoming Liberty Harbor Lofts common-area work.",
      related_type: "client_company",
      related_id: "cc-1",
      source: "Manual",
      external_event_id: null,
      created_at: `${t(-6)}T08:00:00.000Z`,
      updated_at: `${t(-6)}T08:00:00.000Z`,
    },
    {
      id: "ag-3",
      company_id: COMPANY_ID,
      owner_user_id: "owner",
      title: "Estimate walkthrough — Harborview Tower lobby tile",
      event_date: t(2),
      start_time: "10:00",
      end_time: "11:00",
      location: "1 Harbor Drive, Stamford, CT",
      notes: "Bring laser measure — board wants final sq ft before sign-off.",
      related_type: "building",
      related_id: "b-13",
      source: "Manual",
      external_event_id: null,
      created_at: `${t(-3)}T08:00:00.000Z`,
      updated_at: `${t(-3)}T08:00:00.000Z`,
    },
    {
      id: "ag-4",
      company_id: COMPANY_ID,
      owner_user_id: "owner",
      title: "Dentist appointment",
      event_date: t(3),
      start_time: "15:00",
      end_time: null,
      location: "Jersey City Dental Group",
      notes: "Personal — not job related.",
      related_type: null,
      related_id: null,
      source: "Manual",
      external_event_id: null,
      created_at: `${t(-2)}T08:00:00.000Z`,
      updated_at: `${t(-2)}T08:00:00.000Z`,
    },
    {
      id: "ag-5",
      company_id: COMPANY_ID,
      owner_user_id: "owner",
      title: "Call: Meridian Residential Management — vendor portal renewal",
      event_date: t(4),
      start_time: "11:00",
      end_time: "11:30",
      location: null,
      notes: "Their vendor portal insurance cert expires end of month — confirm renewal submitted.",
      related_type: "client_company",
      related_id: "cc-2",
      source: "Manual",
      external_event_id: null,
      created_at: `${t(-1)}T08:00:00.000Z`,
      updated_at: `${t(-1)}T08:00:00.000Z`,
    },
  ];

  // ---------------------------------------------------------------------
  // PROJECTS
  // ---------------------------------------------------------------------
  const projectBaseSeeds = [
    { id: "p-1", company_id: COMPANY_ID, building_id: "b-1", unit_number: "4B", name: "Unit 4B — Hardwood Sand & Refinish", description: "Full sand, stain (Jacobean) and 3-coat poly finish on existing red oak.", project_value: 6200, other_cost: 150, needs_transportation: true, start_date: t(-2), target_end_date: t(2), notes: "Tenant moved out, unit is vacant — full access.", created_at: t(-20) + "T00:00:00.000Z", updated_at: nowIso + "T00:00:00.000Z" },
    { id: "p-2", company_id: COMPANY_ID, building_id: "b-2", unit_number: "12C", name: "Unit 12C — LVP Installation", description: "Remove old carpet, install 900 sq ft luxury vinyl plank.", project_value: 5400, other_cost: 0, needs_transportation: true, start_date: t(1), target_end_date: t(3), created_at: t(-10) + "T00:00:00.000Z", updated_at: nowIso + "T00:00:00.000Z" },
    { id: "p-3", company_id: COMPANY_ID, building_id: "b-5", unit_number: "Common Hallway 4th Fl", name: "4th Floor Hallway Carpet Replacement", description: "Replace worn commercial carpet tile in 4th floor corridor, ~400 sq ft.", project_value: 3800, other_cost: 0, needs_transportation: true, start_date: t(6), target_end_date: t(7), created_at: t(-8) + "T00:00:00.000Z", updated_at: nowIso + "T00:00:00.000Z" },
    { id: "p-4", company_id: COMPANY_ID, building_id: "b-6", unit_number: "8A", name: "Unit 8A — Hardwood Installation", description: "New 3/4in white oak hardwood, 650 sq ft, board install after subfloor check.", project_value: 9100, other_cost: 200, needs_transportation: true, start_date: t(9), target_end_date: t(13), notes: "Waiting on hardwood delivery before scheduling crew.", created_at: t(-15) + "T00:00:00.000Z", updated_at: nowIso + "T00:00:00.000Z" },
    { id: "p-5", company_id: COMPANY_ID, building_id: "b-9", unit_number: "3F", name: "Unit 3F — Laminate Installation", description: "Install laminate flooring throughout, 2BR unit, ~850 sq ft.", project_value: 5600, other_cost: 100, needs_transportation: true, start_date: t(-1), target_end_date: t(2), created_at: t(-18) + "T00:00:00.000Z", updated_at: nowIso + "T00:00:00.000Z" },
    { id: "p-6", company_id: COMPANY_ID, building_id: "b-13", unit_number: "Lobby", name: "Lobby Tile Renovation", description: "Demo existing terrazzo-look tile, install new porcelain tile in lobby.", project_value: 14500, other_cost: 400, needs_transportation: true, start_date: t(14), target_end_date: t(21), notes: "Board approved design, awaiting material lead time.", created_at: t(-25) + "T00:00:00.000Z", updated_at: nowIso + "T00:00:00.000Z" },
    { id: "p-7", company_id: COMPANY_ID, building_id: "b-17", unit_number: "2B", name: "Unit 2B — Carpet Replacement", description: "Full carpet replacement, 2BR unit, builder-grade to mid-grade upgrade.", project_value: 3200, other_cost: 0, needs_transportation: false, start_date: t(-12), target_end_date: t(-10), actual_end_date: t(-10), created_at: t(-40) + "T00:00:00.000Z", updated_at: t(-10) + "T00:00:00.000Z" },
    { id: "p-8", company_id: COMPANY_ID, building_id: "b-3", unit_number: "9D", name: "Unit 9D — Hardwood Sand & Finish", description: "Sand and refinish existing hardwood, natural stain, water-based poly.", project_value: 4800, other_cost: 0, needs_transportation: true, start_date: t(-6), target_end_date: t(-1), notes: "Minor touch-up needed at threshold to kitchen.", created_at: t(-30) + "T00:00:00.000Z", updated_at: nowIso + "T00:00:00.000Z" },
    { id: "p-9", company_id: COMPANY_ID, building_id: "b-7", unit_number: "15A", name: "Unit 15A — LVP Installation", description: "LVP install, 700 sq ft, includes furniture moving.", project_value: 4900, other_cost: 0, needs_transportation: true, start_date: t(3), target_end_date: t(4), created_at: t(-5) + "T00:00:00.000Z", updated_at: nowIso + "T00:00:00.000Z" },
    { id: "p-10", company_id: COMPANY_ID, building_id: "b-11", unit_number: "6C", name: "Unit 6C — Subfloor Repair + LVP", description: "Repair water-damaged subfloor section, then install LVP throughout.", project_value: 6700, other_cost: 300, needs_transportation: true, start_date: t(10), target_end_date: t(12), notes: "Subfloor plywood needs to be ordered before scheduling.", created_at: t(-7) + "T00:00:00.000Z", updated_at: nowIso + "T00:00:00.000Z" },
    { id: "p-11", company_id: COMPANY_ID, building_id: "b-14", unit_number: "Common Area", name: "Common Area Demo + Tile", description: "Demolish old vinyl composite tile in common area, install new porcelain tile.", project_value: 11800, other_cost: 250, needs_transportation: true, start_date: t(-3), target_end_date: t(4), notes: "Large debris haul-out required daily — driver essential every day.", created_at: t(-22) + "T00:00:00.000Z", updated_at: nowIso + "T00:00:00.000Z" },
    { id: "p-12", company_id: COMPANY_ID, building_id: "b-19", unit_number: "1A", name: "Unit 1A — Baseboard / Trim Replacement", description: "Replace baseboards throughout after flooring install, paint-grade.", project_value: 1800, other_cost: 0, needs_transportation: false, start_date: t(-9), target_end_date: t(-8), actual_end_date: t(-8), created_at: t(-35) + "T00:00:00.000Z", updated_at: t(-8) + "T00:00:00.000Z" },
    { id: "p-13", company_id: COMPANY_ID, building_id: "b-4", unit_number: "22F", name: "Unit 22F — Hardwood Refinish", description: "Full refinish of existing hardwood, gray-wash stain per owner request.", project_value: 5300, other_cost: 0, needs_transportation: true, start_date: t(-25), target_end_date: t(-22), actual_end_date: t(-22), created_at: t(-50) + "T00:00:00.000Z", updated_at: t(-20) + "T00:00:00.000Z" },
    { id: "p-14", company_id: COMPANY_ID, building_id: "b-18", unit_number: "3B", name: "Unit 3B — Carpet Replacement", description: "Remove and replace carpet in 1BR unit, standard grade.", project_value: 2600, other_cost: 0, needs_transportation: true, start_date: t(0), target_end_date: t(0), created_at: t(-6) + "T00:00:00.000Z", updated_at: nowIso + "T00:00:00.000Z" },
    { id: "p-15", company_id: COMPANY_ID, building_id: "b-10", unit_number: "7A", name: "Unit 7A — LVP + Baseboard", description: "LVP install throughout plus new baseboards, 2BR unit.", project_value: 6900, other_cost: 150, needs_transportation: true, start_date: t(-1), target_end_date: t(3), created_at: t(-14) + "T00:00:00.000Z", updated_at: nowIso + "T00:00:00.000Z" },
    // Extra seed bids demonstrating every bid_status/pipeline_stage combo
    // that isn't already covered by p-1..p-15's existing granular statuses
    // (unclaimed, claimed-not-started, ready for review, sent/awaiting
    // decision, rejected). See bidWorkflowById below for the full mapping.
    { id: "p-16", company_id: COMPANY_ID, building_id: "b-12", unit_number: "5C", name: "Unit 5C — Lounge Touch-Up Bid", description: "Spot-refinish request for resident lounge floor scuffs.", project_value: 1400, other_cost: 0, needs_transportation: false, created_at: t(-13) + "T00:00:00.000Z", updated_at: t(-9) + "T00:00:00.000Z" },
    { id: "p-17", company_id: COMPANY_ID, building_id: "b-7", unit_number: "9F", name: "Unit 9F — LVP Install Bid", description: "Turnover unit LVP install, 600 sq ft, awaiting internal review before sending.", project_value: 4200, other_cost: 0, needs_transportation: true, created_at: t(-4) + "T00:00:00.000Z", updated_at: t(-1) + "T00:00:00.000Z" },
    { id: "p-18", company_id: COMPANY_ID, building_id: "b-2", unit_number: "3D", name: "Unit 3D — Hardwood Refinish Bid", description: "Sand and refinish estimate sent to Vanguard, awaiting board decision.", project_value: 5100, other_cost: 0, needs_transportation: true, created_at: t(-6) + "T00:00:00.000Z", updated_at: t(-2) + "T00:00:00.000Z" },
    { id: "p-19", company_id: COMPANY_ID, building_id: "b-16", unit_number: "2A", name: "Unit 2A — Carpet Replacement Bid", description: "Standard-grade carpet swap for turnover unit, just claimed.", project_value: 2300, other_cost: 0, needs_transportation: true, created_at: t(-1) + "T00:00:00.000Z", updated_at: t(-1) + "T00:00:00.000Z" },
  ];

  // ---------------------------------------------------------------------
  // BID WORKFLOW: pipeline_stage / bid_status / estimator / timestamps
  // ---------------------------------------------------------------------
  // Keyed lookup so the project literals above stay focused on the job
  // itself. Every project gets a pipeline_stage + bid_status (defaulting to
  // "Bid Sent" / "Unclaimed" below); this table overrides both plus
  // assigned_estimator_id and the set-once lifecycle timestamps, so the
  // seed data demonstrates every stage of the simplified 5-stage pipeline
  // (see README "Project Pipeline Stage Simplification") and every
  // bid_status at least once — including one Unclaimed, one Claimed
  // (not-yet-started), one In Progress, one Ready for Review, one
  // Completed/Sent (Awaiting Decision), and one Rejected.
  const bidWorkflowById: Record<string, Partial<Project>> = {
    "p-1": { pipeline_stage: "In Progress", bid_status: "Accepted", assigned_estimator_id: "ou-1", claimed_at: `${t(-19)}T09:00:00.000Z`, bid_claimed_at: `${t(-19)}T09:00:00.000Z`, bid_completed_at: `${t(-18)}T00:00:00.000Z`, bid_sent_at: `${t(-18)}T12:00:00.000Z`, bid_accepted_at: `${t(-17)}T09:00:00.000Z`, scheduled_at: `${t(-3)}T09:00:00.000Z`, sent_to_crew_at: `${t(-3)}T09:00:00.000Z`, project_started_at: `${t(-2)}T07:00:00.000Z` },
    "p-2": { pipeline_stage: "Scheduled", bid_status: "Accepted", assigned_estimator_id: "ou-2", claimed_at: `${t(-9)}T09:00:00.000Z`, bid_claimed_at: `${t(-9)}T09:00:00.000Z`, bid_completed_at: `${t(-8)}T00:00:00.000Z`, bid_sent_at: `${t(-8)}T12:00:00.000Z`, bid_accepted_at: `${t(-7)}T09:00:00.000Z`, scheduled_at: `${t(-6)}T09:00:00.000Z` },
    "p-3": { pipeline_stage: "In Progress", bid_status: "Accepted", assigned_estimator_id: "ou-3", claimed_at: `${t(-7)}T09:00:00.000Z`, bid_claimed_at: `${t(-7)}T09:00:00.000Z`, bid_completed_at: `${t(-6)}T00:00:00.000Z`, bid_sent_at: `${t(-6)}T12:00:00.000Z`, bid_accepted_at: `${t(-5)}T09:00:00.000Z`, scheduled_at: `${t(-2)}T09:00:00.000Z`, sent_to_crew_at: `${t(-1)}T09:00:00.000Z` },
    "p-4": { pipeline_stage: "Bid Accepted", bid_status: "Accepted", assigned_estimator_id: "ou-1", claimed_at: `${t(-14)}T09:00:00.000Z`, bid_claimed_at: `${t(-14)}T09:00:00.000Z`, bid_completed_at: `${t(-13)}T00:00:00.000Z`, bid_sent_at: `${t(-13)}T12:00:00.000Z`, bid_accepted_at: `${t(-12)}T09:00:00.000Z` },
    "p-5": { pipeline_stage: "In Progress", bid_status: "Accepted", assigned_estimator_id: "ou-2", claimed_at: `${t(-17)}T09:00:00.000Z`, bid_claimed_at: `${t(-17)}T09:00:00.000Z`, bid_completed_at: `${t(-16)}T00:00:00.000Z`, bid_sent_at: `${t(-16)}T12:00:00.000Z`, bid_accepted_at: `${t(-15)}T09:00:00.000Z`, scheduled_at: `${t(-4)}T09:00:00.000Z`, sent_to_crew_at: `${t(-2)}T09:00:00.000Z`, project_started_at: `${t(-1)}T07:00:00.000Z` },
    "p-6": { pipeline_stage: "Bid Sent", bid_status: "In Progress", assigned_estimator_id: "ou-3", claimed_at: `${t(-24)}T09:00:00.000Z`, bid_claimed_at: `${t(-24)}T09:00:00.000Z` },
    "p-7": { pipeline_stage: "Complete", bid_status: "Accepted", assigned_estimator_id: "ou-1", claimed_at: `${t(-39)}T09:00:00.000Z`, bid_claimed_at: `${t(-39)}T09:00:00.000Z`, bid_completed_at: `${t(-38)}T00:00:00.000Z`, bid_sent_at: `${t(-38)}T12:00:00.000Z`, bid_accepted_at: `${t(-37)}T09:00:00.000Z`, scheduled_at: `${t(-13)}T09:00:00.000Z`, sent_to_crew_at: `${t(-13)}T09:00:00.000Z`, project_started_at: `${t(-12)}T07:00:00.000Z`, project_completed_at: `${t(-10)}T17:00:00.000Z` },
    "p-8": { pipeline_stage: "In Progress", bid_status: "Accepted", assigned_estimator_id: "ou-2", claimed_at: `${t(-29)}T09:00:00.000Z`, bid_claimed_at: `${t(-29)}T09:00:00.000Z`, bid_completed_at: `${t(-28)}T00:00:00.000Z`, bid_sent_at: `${t(-28)}T12:00:00.000Z`, bid_accepted_at: `${t(-27)}T09:00:00.000Z`, scheduled_at: `${t(-7)}T09:00:00.000Z`, sent_to_crew_at: `${t(-7)}T09:00:00.000Z`, project_started_at: `${t(-6)}T07:00:00.000Z` },
    "p-9": { pipeline_stage: "Bid Sent", bid_status: "Unclaimed" },
    "p-10": { pipeline_stage: "Bid Accepted", bid_status: "Accepted", assigned_estimator_id: "ou-3", claimed_at: `${t(-6)}T09:00:00.000Z`, bid_claimed_at: `${t(-6)}T09:00:00.000Z`, bid_completed_at: `${t(-5)}T00:00:00.000Z`, bid_sent_at: `${t(-5)}T12:00:00.000Z`, bid_accepted_at: `${t(-4)}T09:00:00.000Z` },
    "p-11": { pipeline_stage: "In Progress", bid_status: "Accepted", assigned_estimator_id: "ou-1", claimed_at: `${t(-21)}T09:00:00.000Z`, bid_claimed_at: `${t(-21)}T09:00:00.000Z`, bid_completed_at: `${t(-20)}T00:00:00.000Z`, bid_sent_at: `${t(-20)}T12:00:00.000Z`, bid_accepted_at: `${t(-19)}T09:00:00.000Z`, scheduled_at: `${t(-4)}T09:00:00.000Z`, sent_to_crew_at: `${t(-4)}T09:00:00.000Z`, project_started_at: `${t(-3)}T07:00:00.000Z` },
    "p-12": { pipeline_stage: "Complete", bid_status: "Accepted", assigned_estimator_id: "ou-2", claimed_at: `${t(-34)}T09:00:00.000Z`, bid_claimed_at: `${t(-34)}T09:00:00.000Z`, bid_completed_at: `${t(-33)}T00:00:00.000Z`, bid_sent_at: `${t(-33)}T12:00:00.000Z`, bid_accepted_at: `${t(-32)}T09:00:00.000Z`, scheduled_at: `${t(-10)}T09:00:00.000Z`, sent_to_crew_at: `${t(-10)}T09:00:00.000Z`, project_started_at: `${t(-9)}T07:00:00.000Z`, project_completed_at: `${t(-8)}T17:00:00.000Z` },
    "p-13": { pipeline_stage: "Complete", bid_status: "Accepted", assigned_estimator_id: "ou-3", claimed_at: `${t(-49)}T09:00:00.000Z`, bid_claimed_at: `${t(-49)}T09:00:00.000Z`, bid_completed_at: `${t(-48)}T00:00:00.000Z`, bid_sent_at: `${t(-48)}T12:00:00.000Z`, bid_accepted_at: `${t(-47)}T09:00:00.000Z`, scheduled_at: `${t(-26)}T09:00:00.000Z`, sent_to_crew_at: `${t(-26)}T09:00:00.000Z`, project_started_at: `${t(-25)}T07:00:00.000Z`, project_completed_at: `${t(-22)}T17:00:00.000Z` },
    "p-14": { pipeline_stage: "Scheduled", bid_status: "Accepted", assigned_estimator_id: "ou-1", claimed_at: `${t(-5)}T09:00:00.000Z`, bid_claimed_at: `${t(-5)}T09:00:00.000Z`, bid_completed_at: `${t(-4)}T00:00:00.000Z`, bid_sent_at: `${t(-4)}T12:00:00.000Z`, bid_accepted_at: `${t(-3)}T09:00:00.000Z`, scheduled_at: `${t(-2)}T09:00:00.000Z` },
    "p-15": { pipeline_stage: "In Progress", bid_status: "Accepted", assigned_estimator_id: "ou-2", claimed_at: `${t(-13)}T09:00:00.000Z`, bid_claimed_at: `${t(-13)}T09:00:00.000Z`, bid_completed_at: `${t(-12)}T00:00:00.000Z`, bid_sent_at: `${t(-12)}T12:00:00.000Z`, bid_accepted_at: `${t(-11)}T09:00:00.000Z`, scheduled_at: `${t(-2)}T09:00:00.000Z`, sent_to_crew_at: `${t(-2)}T09:00:00.000Z`, project_started_at: `${t(-1)}T07:00:00.000Z` },
    // Rejected bid — client declined, still sitting in Bid Sent stage.
    "p-16": { pipeline_stage: "Bid Sent", bid_status: "Rejected", assigned_estimator_id: "ou-1", claimed_at: `${t(-13)}T09:00:00.000Z`, bid_claimed_at: `${t(-13)}T09:00:00.000Z`, bid_completed_at: `${t(-11)}T00:00:00.000Z`, bid_sent_at: `${t(-11)}T12:00:00.000Z` },
    // Ready for internal review, not yet sent — "Ready/Completed" column.
    "p-17": { pipeline_stage: "Bid Sent", bid_status: "Ready for Review", assigned_estimator_id: "ou-2", claimed_at: `${t(-4)}T09:00:00.000Z`, bid_claimed_at: `${t(-4)}T09:00:00.000Z`, bid_completed_at: `${t(-1)}T15:00:00.000Z` },
    // Sent to client, awaiting their decision — "Awaiting Decision" column.
    "p-18": { pipeline_stage: "Bid Sent", bid_status: "Completed/Sent", assigned_estimator_id: "ou-3", claimed_at: `${t(-6)}T09:00:00.000Z`, bid_claimed_at: `${t(-6)}T09:00:00.000Z`, bid_completed_at: `${t(-3)}T00:00:00.000Z`, bid_sent_at: `${t(-2)}T12:00:00.000Z` },
    // Just claimed, estimator hasn't started the estimate yet.
    "p-19": { pipeline_stage: "Bid Sent", bid_status: "Claimed", assigned_estimator_id: "ou-1", claimed_at: `${t(-1)}T14:00:00.000Z`, bid_claimed_at: `${t(-1)}T14:00:00.000Z` },
  };

  const projects: Project[] = projectBaseSeeds.map((p) => ({
    pipeline_stage: "Bid Sent",
    bid_status: "Unclaimed",
    ...p,
    ...bidWorkflowById[p.id],
  })) as Project[];

  const workTypeMap: Record<string, string[]> = {
    "p-1": ["Floor Sanding", "Staining", "Finishing"],
    "p-2": ["LVP Installation", "Furniture Moving"],
    "p-3": ["Carpet Installation"],
    "p-4": ["Floor Preparation", "Hardwood Installation"],
    "p-5": ["Laminate Installation"],
    "p-6": ["Demolition", "Tile"],
    "p-7": ["Carpet Installation"],
    "p-8": ["Floor Sanding", "Finishing", "Repairs"],
    "p-9": ["LVP Installation", "Furniture Moving"],
    "p-10": ["Subfloor Repair", "LVP Installation"],
    "p-11": ["Demolition", "Tile", "Floor Preparation"],
    "p-12": ["Baseboard/Trim"],
    "p-13": ["Floor Sanding", "Staining", "Finishing"],
    "p-14": ["Carpet Installation"],
    "p-15": ["LVP Installation", "Baseboard/Trim"],
  };
  const projectWorkTypes: ProjectWorkType[] = [];
  let wtId = 1;
  for (const [pid, types] of Object.entries(workTypeMap)) {
    for (const t of types) {
      projectWorkTypes.push({ id: `pwt-${wtId++}`, project_id: pid, work_type: t as ProjectWorkType["work_type"] });
    }
  }

  // ---------------------------------------------------------------------
  // JOB REQUESTS (some converted, some still pipeline)
  // ---------------------------------------------------------------------
  const jobRequests: JobRequest[] = [
    { id: "jr-1", company_id: COMPANY_ID, building_id: "b-8", contact_id: "ct-3", unit_number: "5th Fl Corridor", description: "Replace worn carpet tile in 5th floor common corridor, board complained about trip hazard.", status: "New Request", received_via: "phone", received_at: `${t(-1)}T09:14:00.000Z`, created_at: `${t(-1)}T09:14:00.000Z`, updated_at: `${t(-1)}T09:14:00.000Z` },
    { id: "jr-2", company_id: COMPANY_ID, building_id: "b-12", contact_id: "ct-6", unit_number: "2F", description: "Water damage to hardwood near kitchen, needs assessment for repair vs. full refinish.", status: "Site Visit Required", received_via: "email", received_at: `${t(-3)}T14:02:00.000Z`, created_at: `${t(-3)}T14:02:00.000Z`, updated_at: `${t(-2)}T10:00:00.000Z` },
    { id: "jr-3", company_id: COMPANY_ID, building_id: "b-15", contact_id: "ct-8", unit_number: "14", description: "Full flooring replacement for turnover unit — LVP throughout, 750 sq ft.", status: "Estimate Sent", received_via: "email", received_at: `${t(-9)}T11:30:00.000Z`, site_visit_date: t(-6), estimate_amount: 5200, estimate_sent_at: `${t(-4)}T16:00:00.000Z`, created_at: `${t(-9)}T11:30:00.000Z`, updated_at: `${t(-4)}T16:00:00.000Z` },
    { id: "jr-4", company_id: COMPANY_ID, building_id: "b-16", contact_id: "ct-9", unit_number: "Common Area", description: "Refinish hardwood in resident lounge, board requesting quote for two stain options.", status: "Awaiting Approval", received_via: "text", received_at: `${t(-11)}T08:45:00.000Z`, site_visit_date: t(-8), estimate_amount: 7400, estimate_sent_at: `${t(-6)}T13:00:00.000Z`, created_at: `${t(-11)}T08:45:00.000Z`, updated_at: `${t(-6)}T13:00:00.000Z` },
    { id: "jr-5", company_id: COMPANY_ID, building_id: "b-20", contact_id: "ct-10", unit_number: "6D", description: "New tenant flooring refresh — LVP install, 600 sq ft.", status: "Ready to Schedule", received_via: "phone", received_at: `${t(-14)}T10:00:00.000Z`, site_visit_date: t(-11), estimate_amount: 4300, estimate_sent_at: `${t(-9)}T12:00:00.000Z`, approved_at: `${t(-7)}T09:00:00.000Z`, created_at: `${t(-14)}T10:00:00.000Z`, updated_at: `${t(-7)}T09:00:00.000Z` },
    { id: "jr-6", company_id: COMPANY_ID, building_id: "b-6", contact_id: "ct-4", unit_number: "10B", description: "Requested full hardwood replacement, board declined due to budget this fiscal year.", status: "Declined", received_via: "email", received_at: `${t(-30)}T09:00:00.000Z`, estimate_amount: 8900, estimate_sent_at: `${t(-25)}T09:00:00.000Z`, created_at: `${t(-30)}T09:00:00.000Z`, updated_at: `${t(-20)}T09:00:00.000Z` },
    { id: "jr-7", company_id: COMPANY_ID, building_id: "b-1", contact_id: "ct-1", unit_number: "4B", description: "Full sand and refinish of existing hardwood in vacant unit before new tenant moves in.", status: "Converted to Project", received_via: "phone", received_at: `${t(-22)}T09:00:00.000Z`, site_visit_date: t(-20), estimate_amount: 6200, estimate_sent_at: `${t(-19)}T09:00:00.000Z`, approved_at: `${t(-17)}T09:00:00.000Z`, converted_project_id: "p-1", created_at: `${t(-22)}T09:00:00.000Z`, updated_at: `${t(-17)}T09:00:00.000Z` },
    { id: "jr-8", company_id: COMPANY_ID, building_id: "b-9", contact_id: "ct-6", unit_number: "3F", description: "Laminate install requested for turnover unit ahead of new lease start.", status: "Converted to Project", received_via: "text", received_at: `${t(-20)}T09:00:00.000Z`, site_visit_date: t(-18), estimate_amount: 5600, estimate_sent_at: `${t(-17)}T09:00:00.000Z`, approved_at: `${t(-15)}T09:00:00.000Z`, converted_project_id: "p-5", created_at: `${t(-20)}T09:00:00.000Z`, updated_at: `${t(-15)}T09:00:00.000Z` },
    // Duplicate-bid override demo: a second request for the same
    // building+unit as the already-open project p-1 (The Wexford, 4B).
    // Office staff saw the "Possible duplicate bid" warning when creating
    // this and clicked "Create Anyway" with a reason — logged below in
    // activityLog so the override is visible in seed history.
    { id: "jr-9", company_id: COMPANY_ID, building_id: "b-1", contact_id: "ct-1", unit_number: "4B", description: "Resident called again about dust left behind after the hardwood refinish — wants a cleanup visit.", status: "New Request", received_via: "phone", received_at: `${t(-1)}T11:40:00.000Z`, created_at: `${t(-1)}T11:40:00.000Z`, updated_at: `${t(-1)}T11:40:00.000Z` },
  ];

  // ---------------------------------------------------------------------
  // MATERIALS
  // ---------------------------------------------------------------------
  const materials: Material[] = [
    { id: "m-1", company_id: COMPANY_ID, name: "Red Oak Solid Hardwood 3/4in", category: "Hardwood", supplier: "Metro Hardwood Supply", unit: "sq ft", created_at: "2019-05-01T00:00:00.000Z" },
    { id: "m-2", company_id: COMPANY_ID, name: "White Oak Solid Hardwood 3/4in", category: "Hardwood", supplier: "Metro Hardwood Supply", unit: "sq ft", created_at: "2019-05-01T00:00:00.000Z" },
    { id: "m-3", company_id: COMPANY_ID, name: "Luxury Vinyl Plank — Coastal Gray", category: "LVP", supplier: "Tri-State Flooring Distributors", unit: "sq ft", created_at: "2019-05-01T00:00:00.000Z" },
    { id: "m-4", company_id: COMPANY_ID, name: "Laminate Plank — Weathered Oak", category: "Laminate", supplier: "Tri-State Flooring Distributors", unit: "sq ft", created_at: "2019-05-01T00:00:00.000Z" },
    { id: "m-5", company_id: COMPANY_ID, name: "Commercial Carpet Tile", category: "Carpet", supplier: "Empire Carpet & Textile", unit: "sq ft", created_at: "2019-05-01T00:00:00.000Z" },
    { id: "m-6", company_id: COMPANY_ID, name: "Porcelain Tile 12x24", category: "Tile", supplier: "Statewide Tile & Stone", unit: "sq ft", created_at: "2019-05-01T00:00:00.000Z" },
    { id: "m-7", company_id: COMPANY_ID, name: "3/4in Plywood Subfloor Sheet", category: "Subfloor", supplier: "Metro Hardwood Supply", unit: "sheet", created_at: "2019-05-01T00:00:00.000Z" },
    { id: "m-8", company_id: COMPANY_ID, name: "Water-Based Polyurethane, Satin", category: "Finish", supplier: "Bona Pro Supply", unit: "gallon", created_at: "2019-05-01T00:00:00.000Z" },
    { id: "m-9", company_id: COMPANY_ID, name: "Jacobean Wood Stain", category: "Finish", supplier: "Bona Pro Supply", unit: "gallon", created_at: "2019-05-01T00:00:00.000Z" },
    { id: "m-10", company_id: COMPANY_ID, name: "Paint-Grade Baseboard 3.25in", category: "Trim", supplier: "Metro Hardwood Supply", unit: "linear ft", created_at: "2019-05-01T00:00:00.000Z" },
  ];

  const projectMaterials: ProjectMaterial[] = [
    { id: "pm-1", company_id: COMPANY_ID, project_id: "p-1", material_id: "m-9", description: "Jacobean stain, 3 gallons", quantity: 3, unit: "gallon", cost: 210, status: "Delivered", supplier: "Bona Pro Supply", ordered_at: `${t(-6)}T00:00:00.000Z`, expected_delivery: t(-3), delivered_at: `${t(-3)}T00:00:00.000Z`, created_at: `${t(-6)}T00:00:00.000Z` },
    { id: "pm-2", company_id: COMPANY_ID, project_id: "p-1", material_id: "m-8", description: "Water-based poly, satin, 4 gallons", quantity: 4, unit: "gallon", cost: 380, status: "Delivered", supplier: "Bona Pro Supply", ordered_at: `${t(-6)}T00:00:00.000Z`, expected_delivery: t(-3), delivered_at: `${t(-3)}T00:00:00.000Z`, created_at: `${t(-6)}T00:00:00.000Z` },
    { id: "pm-3", company_id: COMPANY_ID, project_id: "p-2", material_id: "m-3", description: "Coastal Gray LVP, 900 sq ft", quantity: 900, unit: "sq ft", cost: 3150, status: "Ordered", supplier: "Tri-State Flooring Distributors", ordered_at: `${t(-4)}T00:00:00.000Z`, expected_delivery: t(-1), created_at: `${t(-4)}T00:00:00.000Z`, notes: "Delivery slipped past expected date — follow up with supplier." },
    { id: "pm-4", company_id: COMPANY_ID, project_id: "p-4", material_id: "m-2", description: "White oak hardwood, 650 sq ft", quantity: 650, unit: "sq ft", cost: 5850, status: "Ordered", supplier: "Metro Hardwood Supply", ordered_at: `${t(-5)}T00:00:00.000Z`, expected_delivery: t(6), created_at: `${t(-5)}T00:00:00.000Z` },
    { id: "pm-5", company_id: COMPANY_ID, project_id: "p-5", material_id: "m-4", description: "Weathered Oak laminate, 850 sq ft", quantity: 850, unit: "sq ft", cost: 2975, status: "Delivered", supplier: "Tri-State Flooring Distributors", ordered_at: `${t(-10)}T00:00:00.000Z`, expected_delivery: t(-3), delivered_at: `${t(-3)}T00:00:00.000Z`, created_at: `${t(-10)}T00:00:00.000Z` },
    { id: "pm-6", company_id: COMPANY_ID, project_id: "p-6", material_id: "m-6", description: "Porcelain tile 12x24, lobby, 1200 sq ft", quantity: 1200, unit: "sq ft", cost: 8400, status: "Quote Requested", supplier: "Statewide Tile & Stone", created_at: `${t(-2)}T00:00:00.000Z` },
    { id: "pm-7", company_id: COMPANY_ID, project_id: "p-9", material_id: "m-3", description: "Coastal Gray LVP, 700 sq ft", quantity: 700, unit: "sq ft", cost: 2450, status: "Needed", supplier: "Tri-State Flooring Distributors", created_at: `${t(-1)}T00:00:00.000Z`, notes: "Project starts in 3 days — order today to make the date." },
    { id: "pm-8", company_id: COMPANY_ID, project_id: "p-10", material_id: "m-7", description: "3/4in plywood subfloor, 12 sheets", quantity: 12, unit: "sheet", cost: 540, status: "Needed", supplier: "Metro Hardwood Supply", created_at: `${t(-1)}T00:00:00.000Z` },
    { id: "pm-9", company_id: COMPANY_ID, project_id: "p-11", material_id: "m-6", description: "Porcelain tile, common area, 500 sq ft", quantity: 500, unit: "sq ft", cost: 3500, status: "Partially Delivered", supplier: "Statewide Tile & Stone", ordered_at: `${t(-8)}T00:00:00.000Z`, expected_delivery: t(-4), delivered_at: `${t(-4)}T00:00:00.000Z`, notes: "Only 300 of 500 sq ft arrived — remainder on backorder.", created_at: `${t(-8)}T00:00:00.000Z` },
    { id: "pm-10", company_id: COMPANY_ID, project_id: "p-15", material_id: "m-3", description: "Coastal Gray LVP, 720 sq ft", quantity: 720, unit: "sq ft", cost: 2520, status: "Delivered", supplier: "Tri-State Flooring Distributors", ordered_at: `${t(-9)}T00:00:00.000Z`, expected_delivery: t(-2), delivered_at: `${t(-2)}T00:00:00.000Z`, created_at: `${t(-9)}T00:00:00.000Z` },
    { id: "pm-11", company_id: COMPANY_ID, project_id: "p-15", material_id: "m-10", description: "Paint-grade baseboard, 180 linear ft", quantity: 180, unit: "linear ft", cost: 630, status: "Problem", supplier: "Metro Hardwood Supply", ordered_at: `${t(-9)}T00:00:00.000Z`, notes: "Wrong profile delivered — return in progress, replacement needed.", created_at: `${t(-9)}T00:00:00.000Z` },
  ];

  // ---------------------------------------------------------------------
  // TASKS
  // ---------------------------------------------------------------------
  const tasks: Task[] = [
    { id: "t-1", company_id: COMPANY_ID, title: "Order LVP for Unit 15A before Thursday", description: "Need material on-site before crew starts Friday.", related_type: "project", related_id: "p-9", assigned_to: "e-1", due_date: t(1), status: "To Do", created_at: `${t(-1)}T00:00:00.000Z`, updated_at: `${t(-1)}T00:00:00.000Z` },
    { id: "t-2", company_id: COMPANY_ID, title: "Follow up with Tri-State on Unit 12C LVP delivery", description: "Delivery slipped past expected date.", related_type: "project", related_id: "p-2", assigned_to: "e-1", due_date: t(-1), status: "To Do", created_at: `${t(-3)}T00:00:00.000Z`, updated_at: `${t(-3)}T00:00:00.000Z` },
    { id: "t-3", company_id: COMPANY_ID, title: "Schedule site visit for water damage at Boerum Hill Flats 2F", related_type: "job_request", related_id: "jr-2", assigned_to: "e-1", due_date: t(0), status: "In Progress", created_at: `${t(-3)}T00:00:00.000Z`, updated_at: `${t(-1)}T00:00:00.000Z` },
    { id: "t-4", company_id: COMPANY_ID, title: "Call Beatrice Lin re: lounge stain color approval", description: "Board deciding between two samples left on-site.", related_type: "job_request", related_id: "jr-4", assigned_to: "e-1", due_date: t(-2), status: "To Do", created_at: `${t(-6)}T00:00:00.000Z`, updated_at: `${t(-6)}T00:00:00.000Z` },
    { id: "t-5", company_id: COMPANY_ID, title: "Confirm plywood subfloor order for Unit 6C", related_type: "project", related_id: "p-10", assigned_to: "e-1", due_date: t(2), status: "To Do", created_at: `${t(-1)}T00:00:00.000Z`, updated_at: `${t(-1)}T00:00:00.000Z` },
    { id: "t-6", company_id: COMPANY_ID, title: "Return incorrect baseboard profile to Metro Hardwood", related_type: "project", related_id: "p-15", assigned_to: "e-9", due_date: t(0), status: "In Progress", created_at: `${t(-2)}T00:00:00.000Z`, updated_at: nowIso + "T00:00:00.000Z" },
    { id: "t-7", company_id: COMPANY_ID, title: "Send updated COI to Harborview Management for 2026", related_type: "client_company", related_id: "cc-4", due_date: t(-5), status: "To Do", created_at: `${t(-10)}T00:00:00.000Z`, updated_at: `${t(-10)}T00:00:00.000Z` },
    { id: "t-8", company_id: COMPANY_ID, title: "Punch list touch-up at threshold, Unit 9D", related_type: "project", related_id: "p-8", assigned_to: "e-4", due_date: t(1), status: "To Do", created_at: `${t(-1)}T00:00:00.000Z`, updated_at: `${t(-1)}T00:00:00.000Z` },
    { id: "t-9", company_id: COMPANY_ID, title: "Invoice Sterling Community Associates for Unit 1A trim job", related_type: "project", related_id: "p-12", due_date: t(-3), status: "Waiting", created_at: `${t(-8)}T00:00:00.000Z`, updated_at: `${t(-3)}T00:00:00.000Z` },
    { id: "t-10", company_id: COMPANY_ID, title: "Prep quote request for lobby tile at Harborview Tower", related_type: "project", related_id: "p-6", assigned_to: "e-1", due_date: t(-1), status: "To Do", created_at: `${t(-3)}T00:00:00.000Z`, updated_at: `${t(-3)}T00:00:00.000Z` },
  ];

  // ---------------------------------------------------------------------
  // SCHEDULE: crew requirements + assignments for the current week
  // ---------------------------------------------------------------------
  // Active job sites for the current work week (today through +4 days): p-1, p-2 (starts tomorrow), p-5, p-11, p-14 (today), p-15
  const projectCrewRequirements: ProjectCrewRequirement[] = [
    { id: "pcr-1", company_id: COMPANY_ID, project_id: "p-1", schedule_date: null, role: "Sander", quantity: 1 },
    { id: "pcr-2", company_id: COMPANY_ID, project_id: "p-1", schedule_date: null, role: "Finisher", quantity: 1 },
    { id: "pcr-3", company_id: COMPANY_ID, project_id: "p-2", schedule_date: null, role: "Installer", quantity: 2 },
    { id: "pcr-4", company_id: COMPANY_ID, project_id: "p-5", schedule_date: null, role: "Installer", quantity: 2 },
    // Intentionally left unmet: p-5 also needs a Sander for one prep day, but no Sander is assigned.
    { id: "pcr-5", company_id: COMPANY_ID, project_id: "p-5", schedule_date: t(0), role: "Sander", quantity: 1 },
    { id: "pcr-6", company_id: COMPANY_ID, project_id: "p-11", schedule_date: null, role: "Demolition", quantity: 1 },
    { id: "pcr-7", company_id: COMPANY_ID, project_id: "p-11", schedule_date: null, role: "Tile", quantity: 2 },
    { id: "pcr-8", company_id: COMPANY_ID, project_id: "p-11", schedule_date: null, role: "Laborer", quantity: 1 },
    { id: "pcr-9", company_id: COMPANY_ID, project_id: "p-14", schedule_date: t(0), role: "Carpet", quantity: 1 },
    { id: "pcr-10", company_id: COMPANY_ID, project_id: "p-15", schedule_date: null, role: "Installer", quantity: 2 },
  ];

  const scheduleAssignments: ScheduleAssignment[] = [];
  let saId = 1;
  function addAssignment(
    project_id: string,
    employee_id: string,
    schedule_date: string,
    role_on_job: ScheduleAssignment["role_on_job"],
    opts?: { timeAndHalf?: boolean; callTime?: string }
  ) {
    const emp = employees.find((e) => e.id === employee_id)!;
    const rate_multiplier = opts?.timeAndHalf ? 1.5 : 1.0;
    scheduleAssignments.push({
      id: `sa-${saId++}`,
      company_id: COMPANY_ID,
      project_id,
      employee_id,
      schedule_date,
      role_on_job,
      base_day_rate: emp.day_rate,
      rate_multiplier,
      time_and_half: !!opts?.timeAndHalf,
      assignment_cost: Math.round(emp.day_rate * rate_multiplier * 100) / 100,
      call_time: opts?.callTime ?? "7:00 AM",
      created_at: `${schedule_date}T07:00:00.000Z`,
    });
  }

  // Today through +4 days: core schedule
  for (const day of [0, 1, 2, 3, 4]) {
    const date = t(day);
    // p-1: Wexford hardwood — sander + finisher, foreman driver stops by early week
    addAssignment("p-1", "e-3", date, "Sander");
    addAssignment("p-1", "e-4", date, "Finisher");
    if (day <= 1) addAssignment("p-1", "e-1", date, "Supervisor/Foreman");

    // p-5: Cobble Hill laminate — two installers (Victor + Eric); NO sander ever
    // shows up despite the Thursday requirement above -> missing-crew warning.
    addAssignment("p-5", "e-5", date, "Installer");
    addAssignment("p-5", "e-10", date, "Installer");

    // p-11: Shippan Landing demo + tile — needs a driver every day for debris
    // haul-out. Driver (Andre) covers most days but is deliberately absent
    // today and two days out to demonstrate the "NO DRIVER ASSIGNED" flag
    // (both on the Dashboard's "today" view and later in the Schedule week).
    addAssignment("p-11", "e-11", date, "Demolition");
    addAssignment("p-11", "e-7", date, "Tile");
    if (day !== 0 && day !== 2) addAssignment("p-11", "e-6", date, "Laborer"); // Andre is a driver
    if (day === 0 || day === 2) addAssignment("p-11", "e-12", date, "Laborer"); // Chris covers, not a driver

    // p-15: Fort Greene LVP + baseboard — two installers
    addAssignment("p-15", "e-2", date, "Installer");
    addAssignment("p-15", "e-9", date, "Delivery/Pickup");
  }

  // p-2 starts tomorrow through +3 days, two installers
  for (const day of [1, 2, 3]) {
    addAssignment("p-2", "e-2", t(day), "Installer");
    addAssignment("p-2", "e-8", t(day), "Installer");
  }

  // Intentional double-booking: Dennis Cho (e-2) is booked on both p-15 (all
  // week) AND p-2 on day 1 — a real dispatcher error to demonstrate the
  // double-booking warning on the schedule.
  // (p-15 assignment for e-2 on t(1) already added in the main loop above.)

  // Saturday time-and-half push on p-11 to hit a hard deadline for the board
  // meeting Monday — Miguel supervises at time-and-half.
  addAssignment("p-11", "e-1", t(5), "Supervisor/Foreman", { timeAndHalf: true });
  addAssignment("p-11", "e-11", t(5), "Demolition", { timeAndHalf: true });

  // p-14 single-day carpet job, today
  addAssignment("p-14", "e-8", t(0), "Carpet");

  // Historical crew for the completed job used to populate a real
  // Completed Job Summary (p-7 — Sterling Pointe 2B carpet replacement,
  // Project Completed, ran t(-12) through t(-10)).
  addAssignment("p-7", "e-8", t(-12), "Carpet");
  addAssignment("p-7", "e-9", t(-12), "Laborer");
  addAssignment("p-7", "e-8", t(-11), "Carpet");
  addAssignment("p-7", "e-8", t(-10), "Carpet");

  // ---------------------------------------------------------------------
  // WORK TYPES (schedule-facing lookup table — see 0005_schedule_redesign.sql)
  // ---------------------------------------------------------------------
  const workTypeSeedNames = [
    "Hardwood Installation", "Floor Sanding", "Staining", "Finishing",
    "LVP Installation", "Laminate Installation", "Carpet Installation",
    "Tile", "Demolition", "Floor Preparation", "Subfloor Repair",
    "Baseboard/Trim", "Furniture Moving", "Repairs", "Other",
    "Installation", "Repair",
  ];
  const workTypes: WorkTypeRecord[] = workTypeSeedNames.map((name, i) => ({
    id: `wt-${i + 1}`,
    company_id: COMPANY_ID,
    name,
    active: true,
    created_at: "2024-01-01T00:00:00.000Z",
  }));
  const workTypeIdByName = new Map(workTypes.map((w) => [w.name, w.id]));

  // ---------------------------------------------------------------------
  // PROJECT SCHEDULE DAYS — the "one row per job per day" entity the Daily
  // schedule list renders. See README for the full data-model write-up.
  // Deliberately covers every schedule color, every COI/materials status,
  // and every job status at least once across the current week.
  // ---------------------------------------------------------------------
  let sdId = 1;
  function addScheduleDay(
    project_id: string,
    schedule_date: string,
    opts: {
      color: ProjectScheduleDay["schedule_color"];
      coi?: ProjectScheduleDay["coi_status"];
      materials?: ProjectScheduleDay["materials_status"];
      jobStatus: ProjectScheduleDay["job_status"];
      workType?: string;
      notes?: string;
    }
  ): ProjectScheduleDay {
    const row: ProjectScheduleDay = {
      id: `psd-${sdId++}`,
      company_id: COMPANY_ID,
      project_id,
      schedule_date,
      schedule_color: opts.color,
      coi_status: opts.coi ?? "Not Sent",
      materials_status: opts.materials ?? "Not Ordered",
      job_status: opts.jobStatus,
      work_type_id: opts.workType ? workTypeIdByName.get(opts.workType) : undefined,
      notes: opts.notes,
      created_by: "Miguel Alvarez",
      updated_by: "Miguel Alvarez",
      created_at: `${schedule_date}T06:00:00.000Z`,
      updated_at: `${schedule_date}T06:00:00.000Z`,
    };
    return row;
  }

  const projectScheduleDays: ProjectScheduleDay[] = [
    // p-1 — Wexford 4B hardwood sand & finish, In Progress (continuation).
    addScheduleDay("p-1", t(0), { color: "Gray", coi: "Approved", materials: "Sent/Delivered", jobStatus: "In Progress", workType: "Floor Sanding" }),
    addScheduleDay("p-1", t(1), { color: "Yellow", coi: "Approved", materials: "Sent/Delivered", jobStatus: "In Progress", workType: "Staining", notes: "Priority: board walkthrough at 10am — keep hallway clear." }),
    addScheduleDay("p-1", t(2), { color: "Gray", coi: "Approved", materials: "Sent/Delivered", jobStatus: "In Progress", workType: "Finishing" }),
    addScheduleDay("p-1", t(3), { color: "Gray", coi: "Approved", materials: "Sent/Delivered", jobStatus: "In Progress", workType: "Finishing" }),
    addScheduleDay("p-1", t(4), { color: "Gray", coi: "Approved", materials: "Sent/Delivered", jobStatus: "In Progress", workType: "Finishing" }),
    // p-2 — Liberty Harbor 12C LVP, starts tomorrow.
    addScheduleDay("p-2", t(1), { color: "Blue", coi: "Not Sent", materials: "Ordered", jobStatus: "Scheduled", workType: "LVP Installation", notes: "Delivery ran a day late — confirm material on-site before crew arrives." }),
    addScheduleDay("p-2", t(2), { color: "Gray", coi: "Not Sent", materials: "Ordered", jobStatus: "Scheduled", workType: "LVP Installation" }),
    addScheduleDay("p-2", t(3), { color: "Gray", coi: "Sent", materials: "Sent/Delivered", jobStatus: "Scheduled", workType: "LVP Installation" }),
    // p-5 — Cobble Hill 3F laminate, In Progress (started yesterday).
    addScheduleDay("p-5", t(0), { color: "Gray", coi: "Sent", materials: "Sent/Delivered", jobStatus: "In Progress", workType: "Laminate Installation" }),
    addScheduleDay("p-5", t(1), { color: "Gray", coi: "Sent", materials: "Sent/Delivered", jobStatus: "In Progress", workType: "Laminate Installation" }),
    addScheduleDay("p-5", t(2), { color: "Gray", coi: "Sent", materials: "Sent/Delivered", jobStatus: "In Progress", workType: "Laminate Installation" }),
    addScheduleDay("p-5", t(3), { color: "Gray", coi: "Sent", materials: "Sent/Delivered", jobStatus: "In Progress", workType: "Laminate Installation" }),
    addScheduleDay("p-5", t(4), { color: "Gray", coi: "Sent", materials: "Sent/Delivered", jobStatus: "In Progress", workType: "Laminate Installation" }),
    // p-11 — Shippan Landing common area demo + tile, In Progress.
    addScheduleDay("p-11", t(0), { color: "Gray", coi: "In Progress", materials: "Ordered", jobStatus: "In Progress", workType: "Demolition" }),
    addScheduleDay("p-11", t(1), { color: "Gray", coi: "In Progress", materials: "Ordered", jobStatus: "In Progress", workType: "Tile" }),
    addScheduleDay("p-11", t(2), { color: "Pink", coi: "In Progress", materials: "Ordered", jobStatus: "In Progress", workType: "Tile", notes: "Remaining 200 sq ft of tile on backorder — confirm delivery before committing crew for the day." }),
    addScheduleDay("p-11", t(3), { color: "Gray", coi: "Approved", materials: "Sent/Delivered", jobStatus: "In Progress", workType: "Tile" }),
    addScheduleDay("p-11", t(4), { color: "Gray", coi: "Approved", materials: "Sent/Delivered", jobStatus: "In Progress", workType: "Tile" }),
    addScheduleDay("p-11", t(5), { color: "Yellow", coi: "Approved", materials: "Sent/Delivered", jobStatus: "In Progress", workType: "Demolition", notes: "Priority Saturday push (time-and-half) to hit Monday board meeting deadline." }),
    // p-14 — Bayside Commons 3B carpet, single day, today.
    addScheduleDay("p-14", t(0), { color: "Blue", coi: "Approved", materials: "Sent/Delivered", jobStatus: "Scheduled", workType: "Carpet Installation" }),
    // p-15 — Fort Greene 7A LVP + baseboard, In Progress.
    addScheduleDay("p-15", t(0), { color: "Gray", coi: "Sent", materials: "Sent/Delivered", jobStatus: "In Progress", workType: "LVP Installation" }),
    addScheduleDay("p-15", t(1), { color: "Pink", coi: "Sent", materials: "Not Ordered", jobStatus: "In Progress", workType: "Baseboard/Trim", notes: "Wrong baseboard profile delivered — return in progress, install may slip until replacement ships." }),
    addScheduleDay("p-15", t(2), { color: "Gray", coi: "Sent", materials: "Not Ordered", jobStatus: "In Progress", workType: "Baseboard/Trim" }),
    addScheduleDay("p-15", t(3), { color: "Gray", coi: "Sent", materials: "Not Ordered", jobStatus: "In Progress", workType: "Baseboard/Trim" }),
    addScheduleDay("p-15", t(4), { color: "Gray", coi: "Sent", materials: "Not Ordered", jobStatus: "In Progress", workType: "Baseboard/Trim" }),
    // p-7 — Sterling Pointe 2B carpet replacement, Project Completed. Full
    // historical run so the Completed Job Summary has real data to compile.
    addScheduleDay("p-7", t(-12), { color: "Blue", coi: "Approved", materials: "Sent/Delivered", jobStatus: "Complete", workType: "Carpet Installation" }),
    addScheduleDay("p-7", t(-11), { color: "Gray", coi: "Approved", materials: "Sent/Delivered", jobStatus: "Complete", workType: "Carpet Installation" }),
    addScheduleDay("p-7", t(-10), { color: "Gray", coi: "Approved", materials: "Sent/Delivered", jobStatus: "Complete", workType: "Carpet Installation", notes: "Final walkthrough with Anthony Musco — no punch list items." }),
  ];

  // ---------------------------------------------------------------------
  // SCHEDULE PICKUP ITEMS — "Items to Order / Collect" (build 8). A
  // lightweight per-schedule-entry checklist, deliberately separate from
  // the heavier project_materials system — see README / lib/types.ts
  // SchedulePickupItem. A handful across a few schedule days, mixing
  // Needed/Collected, so the feature has real demo data on both View
  // Schedule and Create/Edit Schedule.
  // ---------------------------------------------------------------------
  function scheduleDayId(projectId: string, date: string): string {
    const day = projectScheduleDays.find((d) => d.project_id === projectId && d.schedule_date === date);
    if (!day) throw new Error(`Seed data: no schedule day for ${projectId} on ${date}`);
    return day.id;
  }
  let spiId = 1;
  function addPickupItem(
    projectId: string,
    date: string,
    description: string,
    status: SchedulePickupItem["status"]
  ): SchedulePickupItem {
    return {
      id: `spi-${spiId++}`,
      company_id: COMPANY_ID,
      project_schedule_day_id: scheduleDayId(projectId, date),
      description,
      status,
      created_by: "Miguel Alvarez",
      updated_by: "Miguel Alvarez",
      created_at: `${date}T06:30:00.000Z`,
      updated_at: `${date}T06:30:00.000Z`,
    };
  }
  const schedulePickupItems: SchedulePickupItem[] = [
    // p-1 — Wexford 4B, priority staining day.
    addPickupItem("p-1", t(1), "3 buckets of wood glue", "Needed"),
    addPickupItem("p-1", t(1), "Box of finish nails", "Collected"),
    // p-2 — Liberty Harbor 12C, LVP starting tomorrow.
    addPickupItem("p-2", t(1), "Roll of blue painter's tape", "Needed"),
    // p-11 — Shippan Landing common area, tile on backorder day.
    addPickupItem("p-11", t(2), "Pick up dumpster key from super", "Needed"),
    addPickupItem("p-11", t(2), "Extra grout — matching sample from unit 2B", "Collected"),
    // p-15 — Fort Greene 7A, baseboard return-in-progress day.
    addPickupItem("p-15", t(1), "Replacement baseboard profile — confirm with supplier before pickup", "Needed"),
  ];

  // ---------------------------------------------------------------------
  // ACTUAL LABOR ENTRIES — actual hours worked, separate from the planned
  // schedule_assignments above. Demonstrates the planned-vs-actual split,
  // one employee working two jobs in a single day, an unusually-high daily
  // total (soft warning), and a likely-duplicate pair (soft warning).
  // ---------------------------------------------------------------------
  const actualLaborEntries: ActualLaborEntry[] = [];
  let alId = 1;
  function addActual(
    employee_id: string,
    project_id: string,
    work_date: string,
    hours: number,
    opts?: {
      start_time?: string;
      end_time?: string;
      notes?: string;
      created_at?: string;
      // Historical Pay Rate Accuracy demo only — overrides the snapshot
      // that would otherwise be taken from the employee's CURRENT rate, to
      // simulate an entry logged before a since-given raise. Every other
      // call snapshots from the employee's live seed rate above, exactly
      // like lib/db.ts#createActualLaborEntry does at real save time.
      rateOverride?: { rate_type: Employee["pay_type"]; rate_amount: number };
    }
  ) {
    const emp = employees.find((e) => e.id === employee_id)!;
    const rate_type = opts?.rateOverride?.rate_type ?? emp.pay_type;
    const rate_amount = opts?.rateOverride?.rate_amount ?? (emp.pay_type === "hourly" ? emp.hourly_rate : emp.daily_rate);
    actualLaborEntries.push({
      id: `al-${alId++}`,
      company_id: COMPANY_ID,
      employee_id,
      project_id,
      work_date,
      hours,
      start_time: opts?.start_time,
      end_time: opts?.end_time,
      notes: opts?.notes,
      rate_type,
      rate_amount,
      created_by: "Miguel Alvarez",
      updated_by: "Miguel Alvarez",
      created_at: opts?.created_at ?? `${work_date}T17:00:00.000Z`,
      updated_at: opts?.created_at ?? `${work_date}T17:00:00.000Z`,
    });
  }

  // Ordinary actual hours roughly matching the plan.
  addActual("e-3", "p-1", t(0), 8, { start_time: "7:00 AM", end_time: "3:30 PM" });
  addActual("e-4", "p-1", t(0), 8, { start_time: "7:00 AM", end_time: "3:30 PM" });
  addActual("e-5", "p-5", t(0), 8, { start_time: "7:00 AM", end_time: "3:30 PM" });
  addActual("e-10", "p-5", t(0), 7.5, { start_time: "7:00 AM", end_time: "3:00 PM" });

  // Dennis Cho (e-2) worked TWO different jobs on the same day — the
  // dispatcher double-booking on the plan (p-15 all week + p-2 on t(1))
  // shows up here as real split actual hours: 4 hrs on p-15, 4 hrs on p-2.
  addActual("e-2", "p-15", t(1), 4, { start_time: "7:00 AM", end_time: "11:00 AM", notes: "Pulled to help p-2 delivery arrive on schedule after lunch." });
  addActual("e-2", "p-2", t(1), 4, { start_time: "11:30 AM", end_time: "3:30 PM" });

  // Unusually high total for one day — soft warning demo (sum > 16 hrs).
  addActual("e-9", "p-15", t(0), 9, { start_time: "6:00 AM", end_time: "3:00 PM" });
  addActual("e-9", "p-11", t(0), 9, { start_time: "3:30 PM", end_time: "12:30 AM", notes: "Covered evening debris haul-out on p-11 after finishing p-15." });

  // Likely-duplicate pair — same employee+project+date+hours entered twice
  // in quick succession — soft warning demo, not a hard block.
  addActual("e-12", "p-11", t(2), 8, { start_time: "7:00 AM", end_time: "3:00 PM", created_at: `${t(2)}T15:05:00.000Z` });
  addActual("e-12", "p-11", t(2), 8, { start_time: "7:00 AM", end_time: "3:00 PM", created_at: `${t(2)}T15:06:30.000Z` });

  // Historical actual hours for the completed job (p-7), so the Completed
  // Job Summary's per-employee days/hours totals aren't empty.
  //
  // HISTORICAL PAY RATE ACCURACY DEMO: Sal Marchetti's (e-8) CURRENT
  // daily_rate is $330 (see employees above), but these entries are
  // snapshotted at $300 — his rate at the time, before a since-given raise.
  // A rate change on his profile today must NOT change these already-
  // computed job costs. Verify via lib/labor-cost.ts against these rows.
  const salsRateWhenP7Ran = { rate_type: "daily" as const, rate_amount: 300 };
  addActual("e-8", "p-7", t(-12), 8, { start_time: "8:00 AM", end_time: "4:30 PM", rateOverride: salsRateWhenP7Ran });
  addActual("e-9", "p-7", t(-12), 6, { start_time: "8:00 AM", end_time: "2:30 PM" });
  addActual("e-8", "p-7", t(-11), 8, { start_time: "8:00 AM", end_time: "4:30 PM", rateOverride: salsRateWhenP7Ran });
  addActual("e-8", "p-7", t(-10), 7, { start_time: "8:00 AM", end_time: "3:30 PM", rateOverride: salsRateWhenP7Ran });

  // ---------------------------------------------------------------------
  // DAILY SCHEDULE CONFIRMATIONS — "Confirm Day" from End-of-Day Review.
  // ---------------------------------------------------------------------
  const dailyScheduleConfirmations: DailyScheduleConfirmation[] = [
    { id: "dsc-1", company_id: COMPANY_ID, work_date: t(-1), confirmed_by: "Miguel Alvarez", confirmed_at: `${t(-1)}T17:30:00.000Z`, notes: "All crews accounted for, no schedule changes." },
  ];

  // ---------------------------------------------------------------------
  // COMMUNICATIONS / NOTES / DOCS / PHOTOS
  // ---------------------------------------------------------------------
  const communications: Communication[] = [
    { id: "com-1", company_id: COMPANY_ID, related_type: "job_request", related_id: "jr-1", contact_id: "ct-3", direction: "inbound", channel: "phone", summary: "Carla called to report the 5th floor corridor carpet tile trip hazard, wants urgent attention.", occurred_at: `${t(-1)}T09:14:00.000Z`, created_at: `${t(-1)}T09:14:00.000Z` },
    { id: "com-2", company_id: COMPANY_ID, related_type: "project", related_id: "p-2", contact_id: "ct-1", direction: "outbound", channel: "text", summary: "Texted Denise that LVP delivery is delayed a day, crew start pushed to tomorrow.", occurred_at: `${t(-1)}T15:20:00.000Z`, created_at: `${t(-1)}T15:20:00.000Z` },
    { id: "com-3", company_id: COMPANY_ID, related_type: "job_request", related_id: "jr-4", contact_id: "ct-9", direction: "outbound", channel: "email", summary: "Sent stain sample photos and pricing for both lounge finish options, awaiting board vote.", occurred_at: `${t(-6)}T13:05:00.000Z`, created_at: `${t(-6)}T13:05:00.000Z` },
  ];

  const projectNotes: ProjectNote[] = [
    { id: "pn-1", company_id: COMPANY_ID, project_id: "p-1", author_name: "Miguel Alvarez", body: "Subfloor in good shape, no repairs needed before sanding. Started sanding Tuesday morning.", created_at: `${t(-2)}T08:00:00.000Z` },
    { id: "pn-2", company_id: COMPANY_ID, project_id: "p-11", author_name: "Miguel Alvarez", body: "Debris haul-out running behind schedule — added Saturday time-and-half push to stay on track for board meeting.", created_at: `${t(-1)}T16:00:00.000Z` },
    { id: "pn-3", company_id: COMPANY_ID, project_id: "p-15", author_name: "Office", body: "Baseboard delivery had wrong profile — return initiated, install may need to be pushed if replacement is delayed.", created_at: `${nowIso}T09:00:00.000Z` },
  ];

  const documents: DocumentRecord[] = [
    { id: "doc-1", company_id: COMPANY_ID, related_type: "project", related_id: "p-1", file_name: "Unit-4B-Estimate.pdf", content_type: "application/pdf", size_bytes: 184320, uploaded_by: "Brian Travers", created_at: `${t(-19)}T00:00:00.000Z` },
    { id: "doc-2", company_id: COMPANY_ID, related_type: "client_company", related_id: "cc-4", file_name: "Harborview-COI-2025.pdf", content_type: "application/pdf", size_bytes: 96400, uploaded_by: "Brian Travers", created_at: "2025-01-15T00:00:00.000Z" },
  ];

  // Procore-style Photos "albums" — `category` doubles as the album grid is
  // grouped by (see README "Photos & Drawings"). `title` is deliberately
  // set on only some entries to demonstrate it's optional, per the client's
  // own words ("photos with titles on them (optional)").
  const photos: PhotoRecord[] = [
    { id: "ph-1", company_id: COMPANY_ID, related_type: "project", related_id: "p-1", file_name: "4B-before-sanding.jpg", category: "Before", title: "Existing hardwood, pre-sand", caption: "Before — existing hardwood prior to sanding", taken_at: `${t(-2)}T08:10:00.000Z`, uploaded_by: "Miguel Alvarez", created_at: `${t(-2)}T08:10:00.000Z`, storage_unavailable: true },
    { id: "ph-2", company_id: COMPANY_ID, related_type: "project", related_id: "p-1", file_name: "4B-mid-sand.jpg", category: "Progress", caption: "First pass sanding complete, moving to stain.", taken_at: `${t(-1)}T09:30:00.000Z`, uploaded_by: "Miguel Alvarez", created_at: `${t(-1)}T09:30:00.000Z`, storage_unavailable: true },
    { id: "ph-3", company_id: COMPANY_ID, related_type: "project", related_id: "p-1", file_name: "4B-jacobean-sample.jpg", category: "Progress", title: "Jacobean stain sample", caption: "Test patch in the closet before committing to the full floor.", taken_at: `${t(-1)}T11:00:00.000Z`, uploaded_by: "Miguel Alvarez", created_at: `${t(-1)}T11:00:00.000Z`, storage_unavailable: true },
    { id: "ph-4", company_id: COMPANY_ID, related_type: "project", related_id: "p-8", file_name: "9D-punch-list-threshold.jpg", category: "Progress", title: "Kitchen threshold gap", caption: "Threshold gap to be touched up", taken_at: `${t(-1)}T14:00:00.000Z`, uploaded_by: "Ray Kowalski", created_at: `${t(-1)}T14:00:00.000Z`, storage_unavailable: true },
    { id: "ph-5", company_id: COMPANY_ID, related_type: "project", related_id: "p-8", file_name: "9D-after-finish.jpg", category: "After", title: "Finished floor", taken_at: `${t(-1)}T16:30:00.000Z`, uploaded_by: "Ray Kowalski", created_at: `${t(-1)}T16:30:00.000Z`, storage_unavailable: true },
    { id: "ph-6", company_id: COMPANY_ID, related_type: "project", related_id: "p-11", file_name: "common-area-demo.jpg", category: "Before", caption: "Old vinyl composite tile prior to demo.", taken_at: `${t(-3)}T08:00:00.000Z`, uploaded_by: "Miguel Alvarez", created_at: `${t(-3)}T08:00:00.000Z`, storage_unavailable: true },
  ];

  // ---------------------------------------------------------------------
  // DRAWINGS (Procore-style, build 9) — a project's plan files with version
  // history. p-1 demonstrates a superseded version (v1, is_current_version
  // false) plus its current replacement (v2, is_current_version true); the
  // old row is kept, never deleted. See README "Photos & Drawings".
  // ---------------------------------------------------------------------
  const projectDrawings: ProjectDrawing[] = [
    { id: "pd-1", company_id: COMPANY_ID, project_id: "p-1", drawing_name: "Unit 4B Floor Plan", drawing_number: "A-101", version: 1, is_current_version: false, uploaded_by: "Brian Travers", uploaded_at: `${t(-19)}T00:00:00.000Z`, created_at: `${t(-19)}T00:00:00.000Z`, notes: "Initial plan from management company.", storage_unavailable: true },
    { id: "pd-2", company_id: COMPANY_ID, project_id: "p-1", drawing_name: "Unit 4B Floor Plan", drawing_number: "A-101", version: 2, is_current_version: true, uploaded_by: "Brian Travers", uploaded_at: `${t(-5)}T00:00:00.000Z`, created_at: `${t(-5)}T00:00:00.000Z`, notes: "Revised after super flagged a closet dimension error.", storage_unavailable: true },
    { id: "pd-3", company_id: COMPANY_ID, project_id: "p-11", drawing_name: "Common Area Tile Layout", drawing_number: "T-01", version: 1, is_current_version: true, uploaded_by: "Miguel Alvarez", uploaded_at: `${t(-20)}T00:00:00.000Z`, created_at: `${t(-20)}T00:00:00.000Z`, storage_unavailable: true },
  ];

  // ---------------------------------------------------------------------
  // NEW BUSINESS LEADS (secondary feature)
  // ---------------------------------------------------------------------
  const newBusinessLeads: NewBusinessLead[] = [
    { id: "lead-1", company_id: COMPANY_ID, company_name: "Brightline Realty Advisors", contact_name: "Kevin Ostrowski", phone: "(646) 555-1122", email: "kostrowski@brightlinera.com", source: "Referral — Vanguard PM", status: "Contacted", estimated_value: 40000, notes: "Manages 6 buildings in Hoboken, currently unhappy with existing vendor's turnaround time.", created_at: `${t(-9)}T00:00:00.000Z`, updated_at: `${t(-4)}T00:00:00.000Z` },
    { id: "lead-2", company_id: COMPANY_ID, company_name: "Union Square Property Advisors", contact_name: "Renata Kowal", phone: "(212) 555-9931", email: "rkowal@unionsquarepa.com", source: "Website inquiry", status: "New", notes: "Filled out contact form asking about recurring maintenance flooring contracts.", created_at: `${t(-2)}T00:00:00.000Z`, updated_at: `${t(-2)}T00:00:00.000Z` },
    { id: "lead-3", company_id: COMPANY_ID, company_name: "Palisades Portfolio Management", contact_name: "Doug Farrelly", phone: "(201) 555-4477", email: "dfarrelly@palisadespm.com", source: "Trade show — NY Multifamily Expo", status: "Site Visit", estimated_value: 22000, notes: "Wants a walkthrough of two buildings before committing to vendor status.", created_at: `${t(-16)}T00:00:00.000Z`, updated_at: `${t(-3)}T00:00:00.000Z` },
    { id: "lead-4", company_id: COMPANY_ID, company_name: "Woodhaven Realty Group", contact_name: "Simone Achebe", phone: "(718) 555-2244", email: "sachebe@woodhavenrg.com", source: "Cold outreach", status: "Lost", notes: "Went with an in-house maintenance team instead.", created_at: `${t(-45)}T00:00:00.000Z`, updated_at: `${t(-30)}T00:00:00.000Z` },
  ];

  // ---------------------------------------------------------------------
  // ACTIVITY LOG
  // ---------------------------------------------------------------------
  const activityLog: ActivityLogEntry[] = [
    { id: "act-1", company_id: COMPANY_ID, actor_name: "Brian Travers", action: "Converted job request to project", related_type: "project", related_id: "p-1", detail: "Job request JR-7 converted to project for Unit 4B hardwood refinish.", created_at: `${t(-17)}T09:00:00.000Z` },
    { id: "act-2", company_id: COMPANY_ID, actor_name: "Brian Travers", action: "Converted job request to project", related_type: "project", related_id: "p-5", detail: "Job request JR-8 converted to project for Unit 3F laminate.", created_at: `${t(-15)}T09:00:00.000Z` },
    { id: "act-3", company_id: COMPANY_ID, actor_name: "Miguel Alvarez", action: "Marked project In Progress", related_type: "project", related_id: "p-11", created_at: `${t(-3)}T07:30:00.000Z` },
    {
      id: "act-4",
      company_id: COMPANY_ID,
      actor_name: "Brian Travers",
      action: "Duplicate bid override — created anyway",
      related_type: "job_request",
      related_id: "jr-9",
      detail:
        "Possible duplicate flagged against existing project P-1 (The Wexford, Unit 4B — status Project In Process, claimed by Sarah Bennett). Reason given: \"Different scope — post-job cleanup callback, not part of the original bid.\"",
      created_at: `${t(-1)}T11:41:00.000Z`,
    },
    { id: "act-5", company_id: COMPANY_ID, actor_name: "Miguel Alvarez", action: "Confirmed day", related_type: undefined, related_id: undefined, detail: `Schedule confirmed for ${t(-1)}. All crews accounted for, no schedule changes.`, created_at: `${t(-1)}T17:30:00.000Z` },
    { id: "act-6", company_id: COMPANY_ID, actor_name: "Miguel Alvarez", action: "Schedule color changed to Yellow", related_type: "project", related_id: "p-1", detail: `${t(1)}: Gray → Yellow (priority board walkthrough)`, created_at: `${t(0)}T16:00:00.000Z` },
    { id: "act-7", company_id: COMPANY_ID, actor_name: "Miguel Alvarez", action: "COI status changed to Approved", related_type: "project", related_id: "p-1", detail: `${t(0)}: Sent → Approved`, created_at: `${t(-1)}T09:00:00.000Z` },
    { id: "act-8", company_id: COMPANY_ID, actor_name: "Miguel Alvarez", action: "Logged actual hours", related_type: "employee", related_id: "e-2", detail: `Dennis Cho on ${t(1)}: 4.0 hrs on p-15, 4.0 hrs on p-2`, created_at: `${t(1)}T16:00:00.000Z` },
  ];

  const companySetupAnswers: CompanySetupAnswer[] = [];

  // ---------------------------------------------------------------------
  // QUICKBOOKS ONLINE INTEGRATION (build 10) — deliberately EMPTY. No
  // credentials exist in this environment, so there is no real connection,
  // no real linked customer, and no real Estimate/Invoice to seed. Per the
  // client spec's own instruction: "never fake success" — a fabricated
  // quickbooks_documents row would look exactly like a real synced
  // QuickBooks record to anyone reading this data, which is worse than an
  // honest empty state. The Settings -> Integrations -> QuickBooks page and
  // the customer-matching UI are built to render correctly against this
  // empty state (see app/company-setup/quickbooks/page.tsx) — "Connect
  // QuickBooks to see live customer matches" rather than mock candidates.
  // ---------------------------------------------------------------------
  const quickbooksConnections: QuickBooksConnection[] = [];
  const quickbooksCustomerMappings: QuickBooksCustomerMapping[] = [];
  const inboundEmails: InboundEmail[] = [];
  const projectOutboundInvoices: ProjectOutboundInvoice[] = [];
  const quickbooksDocuments: QuickBooksDocument[] = [];
  const quickbooksWebhookEvents: QuickBooksWebhookEvent[] = [];
  const quickbooksSyncLog: QuickBooksSyncLogEntry[] = [];

  // ---------------------------------------------------------------------
  // PRICING & ESTIMATING FORMULAS
  // ---------------------------------------------------------------------
  // Supplier names are shared with `materials` above and with the invoices
  // seeded below, so the "grouped by supplier" views have real overlapping
  // data. Two additional suppliers (Home Depot Pro, Apex Equipment Rental)
  // round out the invoice-routing demo.
  const materialRateItems: MaterialRateItem[] = [
    { id: "mri-1", company_id: COMPANY_ID, name: "3/4in Red Oak Hardwood", unit: "sqft", unit_cost: 6.75, supplier: "Metro Hardwood Supply", category: "Material", active: true, created_at: "2024-01-01T00:00:00.000Z" },
    { id: "mri-2", company_id: COMPANY_ID, name: "3/4in White Oak Hardwood", unit: "sqft", unit_cost: 7.5, supplier: "Metro Hardwood Supply", category: "Material", active: true, created_at: "2024-01-01T00:00:00.000Z" },
    { id: "mri-3", company_id: COMPANY_ID, name: "Luxury Vinyl Plank — Coastal Gray", unit: "sqft", unit_cost: 3.5, supplier: "Tri-State Flooring Distributors", category: "Material", active: true, created_at: "2024-01-01T00:00:00.000Z" },
    { id: "mri-4", company_id: COMPANY_ID, name: "Laminate Plank — Weathered Oak", unit: "sqft", unit_cost: 2.85, supplier: "Tri-State Flooring Distributors", category: "Material", active: true, created_at: "2024-01-01T00:00:00.000Z" },
    { id: "mri-5", company_id: COMPANY_ID, name: "Commercial Carpet — Mid Grade", unit: "sqft", unit_cost: 2.4, supplier: "Empire Carpet & Textile", category: "Material", active: true, created_at: "2024-01-01T00:00:00.000Z" },
    { id: "mri-6", company_id: COMPANY_ID, name: "Porcelain Tile 12x24", unit: "sqft", unit_cost: 4.25, supplier: "Statewide Tile & Stone", category: "Material", active: true, created_at: "2024-01-01T00:00:00.000Z" },
    { id: "mri-7", company_id: COMPANY_ID, name: "Rubber Underlayment", unit: "sqft", unit_cost: 0.65, supplier: "Tri-State Flooring Distributors", category: "Underlayment", active: true, created_at: "2024-01-01T00:00:00.000Z" },
    { id: "mri-8", company_id: COMPANY_ID, name: "Foam Underlayment", unit: "sqft", unit_cost: 0.35, supplier: "Tri-State Flooring Distributors", category: "Underlayment", active: true, created_at: "2024-01-01T00:00:00.000Z" },
    { id: "mri-9", company_id: COMPANY_ID, name: "Carpet Padding — 8lb Rebond", unit: "sqft", unit_cost: 0.55, supplier: "Empire Carpet & Textile", category: "Underlayment", active: true, created_at: "2024-01-01T00:00:00.000Z" },
    { id: "mri-10", company_id: COMPANY_ID, name: "Flooring Adhesive/Glue", unit: "gallon", unit_cost: 42, supplier: "Bona Pro Supply", category: "Adhesive", active: true, created_at: "2024-01-01T00:00:00.000Z" },
    { id: "mri-11", company_id: COMPANY_ID, name: "Carpet Seam Adhesive", unit: "gallon", unit_cost: 28, supplier: "Empire Carpet & Textile", category: "Adhesive", active: true, created_at: "2024-01-01T00:00:00.000Z" },
    { id: "mri-12", company_id: COMPANY_ID, name: "Paint-Grade Baseboard 3.25in", unit: "linear ft", unit_cost: 1.85, supplier: "Metro Hardwood Supply", category: "Trim", active: true, created_at: "2024-01-01T00:00:00.000Z" },
    { id: "mri-13", company_id: COMPANY_ID, name: "Quarter Round Trim", unit: "linear ft", unit_cost: 0.95, supplier: "Metro Hardwood Supply", category: "Trim", active: true, created_at: "2024-01-01T00:00:00.000Z" },
    { id: "mri-14", company_id: COMPANY_ID, name: "Water-Based Polyurethane, Satin", unit: "gallon", unit_cost: 65, supplier: "Bona Pro Supply", category: "Other", active: true, created_at: "2024-01-01T00:00:00.000Z" },
    { id: "mri-15", company_id: COMPANY_ID, name: "Floor Nails/Staples (box)", unit: "box", unit_cost: 38, supplier: "Home Depot Pro", category: "Other", active: true, created_at: "2024-01-01T00:00:00.000Z" },
  ];

  const pricingFormulas: PricingFormula[] = [
    { id: "pf-1", company_id: COMPANY_ID, name: "Standard Hardwood Installation", work_type: "Hardwood Installation", labor_rate_per_sqft: 4.5, markup_percent: 25, notes: "3/4in solid hardwood, glue-assist nail-down, standard waste factor.", active: true, created_at: "2024-01-05T00:00:00.000Z" },
    { id: "pf-2", company_id: COMPANY_ID, name: "Standard LVP Installation", work_type: "LVP Installation", labor_rate_per_sqft: 2.25, markup_percent: 30, notes: "Floating LVP over foam underlayment.", active: true, created_at: "2024-01-05T00:00:00.000Z" },
    { id: "pf-3", company_id: COMPANY_ID, name: "Standard Carpet Installation", work_type: "Carpet Installation", labor_rate_per_sqft: 1.75, markup_percent: 30, notes: "Mid-grade carpet over 8lb rebond pad, standard turnover unit.", active: true, created_at: "2024-01-05T00:00:00.000Z" },
  ];

  const pricingFormulaComponents: PricingFormulaComponent[] = [
    // Hardwood: 5% waste factor on the board itself, plus glue and finish.
    { id: "pfc-1", company_id: COMPANY_ID, formula_id: "pf-1", material_rate_item_id: "mri-1", quantity_per_unit_area: 1.05, notes: "5% waste factor", created_at: "2024-01-05T00:00:00.000Z" },
    { id: "pfc-2", company_id: COMPANY_ID, formula_id: "pf-1", material_rate_item_id: "mri-10", quantity_per_unit_area: 0.01, notes: "~1 gallon glue per 100 sqft", created_at: "2024-01-05T00:00:00.000Z" },
    { id: "pfc-3", company_id: COMPANY_ID, formula_id: "pf-1", material_rate_item_id: "mri-14", quantity_per_unit_area: 0.008, notes: "~1 gallon finish per 125 sqft", created_at: "2024-01-05T00:00:00.000Z" },
    // LVP: plank + underlayment + a little glue for transitions.
    { id: "pfc-4", company_id: COMPANY_ID, formula_id: "pf-2", material_rate_item_id: "mri-3", quantity_per_unit_area: 1.08, notes: "8% waste factor", created_at: "2024-01-05T00:00:00.000Z" },
    { id: "pfc-5", company_id: COMPANY_ID, formula_id: "pf-2", material_rate_item_id: "mri-8", quantity_per_unit_area: 1.0, created_at: "2024-01-05T00:00:00.000Z" },
    { id: "pfc-6", company_id: COMPANY_ID, formula_id: "pf-2", material_rate_item_id: "mri-10", quantity_per_unit_area: 0.005, notes: "Transition/seam glue", created_at: "2024-01-05T00:00:00.000Z" },
    // Carpet: carpet + pad + seam adhesive.
    { id: "pfc-7", company_id: COMPANY_ID, formula_id: "pf-3", material_rate_item_id: "mri-5", quantity_per_unit_area: 1.1, notes: "10% waste factor for seams/pattern", created_at: "2024-01-05T00:00:00.000Z" },
    { id: "pfc-8", company_id: COMPANY_ID, formula_id: "pf-3", material_rate_item_id: "mri-9", quantity_per_unit_area: 1.0, created_at: "2024-01-05T00:00:00.000Z" },
    { id: "pfc-9", company_id: COMPANY_ID, formula_id: "pf-3", material_rate_item_id: "mri-11", quantity_per_unit_area: 0.006, notes: "Seam adhesive", created_at: "2024-01-05T00:00:00.000Z" },
  ];

  // ---------------------------------------------------------------------
  // INVOICES & EMAIL ROUTING RULES (foundation for a future Gmail-based
  // assistant — see README "Email Assistant & Invoice Routing")
  // ---------------------------------------------------------------------
  const invoices: Invoice[] = [
    { id: "inv-1", company_id: COMPANY_ID, supplier: "Metro Hardwood Supply", amount: 5850, invoice_date: t(-5), due_date: t(25), related_project_id: "p-4", status: "Received", source: "Manual Entry", notes: "White oak hardwood delivery for Unit 8A.", created_at: `${t(-5)}T00:00:00.000Z` },
    { id: "inv-2", company_id: COMPANY_ID, supplier: "Tri-State Flooring Distributors", amount: 3150, invoice_date: t(-4), due_date: t(26), related_project_id: "p-2", related_building_id: "b-2", status: "Filed", source: "Manual Entry", notes: "LVP for Unit 12C.", created_at: `${t(-4)}T00:00:00.000Z` },
    { id: "inv-3", company_id: COMPANY_ID, supplier: "Bona Pro Supply", amount: 590, invoice_date: t(-6), due_date: t(24), related_project_id: "p-1", related_building_id: "b-1", status: "Paid", source: "Manual Entry", notes: "Stain + poly for Unit 4B refinish.", created_at: `${t(-6)}T00:00:00.000Z` },
    { id: "inv-4", company_id: COMPANY_ID, supplier: "Statewide Tile & Stone", amount: 8400, invoice_date: t(-2), due_date: t(28), related_project_id: "p-6", related_building_id: "b-13", status: "Needed", source: "Manual Entry", notes: "Awaiting delivery of lobby porcelain tile before invoice arrives.", created_at: `${t(-2)}T00:00:00.000Z` },
    { id: "inv-5", company_id: COMPANY_ID, supplier: "Empire Carpet & Textile", amount: 2450, invoice_date: t(-11), due_date: t(19), related_project_id: "p-7", related_building_id: "b-17", status: "Paid", source: "Manual Entry", created_at: `${t(-11)}T00:00:00.000Z` },
    { id: "inv-6", company_id: COMPANY_ID, supplier: "Home Depot Pro", amount: 312, invoice_date: t(-1), due_date: t(29), related_building_id: "b-11", status: "Received", source: "Email Auto-Routed", notes: "Fasteners + misc supplies for Unit 6C subfloor repair.", created_at: `${t(-1)}T00:00:00.000Z` },
    { id: "inv-7", company_id: COMPANY_ID, supplier: "Apex Equipment Rental", amount: 480, invoice_date: t(-3), due_date: t(11), related_project_id: "p-11", related_building_id: "b-14", status: "Disputed", source: "Manual Entry", notes: "Billed for 5 rental days, job only ran 3 — following up with vendor.", created_at: `${t(-3)}T00:00:00.000Z` },
    { id: "inv-8", company_id: COMPANY_ID, supplier: "Metro Hardwood Supply", amount: 630, invoice_date: t(-9), due_date: t(21), related_project_id: "p-15", related_building_id: "b-10", status: "Disputed", source: "Manual Entry", notes: "Wrong baseboard profile delivered — disputing charge until replacement ships.", created_at: `${t(-9)}T00:00:00.000Z` },
    { id: "inv-9", company_id: COMPANY_ID, supplier: "Tri-State Flooring Distributors", amount: 2520, invoice_date: t(-9), due_date: t(21), related_project_id: "p-15", related_building_id: "b-10", status: "Paid", source: "Manual Entry", created_at: `${t(-9)}T00:00:00.000Z` },
    { id: "inv-10", company_id: COMPANY_ID, supplier: "Home Depot Pro", amount: 156, invoice_date: t(0), due_date: t(30), related_building_id: "b-9", status: "Needed", source: "Email Auto-Routed", notes: "Auto-routed from a supplier email — awaiting office review and filing.", created_at: `${t(0)}T00:00:00.000Z` },
  ];

  const emailRoutingRules: EmailRoutingRule[] = [
    { id: "err-1", company_id: COMPANY_ID, keyword: "invoice", action_type: "File As Invoice", route_by: "Supplier", active: true, notes: "Generic catch-all for supplier invoice emails.", created_at: "2024-01-10T00:00:00.000Z" },
    { id: "err-2", company_id: COMPANY_ID, keyword: "site visit", action_type: "Flag For Calendar", route_by: "Manual/Case-by-Case", active: true, notes: "Property manager requesting a walkthrough — needs a calendar hold.", created_at: "2024-01-10T00:00:00.000Z" },
    { id: "err-3", company_id: COMPANY_ID, keyword: "walkthrough", action_type: "Flag For Calendar", route_by: "Manual/Case-by-Case", active: true, created_at: "2024-01-10T00:00:00.000Z" },
    { id: "err-4", company_id: COMPANY_ID, keyword: "estimate request", action_type: "Flag For Review", route_by: "Manual/Case-by-Case", active: true, notes: "Route to the estimator queue for manual pricing, not auto-filed.", created_at: "2024-01-10T00:00:00.000Z" },
    { id: "err-5", company_id: COMPANY_ID, keyword: "Home Depot Pro", action_type: "File As Invoice", route_by: "Supplier", active: true, notes: "Known recurring supplier — auto-file straight to their supplier folder.", created_at: "2024-01-10T00:00:00.000Z" },
    { id: "err-6", company_id: COMPANY_ID, keyword: "past due", action_type: "Flag For Review", route_by: "Manual/Case-by-Case", active: true, notes: "Overdue-balance notices need a human to confirm before filing.", created_at: "2024-01-10T00:00:00.000Z" },
  ];

  return {
    company,
    users,
    officeUsers,
    clientCompanies,
    contacts,
    buildings,
    buildingContacts,
    jobRequests,
    projects,
    projectWorkTypes,
    employees,
    employeeSkills,
    employeeAvailability,
    timeOffEntries,
    agendaEvents,
    projectCrewRequirements,
    scheduleAssignments,
    materials,
    projectMaterials,
    tasks,
    communications,
    projectNotes,
    documents,
    photos,
    projectDrawings,
    newBusinessLeads,
    activityLog,
    companySetupAnswers,
    materialRateItems,
    pricingFormulas,
    pricingFormulaComponents,
    invoices,
    emailRoutingRules,
    workTypes,
    projectScheduleDays,
    schedulePickupItems,
    actualLaborEntries,
    dailyScheduleConfirmations,
    quickbooksConnections,
    quickbooksCustomerMappings,
    inboundEmails,
    projectOutboundInvoices,
    quickbooksDocuments,
    quickbooksWebhookEvents,
    quickbooksSyncLog,
    sectionPermissions,
    weekStart: isoDate(monday),
  };
}

export type SeedData = ReturnType<typeof buildSeedData>;
