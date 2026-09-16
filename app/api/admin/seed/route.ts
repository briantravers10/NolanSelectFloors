import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { buildSeedData } from "@/lib/seed-data";

/**
 * One-time admin endpoint to push the demo seed dataset (lib/seed-data.ts)
 * into a real, freshly-migrated Supabase project — the server-side
 * equivalent of `npm run seed`, callable from a deployed environment that
 * has normal internet access (unlike a network-restricted dev sandbox).
 *
 * Protected by SEED_ADMIN_SECRET (a dedicated secret, not the service role
 * key itself, so it's safe to type into a URL/header without exposing the
 * real Supabase credential). Requires NEXT_PUBLIC_SUPABASE_URL and
 * SUPABASE_SERVICE_ROLE_KEY to be set — returns a clear error otherwise
 * rather than silently doing nothing.
 *
 * Call once after applying all migrations, either:
 *   curl -X POST https://<your-domain>/api/admin/seed \
 *     -H "x-seed-secret: <SEED_ADMIN_SECRET value>"
 * or, from any browser (including a phone, no terminal needed):
 *   https://<your-domain>/api/admin/seed?secret=<SEED_ADMIN_SECRET value>
 */
function checkSecret(req: NextRequest): NextResponse | null {
  const configuredSecret = process.env.SEED_ADMIN_SECRET;
  if (!configuredSecret) {
    return NextResponse.json({ error: "SEED_ADMIN_SECRET is not set — refusing to run." }, { status: 503 });
  }
  const providedSecret = req.headers.get("x-seed-secret") ?? req.nextUrl.searchParams.get("secret");
  if (providedSecret !== configuredSecret) {
    return NextResponse.json({ error: "Invalid or missing secret." }, { status: 401 });
  }
  return null;
}

export async function GET(req: NextRequest) {
  const denied = checkSecret(req);
  if (denied) return denied;
  return runSeed();
}

export async function POST(req: NextRequest) {
  const denied = checkSecret(req);
  if (denied) return denied;
  return runSeed();
}

async function runSeed() {

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    return NextResponse.json(
      { error: "NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is not configured." },
      { status: 503 }
    );
  }

  const supabase = createClient(url, key, { auth: { persistSession: false } });
  const data = buildSeedData();

  const tables: { name: string; rows: unknown[] }[] = [
    { name: "companies", rows: [data.company] },
    { name: "users", rows: data.users },
    { name: "office_users", rows: data.officeUsers },
    { name: "client_companies", rows: data.clientCompanies },
    { name: "contacts", rows: data.contacts },
    { name: "buildings", rows: data.buildings },
    { name: "building_contacts", rows: data.buildingContacts },
    { name: "projects", rows: data.projects.map((p) => ({ ...p, job_request_id: undefined })) },
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
    { name: "project_drawings", rows: data.projectDrawings },
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

  const results: { table: string; inserted: number; error?: string }[] = [];

  for (const { name, rows } of tables) {
    if (rows.length === 0) continue;
    const { error } = await supabase.from(name).insert(rows as never[]);
    if (error) {
      results.push({ table: name, inserted: 0, error: error.message });
      return NextResponse.json({ error: `Failed inserting into ${name}: ${error.message}`, results }, { status: 500 });
    }
    results.push({ table: name, inserted: rows.length });
  }

  for (const project of data.projects) {
    if (!project.job_request_id) continue;
    await supabase.from("projects").update({ job_request_id: project.job_request_id }).eq("id", project.id);
  }

  return NextResponse.json({ success: true, results });
}
