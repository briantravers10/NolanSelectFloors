import {
  listBuildingContacts,
  listBuildings,
  listClientCompanies,
  listContacts,
  listEmployees,
  listProjectScheduleDays,
  listProjects,
  listScheduleAssignments,
  listSchedulePickupItems,
  listWorkTypes,
} from "@/lib/db";
import { buildScheduleJobRows } from "@/lib/schedule";
import { formatJobNumber } from "@/lib/calculations";
import { todayIso } from "@/lib/dates";
import { getActingUser } from "@/lib/current-user";
import { getSectionAccessFor } from "@/lib/permissions";
import { SCHEDULE_COLOR_FORM_LABELS } from "@/components/schedule/badges";

/**
 * Excel-friendly export of one day's schedule — same jobs, same content as
 * "Print for John" (/schedule/print), just as a .csv John can open and
 * print himself in Excel rather than from the browser. Pulls from the same
 * buildScheduleJobRows() the live schedule pages use, read-only — nothing
 * about the schedule itself changes.
 */
export async function GET(request: Request) {
  const actingUser = await getActingUser();
  if ((await getSectionAccessFor(actingUser, "schedule")) === "none") return new Response("Forbidden", { status: 403 });

  const url = new URL(request.url);
  const date = url.searchParams.get("date") || todayIso();

  const [projects, buildings, clients, contacts, buildingContacts, employees, assignments, scheduleDays, workTypes, pickupItems] = await Promise.all([
    listProjects(),
    listBuildings(),
    listClientCompanies(),
    listContacts(),
    listBuildingContacts(),
    listEmployees(),
    listScheduleAssignments({ maxDate: date }),
    listProjectScheduleDays({ maxDate: date }),
    listWorkTypes(),
    listSchedulePickupItems(),
  ]);
  const rows = buildScheduleJobRows(date, { projects, buildings, clients, contacts, buildingContacts, employees, assignments, scheduleDays, workTypes, pickupItems }).filter(
    (r) => !r.weekendOff && r.jobStatus !== "Cancelled"
  );

  const esc = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
  const head = ["Job #", "Building", "Address", "Unit", "Status", "Staff", "Notes", "To Collect"];
  const lines = [head.map(esc).join(",")];
  for (const row of rows) {
    const toCollect = row.pickupItems.filter((p) => p.status !== "Collected").map((p) => p.description);
    lines.push(
      [
        formatJobNumber(row.project.job_number),
        row.buildingName ?? "Unknown building",
        row.address ?? "",
        row.unitNumber ?? "",
        SCHEDULE_COLOR_FORM_LABELS[row.scheduleColor],
        row.crewNames.join("; "),
        row.notes?.trim() ?? "",
        toCollect.join("; "),
      ]
        .map(esc)
        .join(",")
    );
  }

  return new Response(lines.join("\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="schedule-${date}.csv"`,
    },
  });
}
