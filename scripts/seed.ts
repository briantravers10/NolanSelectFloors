// Pushes the demo seed data (lib/seed-data.ts) into a live Supabase
// project. Requires NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY
// in the environment (a .env.local is loaded automatically). Run with:
//
//   npm run seed
//
// This is entirely optional — the app runs fine against the in-memory
// fallback with no Supabase project connected at all. Run this only after
// applying supabase/migrations/0001_init.sql to a real project.
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { buildSeedData } from "../lib/seed-data";

config({ path: ".env.local" });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
  console.error("Set them in .env.local (see .env.example) before running the seed script.");
  console.error("The app itself does not require this — it runs on the built-in seed data with no Supabase project connected.");
  process.exit(1);
}

const supabase = createClient(url, key, { auth: { persistSession: false } });

async function main() {
  const data = buildSeedData();

  const tables: { name: string; rows: unknown[] }[] = [
    { name: "companies", rows: [data.company] },
    { name: "users", rows: data.users },
    { name: "office_users", rows: data.officeUsers },
    { name: "client_companies", rows: data.clientCompanies },
    { name: "contacts", rows: data.contacts },
    { name: "buildings", rows: data.buildings },
    { name: "building_contacts", rows: data.buildingContacts },
    { name: "projects", rows: data.projects.map((p) => ({ ...p, job_request_id: undefined })) }, // insert projects first w/o job_request_id
    { name: "job_requests", rows: data.jobRequests },
    { name: "project_work_types", rows: data.projectWorkTypes },
    { name: "employees", rows: data.employees },
    { name: "employee_skills", rows: data.employeeSkills },
    { name: "employee_availability", rows: data.employeeAvailability },
    { name: "time_off_entries", rows: data.timeOffEntries },
    { name: "project_crew_requirements", rows: data.projectCrewRequirements },
    { name: "schedule_assignments", rows: data.scheduleAssignments },
    { name: "materials", rows: data.materials },
    { name: "project_materials", rows: data.projectMaterials },
    { name: "tasks", rows: data.tasks },
    { name: "communications", rows: data.communications },
    { name: "project_notes", rows: data.projectNotes },
    { name: "documents", rows: data.documents },
    { name: "photos", rows: data.photos },
    { name: "new_business_leads", rows: data.newBusinessLeads },
    { name: "material_rate_items", rows: data.materialRateItems },
    { name: "pricing_formulas", rows: data.pricingFormulas },
    { name: "pricing_formula_components", rows: data.pricingFormulaComponents },
    { name: "invoices", rows: data.invoices },
    { name: "email_routing_rules", rows: data.emailRoutingRules },
    { name: "work_types", rows: data.workTypes },
    { name: "project_schedule_days", rows: data.projectScheduleDays },
    { name: "schedule_pickup_items", rows: data.schedulePickupItems },
    { name: "actual_labor_entries", rows: data.actualLaborEntries },
    { name: "daily_schedule_confirmations", rows: data.dailyScheduleConfirmations },
    { name: "activity_log", rows: data.activityLog },
  ];

  for (const { name, rows } of tables) {
    if (rows.length === 0) continue;
    const { error } = await supabase.from(name).insert(rows as never[]);
    if (error) {
      console.error(`Failed inserting into ${name}:`, error.message);
      process.exit(1);
    }
    console.log(`Seeded ${rows.length} row(s) into ${name}`);
  }

  // Second pass: patch projects.job_request_id and job_requests.converted_project_id
  // now that both tables exist (they reference each other).
  for (const project of data.projects) {
    if (!project.job_request_id) continue;
    const { error } = await supabase.from("projects").update({ job_request_id: project.job_request_id }).eq("id", project.id);
    if (error) console.error(`Failed patching project ${project.id}:`, error.message);
  }

  console.log("Seed complete.");
}

main();
