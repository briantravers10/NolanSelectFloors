import { listAgendaEventsForOwner, listClientCompanies, listOfficeUsers } from "@/lib/db";
import Link from "next/link";
import { getActingUser } from "@/lib/current-user";
import { addDays, dayLabel, formatDateLong, isoDate, startOfWeek, todayIso } from "@/lib/dates";
import { Card, PageHeader, EmptyState, Button } from "@/components/ui";
import { createAgendaEventAction, deleteAgendaEventAction } from "./actions";
import { ConnectGoogleCalendar } from "./ConnectGoogleCalendar";
import { AgendaDoneToggle } from "@/components/agenda/AgendaDoneToggle";

/**
 * Owner's Personal Agenda — his own meetings, site visits and personal
 * reminders. SEPARATE from the operational job Schedule at /schedule
 * (crew/job dispatch); nothing here reads from or feeds that page. See
 * supabase/migrations/0008_owner_agenda.sql and README "Owner's Agenda &
 * Future Google Calendar Sync".
 */
export default async function AgendaPage({ searchParams }: { searchParams: Promise<{ for?: string }> }) {
  const { for: forParam } = await searchParams;
  const actingUser = await getActingUser();
  const officeUsers = (await listOfficeUsers()).filter((u) => u.active);
  // Whose agenda we're looking at: yours by default, or anyone's — so the
  // office can fill in the boss's day for him.
  const viewing = officeUsers.find((u) => u.id === forParam) ?? officeUsers.find((u) => u.id === actingUser.id);
  const viewingId = viewing?.id ?? actingUser.id;
  const viewingName = viewing?.full_name ?? actingUser.fullName;
  const [events, clients] = await Promise.all([listAgendaEventsForOwner(viewingId), listClientCompanies()]);
  const clientById = new Map(clients.map((c) => [c.id, c]));

  const monday = startOfWeek(new Date());
  const weekDays = Array.from({ length: 7 }, (_, i) => isoDate(addDays(monday, i)));
  const today = todayIso();

  return (
    <div>
      <PageHeader
        title={viewingId === actingUser.id ? "My Agenda" : `${viewingName}'s Agenda`}
        subtitle="Site visits, meetings, errands — separate from the crew/job Schedule. Tick items off as they're done; today's items also show on End of Day Review."
        action={
          <div className="flex items-center gap-2 text-sm">
            <span className="text-slate-500">Viewing</span>
            <div className="flex flex-wrap gap-1">
              {officeUsers.map((u) => (
                <Link
                  key={u.id}
                  href={`/agenda?for=${u.id}`}
                  className={`rounded-full border px-2.5 py-1 text-xs font-medium ${u.id === viewingId ? "bg-slate-900 text-white border-slate-900" : "border-slate-300 text-slate-600 hover:bg-slate-50"}`}
                >
                  {u.id === actingUser.id ? "Me" : u.full_name.split(" ")[0]}
                </Link>
              ))}
            </div>
          </div>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 space-y-4">
          {weekDays.map((day) => {
            const dayEvents = events
              .filter((e) => e.event_date === day)
              .sort((a, b) => (a.start_time ?? "").localeCompare(b.start_time ?? ""));
            return (
              <Card key={day} className={`p-4 ${day === today ? "border-sky-300 ring-1 ring-sky-100" : ""}`}>
                <div className="flex items-baseline justify-between mb-2">
                  <div className="text-sm font-semibold text-slate-900">
                    {dayLabel(day)} {day === today && <span className="text-sky-600 font-medium">(Today)</span>}
                  </div>
                  <div className="text-xs text-slate-400">{formatDateLong(day)}</div>
                </div>
                {dayEvents.length === 0 ? (
                  <div className="text-xs text-slate-400">No events.</div>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {dayEvents.map((e) => {
                      const linkedName = e.related_id ? clientById.get(e.related_id)?.name : undefined;
                      return (
                        <div key={e.id} className={`py-2.5 flex items-start justify-between gap-3 ${e.completed_at ? "opacity-60" : ""}`}>
                          <AgendaDoneToggle id={e.id} done={Boolean(e.completed_at)} />
                          <div className="min-w-0 flex-1">
                            <div className={`text-sm font-medium text-slate-800 ${e.completed_at ? "line-through" : ""}`}>{e.title}</div>
                            <div className="text-xs text-slate-500 mt-0.5">
                              {e.start_time ? `${e.start_time}${e.end_time ? `–${e.end_time}` : ""}` : "All day"}
                              {e.location ? ` · ${e.location}` : ""}
                              {linkedName ? ` · ${linkedName}` : ""}
                            </div>
                            {e.notes && <div className="text-xs text-slate-500 mt-0.5 italic">{e.notes}</div>}
                            {e.created_by_name && e.created_by_name !== viewingName && (
                              <div className="text-[11px] text-slate-400 mt-0.5">Added by {e.created_by_name}</div>
                            )}
                            {e.source === "Google Calendar" && (
                              <span className="inline-block mt-1 text-[10px] uppercase tracking-wide bg-sky-100 text-sky-700 rounded-full px-2 py-0.5">
                                Google Calendar
                              </span>
                            )}
                          </div>
                          <form action={deleteAgendaEventAction.bind(null, e.id)}>
                            <button type="submit" className="text-xs text-slate-400 hover:text-rose-600 shrink-0">
                              Remove
                            </button>
                          </form>
                        </div>
                      );
                    })}
                  </div>
                )}
              </Card>
            );
          })}
          {events.length === 0 && <EmptyState message="No agenda events yet — add one below." />}
        </div>

        <div className="space-y-5">
          <Card className="p-4">
            <h2 className="text-sm font-semibold text-slate-900 uppercase tracking-wide mb-3">+ Add to Agenda</h2>
            <form action={createAgendaEventAction} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-500 uppercase mb-1">Whose agenda</label>
                <select name="owner_user_id" defaultValue={viewingId} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
                  {officeUsers.map((u) => (
                    <option key={u.id} value={u.id}>{u.full_name}{u.id === actingUser.id ? " (me)" : ""}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 uppercase mb-1">Title</label>
                <input name="title" required placeholder="e.g. Site visit, check-in call" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-500 uppercase mb-1">Date</label>
                  <input type="date" name="event_date" required defaultValue={today} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 uppercase mb-1">Start Time</label>
                  <input type="time" name="start_time" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 uppercase mb-1">End Time (optional)</label>
                <input type="time" name="end_time" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 uppercase mb-1">Location</label>
                <input name="location" placeholder="Optional" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 uppercase mb-1">Link to Management Company (optional)</label>
                <select name="related_id" defaultValue="" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
                  <option value="">None</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
                <input type="hidden" name="related_type" value="client_company" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 uppercase mb-1">Notes</label>
                <textarea name="notes" rows={2} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
              </div>
              <Button type="submit">Add Event</Button>
            </form>
          </Card>

          <Card className="p-4">
            <h2 className="text-sm font-semibold text-slate-900 uppercase tracking-wide mb-2">Connect Google Calendar</h2>
            <ConnectGoogleCalendar />
          </Card>
        </div>
      </div>
    </div>
  );
}
