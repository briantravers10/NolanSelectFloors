import "server-only";
import { cache } from "react";
import {
  listJobRequests,
  listProjects,
  listProjectScheduleDays,
  listScheduleAssignments,
  listCrewRequirements,
  listEmployees,
  listTimeOffEntries,
  listProjectMaterials,
  listInboundEmails,
  listActualLaborEntries,
  listAgendaEventsForOwner,
  listNavSectionsLastSeen,
  markNavSectionSeen,
} from "./db";
import { compareCrewForProjectDate } from "./calculations";
import { computeTimeOffUsageByEmployee } from "./time-off";
import { buildPayroll } from "./payroll";
import { getActingUser } from "./current-user";
import { addDays, isoDate, startOfWeek, todayIso } from "./dates";
import { DRAWING_ATTACHMENT_PATTERN } from "./inbound";

const EPOCH = "1970-01-01T00:00:00.000Z";

/**
 * Sections whose badge is a live "state" rather than a stream of dated
 * items (Schedule/Meetings/Payroll/Agenda — "what needs doing today/this
 * week") reset once a day: visiting clears it, and it starts counting
 * again from the next calendar day rather than re-showing the instant
 * something is still unresolved a minute later. Sections with a real
 * per-item timestamp (a request received, an email arrived, a material
 * logged) instead only count items newer than the last visit — see
 * resolveNavBadgeCounts.
 */
function startOfTodayIso(): string {
  return `${todayIso()}T00:00:00.000Z`;
}

/**
 * Sidebar "needs attention" badge counts, keyed by NAV_ITEMS href — see
 * the chat where these definitions were confirmed before building. Every
 * count reuses an existing status/enum/computation already relied on
 * elsewhere in the app (materials delivery warnings, job-requests overdue
 * flag, payroll's unconfirmed-days count, etc.).
 *
 * "Seen" behavior (per the follow-up ask): a badge is items NEWER than
 * this user's last visit to that section, not a running total that sits
 * there forever — see lib/db.ts#listNavSectionsLastSeen. Visiting a
 * section (tracked centrally in the root layout for the sections handled
 * here — see app/layout.tsx) resets its count to 0 until something new
 * shows up. Sections that render their own per-item "New" highlight
 * (Email Inbox, Job Requests, Bids, Drawings, Materials) manage their own
 * seen-marking on their page instead, so this file only READS last-seen
 * for those, never writes it — otherwise the page's own "what's new"
 * comparison would race against this file's write.
 *
 * Request-scoped memoization only (React cache()) — never persisted
 * beyond nav_badge_seen's per-user rows, never shared across users.
 */
async function resolveNavBadgeCounts(): Promise<Record<string, number>> {
  const today = todayIso();
  const monday = startOfWeek(new Date());
  const weekDates = Array.from({ length: 7 }, (_, i) => isoDate(addDays(monday, i)));

  const actingUser = await getActingUser();

  const [
    jobRequests,
    projects,
    scheduleDays,
    assignments,
    crewRequirements,
    employees,
    timeOffEntries,
    projectMaterials,
    inboundEmails,
    actualLaborEntries,
    agendaEvents,
    lastSeen,
  ] = await Promise.all([
    listJobRequests(),
    listProjects(),
    listProjectScheduleDays(),
    listScheduleAssignments(),
    listCrewRequirements(),
    listEmployees(),
    listTimeOffEntries(),
    listProjectMaterials(),
    listInboundEmails(),
    listActualLaborEntries(),
    listAgendaEventsForOwner(actingUser.id),
    listNavSectionsLastSeen(actingUser.id),
  ]);

  const since = (href: string) => lastSeen[href] ?? EPOCH;

  // ---- Job Requests: new/untriaged, or open 5+ days with no resolution,
  // counting only ones received since the last visit ----
  const CLOSED = new Set(["Converted to Project", "Archived", "Declined", "Cancelled"]);
  const OVERDUE_DAYS = 5;
  const jobRequestsSince = since("/job-requests");
  const jobRequestsCount = jobRequests.filter((jr) => {
    if (jr.received_at <= jobRequestsSince) return false;
    if (jr.status === "New Request") return true;
    if (CLOSED.has(jr.status)) return false;
    const ageDays = Math.floor((Date.now() - new Date(jr.received_at).getTime()) / 86_400_000);
    return ageDays >= OVERDUE_DAYS;
  }).length;

  // ---- Bids: filed potential bids still needing a price, filed since the last visit ----
  const bidsSince = since("/bids");
  const bidsCount = inboundEmails.filter(
    (e) => e.status === "filed" && e.filed_kind === "bid" && (e.bid_status ?? "open") === "open" && e.received_at > bidsSince
  ).length;

  // ---- Projects: unclaimed bids + completed jobs with no invoice sent,
  // counting only ones that reached that state since the last visit ----
  const projectsSince = since("/projects");
  const projectsCount = projects.filter((p) => {
    if (p.bid_status === "Unclaimed") return (p.bid_sent_at ?? p.created_at) > projectsSince;
    if (p.pipeline_stage === "Complete" && !p.invoice_sent_at) return (p.project_completed_at ?? p.created_at) > projectsSince;
    return false;
  }).length;

  // ---- Schedule: today's missing crew + COI not sent, plus this week's
  // not-yet-confirmed employee-days — resets once visited today ----
  const scheduleSeenToday = since("/schedule") >= startOfTodayIso();
  const todaysScheduleDays = scheduleDays.filter((d) => d.schedule_date === today && d.job_status !== "Cancelled");
  const todaysProjectIds = new Set(todaysScheduleDays.map((d) => d.project_id));
  let missingCrewCount = 0;
  for (const projectId of todaysProjectIds) {
    if (compareCrewForProjectDate(crewRequirements, assignments, projectId, today).some((r) => !r.complete)) missingCrewCount++;
  }
  const coiNotSentToday = todaysScheduleDays.filter((d) => d.coi_status === "Not Sent").length;
  const weekPayroll = buildPayroll(weekDates, employees, actualLaborEntries, assignments);
  const unconfirmedDaysThisWeek = weekPayroll.reduce((sum, g) => sum + g.rows.reduce((x, r) => x + r.scheduledOnlyDays, 0), 0);
  const scheduleCount = scheduleSeenToday ? 0 : missingCrewCount + coiNotSentToday + unconfirmedDaysThisWeek;

  // ---- Meetings: today's meetings not yet marked Complete — resets once
  // visited today ----
  const meetingsSeenToday = since("/meetings") >= startOfTodayIso();
  const meetingsCount = meetingsSeenToday
    ? 0
    : scheduleDays.filter((d) => d.is_meeting && d.schedule_date === today && d.job_status !== "Complete").length;

  // ---- Staff: over their annual vacation/sick allowance, counting only
  // employees whose most recent time-off entry was logged since the last visit ----
  const staffSince = since("/staff");
  const usageByEmployee = computeTimeOffUsageByEmployee(timeOffEntries, employees);
  const latestTimeOffByEmployee = new Map<string, string>();
  for (const t of timeOffEntries) {
    const prev = latestTimeOffByEmployee.get(t.employee_id);
    if (!prev || t.created_at > prev) latestTimeOffByEmployee.set(t.employee_id, t.created_at);
  }
  const staffCount = employees
    .filter((e) => e.active)
    .filter((e) => {
      const usage = usageByEmployee.get(e.id);
      if (!usage?.vacationOver && !usage?.sickOver) return false;
      return (latestTimeOffByEmployee.get(e.id) ?? EPOCH) > staffSince;
    }).length;

  // ---- Materials: active-project items undelivered, job starting within
  // 5 days, logged since the last visit (also drives the page's own
  // "New" highlight, so this file only READS — see file header) ----
  const soonMaterials = isoDate(addDays(new Date(), 5));
  const materialsSince = since("/materials");
  const projectById = new Map(projects.map((p) => [p.id, p]));
  const materialsCount = projectMaterials.filter((m) => {
    if (m.created_at <= materialsSince) return false;
    const p = m.project_id ? projectById.get(m.project_id) : undefined;
    if (!p?.start_date) return false;
    return p.start_date >= today && p.start_date <= soonMaterials && m.status !== "Delivered" && m.status !== "Returned";
  }).length;

  // ---- Suppliers: spend not linked to any job, logged since the last visit ----
  const suppliersSince = since("/suppliers");
  const suppliersCount = projectMaterials.filter((m) => !m.project_id && m.created_at > suppliersSince).length;

  // ---- Drawings: arrived by email with a real drawing-file attachment
  // (never an image — those are almost always a signature logo, not a
  // floor plan), not filed yet, received since the last visit ----
  const drawingsSince = since("/drawings");
  const drawingsCount = inboundEmails.filter(
    (e) =>
      (e.status === "unfiled" || e.status === "matched") &&
      e.kind !== "invoice" &&
      e.received_at > drawingsSince &&
      e.attachments.some((a) => a.storage_path && DRAWING_ATTACHMENT_PATTERN.test(a.filename))
  ).length;

  // ---- Email Inbox: unfiled mail received since the last visit ----
  const inboxSince = since("/inbox");
  const inboxCount = inboundEmails.filter((e) => e.status === "unfiled" && e.received_at > inboxSince).length;

  // ---- Payroll: same not-yet-confirmed-days figure as Schedule, also
  // resetting once visited today ----
  const payrollSeenToday = since("/payroll") >= startOfTodayIso();
  const payrollCount = payrollSeenToday ? 0 : unconfirmedDaysThisWeek;

  // ---- My Agenda: today's items not yet checked off — resets once
  // visited today ----
  const agendaSeenToday = since("/agenda") >= startOfTodayIso();
  const agendaCount = agendaSeenToday ? 0 : agendaEvents.filter((e) => e.event_date === today && !e.completed_at).length;

  return {
    "/job-requests": jobRequestsCount,
    "/bids": bidsCount,
    "/projects": projectsCount,
    "/schedule": scheduleCount,
    "/meetings": meetingsCount,
    "/staff": staffCount,
    "/materials": materialsCount,
    "/suppliers": suppliersCount,
    "/drawings": drawingsCount,
    "/inbox": inboxCount,
    "/payroll": payrollCount,
    "/agenda": agendaCount,
    "/dashboard": jobRequestsCount + projectsCount + scheduleCount + materialsCount,
  };
}

export const getNavBadgeCounts = cache(resolveNavBadgeCounts);

/**
 * Sections with no per-item "New" UI of their own — visiting any of their
 * pages just needs to clear the sidebar badge. Call from the root layout
 * keyed off the current pathname. (Inbox/Job Requests/Bids/Drawings/
 * Materials mark themselves seen on their own page instead — see the file
 * header — so they're deliberately NOT in this list.)
 */
export const LAYOUT_MARKS_SEEN_HREFS = ["/schedule", "/meetings", "/staff", "/suppliers", "/payroll", "/projects", "/agenda"];

export async function markLayoutNavSectionSeen(pathname: string): Promise<void> {
  const href = LAYOUT_MARKS_SEEN_HREFS.find((h) => pathname === h || pathname.startsWith(h + "/"));
  if (!href) return;
  const actingUser = await getActingUser();
  await markNavSectionSeen(actingUser.id, href);
}
