import ExcelJS from "exceljs";
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
import type { ScheduleColor } from "@/lib/types";

// Same tint each schedule color block uses on the live schedule (see
// components/schedule/badges.ts#SCHEDULE_COLOR_BLOCK_CLASSES: amber-100,
// sky-100, slate-200, pink-100) — the row itself is colored instead of a
// spelled-out "Status" column.
const ROW_FILL: Record<ScheduleColor, string> = {
  Yellow: "FFFEF3C7",
  Blue: "FFE0F2FE",
  Gray: "FFE2E8F0",
  Pink: "FFFCE7F3",
};

/**
 * Excel export of one day's schedule — same jobs, same content as
 * "Print for John" (/schedule/print), just as a real .xlsx John can open
 * and print himself rather than from the browser. Each job's row is
 * colored the same as its schedule-color block on the live schedule.
 * Pulls from the same buildScheduleJobRows() the live schedule uses,
 * read-only — nothing about the schedule itself changes.
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

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(date);
  sheet.columns = [
    { header: "Job #", key: "jobNumber", width: 10 },
    { header: "Building", key: "building", width: 28 },
    { header: "Address", key: "address", width: 30 },
    { header: "Unit", key: "unit", width: 10 },
    { header: "Staff", key: "staff", width: 30 },
    { header: "Notes", key: "notes", width: 40 },
    { header: "To Collect", key: "toCollect", width: 30 },
  ];
  sheet.getRow(1).font = { bold: true };

  for (const row of rows) {
    const toCollect = row.pickupItems.filter((p) => p.status !== "Collected").map((p) => p.description);
    const sheetRow = sheet.addRow({
      jobNumber: formatJobNumber(row.project.job_number),
      building: row.buildingName ?? "Unknown building",
      address: row.address ?? "",
      unit: row.unitNumber ?? "",
      staff: row.crewNames.join("; "),
      notes: row.notes?.trim() ?? "",
      toCollect: toCollect.join("; "),
    });
    const fill = ROW_FILL[row.scheduleColor];
    sheetRow.eachCell((cell) => {
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: fill } };
      cell.alignment = { wrapText: true, vertical: "top" };
    });
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return new Response(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="schedule-${date}.xlsx"`,
    },
  });
}
