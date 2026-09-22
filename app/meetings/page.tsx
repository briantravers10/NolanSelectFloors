import Link from "next/link";
import { listBuildings, listClientCompanies, listContacts, listEmployees, listProjects, listProjectScheduleDays, listScheduleAssignments } from "@/lib/db";
import { Card, PageHeader, EmptyState, Button, PhoneLink } from "@/components/ui";
import { addDays, dayLabel, formatDateLong, isoDate, todayIso } from "@/lib/dates";
import { requireSectionAccess, canEdit } from "@/lib/permissions";
import { AccessDenied } from "@/components/AccessDenied";
import { employeeDisplayName } from "@/lib/employee-name";
import { setMeetingDoneAction, unmarkMeetingAction, updateMeetingAction } from "./actions";

/**
 * MEETINGS — everyone's meetings for a day, pulled straight from the
 * schedule (entries flagged "This is a meeting"). Same records as the
 * schedule and the agenda, so editing here changes them everywhere.
 */
export default async function MeetingsPage({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  const access = await requireSectionAccess("schedule");
  if (access === "none") return <AccessDenied section="Meetings" />;
  const { date: dateParam } = await searchParams;
  const date = dateParam ?? todayIso();
  const [days, projects, buildings, clients, contacts, employees, assignments, editable] = await Promise.all([
    listProjectScheduleDays(),
    listProjects(),
    listBuildings(),
    listClientCompanies(),
    listContacts(),
    listEmployees(),
    listScheduleAssignments(),
    canEdit("schedule"),
  ]);
  const projectById = new Map(projects.map((p) => [p.id, p]));
  const buildingById = new Map(buildings.map((b) => [b.id, b]));
  const clientById = new Map(clients.map((c) => [c.id, c]));
  const employeeById = new Map(employees.map((e) => [e.id, e]));

  const meetings = days
    .filter((d) => d.is_meeting && d.schedule_date === date)
    .sort((a, b) => (a.meeting_time ?? "99:99").localeCompare(b.meeting_time ?? "99:99"));
  const upcoming = days
    .filter((d) => d.is_meeting && d.schedule_date > date && d.schedule_date <= isoDate(addDays(new Date(date + "T00:00:00"), 14)))
    .sort((a, b) => a.schedule_date.localeCompare(b.schedule_date) || (a.meeting_time ?? "99:99").localeCompare(b.meeting_time ?? "99:99"));

  const prev = isoDate(addDays(new Date(date + "T00:00:00"), -1));
  const next = isoDate(addDays(new Date(date + "T00:00:00"), 1));
  const input = "rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm";

  const describe = (d: (typeof days)[number]) => {
    const p = projectById.get(d.project_id);
    const b = p ? buildingById.get(p.building_id) : undefined;
    const c = b ? clientById.get(b.client_company_id) : undefined;
    const contact = b?.primary_contact_id ? contacts.find((x) => x.id === b.primary_contact_id) : undefined;
    const crew = assignments.filter((a) => a.project_id === d.project_id && a.schedule_date === d.schedule_date).map((a) => employeeById.get(a.employee_id)).filter(Boolean);
    return { p, b, c, contact, crew: crew.map((e) => employeeDisplayName(e!)) };
  };

  return (
    <div>
      <PageHeader
        title="Meetings"
        subtitle="Every meeting on the schedule for the day, for everyone. Edit the time or notes here — it's the same entry as on the schedule and the agenda."
        action={
          <div className="flex items-center gap-2 text-sm">
            <Link href={`/meetings?date=${prev}`} className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 hover:bg-slate-50">← {dayLabel(prev).slice(0, 3)}</Link>
            <form method="get" className="flex items-center gap-1">
              <input type="date" name="date" defaultValue={date} className={input} aria-label="Date" />
              <button type="submit" className="rounded-lg bg-slate-900 text-white px-3 py-1.5 text-sm">Go</button>
            </form>
            <Link href={`/meetings?date=${next}`} className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 hover:bg-slate-50">{dayLabel(next).slice(0, 3)} →</Link>
            <Link href={`/meetings?date=${todayIso()}`} className="text-sky-700 hover:underline">Today</Link>
          </div>
        }
      />

      <h2 className="text-sm font-semibold text-slate-900 uppercase tracking-wide mb-2">
        {dayLabel(date)} · {formatDateLong(date)} — {meetings.length} {meetings.length === 1 ? "meeting" : "meetings"}
      </h2>
      {meetings.length === 0 ? (
        <Card className="p-6 mb-6">
          <EmptyState message="No meetings on the schedule for this day. Tick “This is a meeting” on a schedule entry to add one." />
          <div className="text-center mt-2">
            <Link href={`/schedule/edit?date=${date}`} className="text-sm text-sky-700 hover:underline">Open Create / Edit Schedule for this day →</Link>
          </div>
        </Card>
      ) : (
        <div className="space-y-3 mb-6">
          {meetings.map((d) => {
            const { p, b, c, contact, crew } = describe(d);
            const done = d.job_status === "Complete";
            return (
              <Card key={d.id} className={`p-4 border-amber-300 ${done ? "bg-slate-50 opacity-80" : "bg-amber-50"}`}>
                <div className="flex flex-wrap items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="text-lg font-semibold text-slate-900">
                      {d.meeting_time ? <span className="mr-2 rounded-md bg-amber-200 px-2 py-0.5 text-sm font-bold text-amber-950">{d.meeting_time}</span> : <span className="mr-2 text-sm text-slate-500">No time set</span>}
                      {b?.name ?? p?.name ?? "Unknown"}{p?.unit_number ? ` — Unit ${p.unit_number}` : ""}
                      {done && <span className="ml-2 rounded-full bg-emerald-100 text-emerald-800 px-2 py-0.5 text-xs font-medium">Done</span>}
                    </div>
                    <div className="text-sm text-slate-700">
                      {c?.name ?? "No company"}{b?.address ? ` · ${b.address}` : ""}
                    </div>
                    {contact && (
                      <div className="text-sm text-slate-700 flex items-center gap-1.5">
                        <span>Contact: {contact.first_name} {contact.last_name}</span>
                        <PhoneLink phone={contact.phone ?? contact.mobile_phone} className="text-sm" />
                      </div>
                    )}
                    <div className="text-sm text-slate-700 mt-1">
                      <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 mr-1">Attending</span>
                      {crew.length ? crew.join(" / ") : <span className="text-slate-500">Nobody assigned yet</span>}
                    </div>
                    <div className="flex flex-wrap gap-3 mt-2 text-xs">
                      {p && <Link href={`/projects/${p.id}`} className="text-sky-700 hover:underline">View job →</Link>}
                      <Link href={`/schedule/edit?project=${d.project_id}&date=${d.schedule_date}`} className="text-sky-700 hover:underline">Full edit (attendees, colour) →</Link>
                    </div>
                  </div>
                  {editable && (
                    <div className="flex flex-col gap-2 w-full sm:w-[320px] flex-none">
                      <form action={updateMeetingAction.bind(null, d.id)} className="flex flex-col gap-1.5">
                        <div className="flex items-center gap-2">
                          <label className="text-xs font-medium text-slate-600 w-10">Time</label>
                          <input type="time" name="meeting_time" defaultValue={d.meeting_time ?? ""} className={input} />
                        </div>
                        <textarea name="notes" defaultValue={d.notes ?? ""} rows={2} placeholder="Notes / what it's about" className={`${input} w-full`} />
                        <Button type="submit" variant="secondary" className="text-xs py-1.5">Save</Button>
                      </form>
                      <div className="flex items-center justify-between gap-2 text-xs">
                        <form action={setMeetingDoneAction.bind(null, d.id, !done)}>
                          <button type="submit" className="text-slate-700 hover:text-emerald-700 underline">{done ? "Reopen" : "Mark done"}</button>
                        </form>
                        <form action={unmarkMeetingAction.bind(null, d.id)}>
                          <button type="submit" className="text-slate-500 hover:text-rose-700 underline">Not a meeting</button>
                        </form>
                      </div>
                    </div>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <h2 className="text-sm font-semibold text-slate-900 uppercase tracking-wide mb-2">Next two weeks</h2>
      <Card className="p-3">
        {upcoming.length === 0 ? (
          <EmptyState message="No meetings scheduled in the next two weeks." />
        ) : (
          <table className="w-full text-sm">
            <tbody>
              {upcoming.map((d) => {
                const { p, b, c, crew } = describe(d);
                return (
                  <tr key={d.id} className="border-b border-slate-100 last:border-0">
                    <td className="py-2 px-2 text-xs text-slate-500 w-36"><Link href={`/meetings?date=${d.schedule_date}`} className="hover:underline">{dayLabel(d.schedule_date).slice(0, 3)} {formatDateLong(d.schedule_date)}</Link></td>
                    <td className="py-2 px-2 w-20 font-semibold">{d.meeting_time ?? "—"}</td>
                    <td className="py-2 px-2">
                      <div className="text-slate-900">{b?.name ?? p?.name ?? "Unknown"}{p?.unit_number ? ` — Unit ${p.unit_number}` : ""}</div>
                      <div className="text-xs text-slate-500">{c?.name ?? ""}{crew.length ? ` · ${crew.join(" / ")}` : ""}</div>
                    </td>
                    <td className="py-2 px-2 text-right"><Link href={`/schedule/edit?project=${d.project_id}&date=${d.schedule_date}`} className="text-xs text-sky-700 hover:underline">Edit</Link></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
