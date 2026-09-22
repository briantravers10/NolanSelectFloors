import Link from "next/link";
import {
  listBuildingContacts,
  listBuildings,
  listClientCompanies,
  listContacts,
  listEmployees,
  listProjects,
  listProjectScheduleDays,
  listScheduleAssignments,
  listSchedulePickupItems,
  listWorkTypes,
} from "@/lib/db";
import { buildScheduleJobRows } from "@/lib/schedule";
import { dayLabel, formatDateLong, todayIso } from "@/lib/dates";
import { requireSectionAccess } from "@/lib/permissions";
import { AccessDenied } from "@/components/AccessDenied";
import { PrintButton } from "@/components/PrintButton";
import { SCHEDULE_COLOR_BLOCK_CLASSES, SCHEDULE_COLOR_FORM_LABELS } from "@/components/schedule/badges";

/**
 * "Print for John" — a big, plain day sheet: building, unit, who's on it,
 * notes, and what to collect. Nothing else. Meant to be printed and
 * handed over, so it's black on white with large type.
 */
export default async function PrintForJohnPage({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  if ((await requireSectionAccess("schedule")) === "none") return <AccessDenied section="Schedule" />;
  const { date: dateParam } = await searchParams;
  const date = dateParam ?? todayIso();

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

  return (
    <div className="max-w-3xl mx-auto text-slate-900">
      <div className="no-print flex items-center gap-2 mb-4">
        <Link href={`/schedule?view=day&date=${date}`} className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm">← Back to schedule</Link>
        <Link href={`/schedule/print?date=${date}`} className="hidden" aria-hidden />
        <PrintButton label="Print" />
      </div>

      <h1 className="text-3xl font-bold leading-tight">{dayLabel(date)}</h1>
      <div className="text-lg text-slate-600 mb-6">{formatDateLong(date)} · {rows.length} {rows.length === 1 ? "job" : "jobs"}</div>

      {rows.length === 0 ? (
        <p className="text-xl">Nothing on the schedule.</p>
      ) : (
        <div className="space-y-5">
          {rows.map((row, i) => {
            const toCollect = row.pickupItems.filter((p) => p.status !== "Collected");
            return (
              <div key={row.key} className={`border-2 border-slate-900 rounded-lg p-4 break-inside-avoid print-color ${SCHEDULE_COLOR_BLOCK_CLASSES[row.scheduleColor]}`}>
                <div className="flex items-baseline justify-between gap-3">
                  <div className="flex items-baseline gap-3">
                    <span className="text-lg font-bold text-slate-500">{i + 1}.</span>
                    <div>
                      <div className="text-2xl font-bold leading-tight">{row.buildingName ?? "Unknown building"}</div>
                      {row.address && <div className="text-base text-slate-700">{row.address}</div>}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-base font-bold uppercase tracking-wide">{row.scheduleColor}</div>
                    <div className="text-xs text-slate-700">{SCHEDULE_COLOR_FORM_LABELS[row.scheduleColor].split("—")[1]?.trim()}</div>
                    {row.isMeeting && <div className="text-sm font-semibold">Meeting{row.meetingTime ? ` at ${row.meetingTime}` : ""}</div>}
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-[110px_1fr] gap-y-2 text-lg">
                  <div className="font-semibold">Unit</div>
                  <div>{row.unitNumber || "—"}</div>
                  <div className="font-semibold">Staff</div>
                  <div>
                    {row.crewNames.length === 0 ? (
                      <span className="text-slate-500">Nobody assigned yet</span>
                    ) : (
                      <ul className="list-none space-y-0.5">
                        {row.crewNames.map((n) => (
                          <li key={n}>{n}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                  <div className="font-semibold">Notes</div>
                  <div className="whitespace-pre-line">{row.notes?.trim() || <span className="text-slate-400">—</span>}</div>
                  <div className="font-semibold">Collect</div>
                  <div>
                    {toCollect.length === 0 ? (
                      <span className="text-slate-400">Nothing</span>
                    ) : (
                      <ul className="list-disc pl-5 space-y-0.5">
                        {toCollect.map((p) => (
                          <li key={p.id} className="font-medium">{p.description}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
