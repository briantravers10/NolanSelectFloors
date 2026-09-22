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
} from "./db";
import { compareCrewForProjectDate, findDoubleBookings } from "./calculations";
import { computeTimeOffUsageByEmployee } from "./time-off";
import { buildPayroll } from "./payroll";
import { getActingUser } from "./current-user";
import { addDays, isoDate, startOfWeek, todayIso } from "./dates";

/**
 * Sidebar "needs attention" badge counts, keyed by NAV_ITEMS href — see
 * README/the chat where these definitions were confirmed before building.
 * Every count reuses an existing status/enum/computation already relied on
 * elsewhere in the app (dashboard attention list, materials delivery
 * warnings, job-requests overdue flag, payroll's unconfirmed-days count,
 * etc.) — nothing new is invented here, this just re-derives the same
 * numbers for the nav.
 *
 * Request-scoped memoization only (React cache()) — never persisted,
 * never shared across users/requests. Runs once per page load (from the
 * root layout) regardless of how many components ask for it.
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
  ]);

  // ---- Job Requests: new/untriaged, or open 5+ days with no resolution ----
  const CLOSED = new Set(["Converted to Project", "Archived", "Declined", "Cancelled"]);
  const OVERDUE_DAYS = 5;
  const jobRequestsCount = jobRequests.filter((jr) => {
    if (jr.status === "New Request") return true;
    if (CLOSED.has(jr.status)) return false;
    const ageDays = Math.floor((Date.now() - new Date(jr.received_at).getTime()) / 86_400_000);
    return ageDays >= OVERDUE_DAYS;
  }).length;

  // ---- Bids: filed potential bids still needing a price ----
  const bidsCount = inboundEmails.filter((e) => e.status === "filed" && e.filed_kind === "bid" && (e.bid_status ?? "open") === "open").length;

  // ---- Projects: unclaimed bids + completed jobs with no invoice sent ----
  const projectsCount = projects.filter((p) => p.bid_status === "Unclaimed" || (p.pipeline_stage === "Complete" && !p.invoice_sent_at)).length;

  // ---- Schedule: today's missing crew / double-bookings / COI not sent,
  // plus this week's not-yet-confirmed employee-days ----
  const todaysScheduleDays = scheduleDays.filter((d) => d.schedule_date === today && d.job_status !== "Cancelled");
  const todaysProjectIds = new Set(todaysScheduleDays.map((d) => d.project_id));
  let missingCrewCount = 0;
  for (const projectId of todaysProjectIds) {
    if (compareCrewForProjectDate(crewRequirements, assignments, projectId, today).some((r) => !r.complete)) missingCrewCount++;
  }
  const doubleBookingsToday = findDoubleBookings(assignments.filter((a) => a.schedule_date === today)).length;
  const coiNotSentToday = todaysScheduleDays.filter((d) => d.coi_status === "Not Sent").length;
  const weekPayroll = buildPayroll(weekDates, employees, actualLaborEntries, assignments);
  const unconfirmedDaysThisWeek = weekPayroll.reduce((sum, g) => sum + g.rows.reduce((x, r) => x + r.scheduledOnlyDays, 0), 0);
  const scheduleCount = missingCrewCount + doubleBookingsToday + coiNotSentToday + unconfirmedDaysThisWeek;

  // ---- Meetings: today's meetings not yet marked Complete ----
  const meetingsCount = scheduleDays.filter((d) => d.is_meeting && d.schedule_date === today && d.job_status !== "Complete").length;

  // ---- Staff: over their annual vacation/sick allowance ----
  const usageByEmployee = computeTimeOffUsageByEmployee(timeOffEntries, employees);
  const staffCount = employees.filter((e) => e.active).filter((e) => {
    const usage = usageByEmployee.get(e.id);
    return usage?.vacationOver || usage?.sickOver;
  }).length;

  // ---- Materials: active-project items undelivered, job starting within 5 days ----
  const soonMaterials = isoDate(addDays(new Date(), 5));
  const projectById = new Map(projects.map((p) => [p.id, p]));
  const materialsCount = projectMaterials.filter((m) => {
    const p = m.project_id ? projectById.get(m.project_id) : undefined;
    if (!p?.start_date) return false;
    return p.start_date >= today && p.start_date <= soonMaterials && m.status !== "Delivered" && m.status !== "Returned";
  }).length;

  // ---- Suppliers: spend not linked to any job ----
  const suppliersCount = projectMaterials.filter((m) => !m.project_id).length;

  // ---- Drawings: arrived by email, drawing-like attachment, not filed yet ----
  const DRAWING_LIKE = /\.(pdf|dwg|dxf|rvt|skp|png|jpe?g|heic|tiff?)$/i;
  const drawingsCount = inboundEmails.filter(
    (e) => (e.status === "unfiled" || e.status === "matched") && e.kind !== "invoice" && e.attachments.some((a) => a.storage_path && DRAWING_LIKE.test(a.filename))
  ).length;

  // ---- Email Inbox: unfiled mail ----
  const inboxCount = inboundEmails.filter((e) => e.status === "unfiled").length;

  // ---- Payroll: same not-yet-confirmed-days figure as Schedule ----
  const payrollCount = unconfirmedDaysThisWeek;

  // ---- My Agenda: today's items not yet checked off ----
  const agendaCount = agendaEvents.filter((e) => e.event_date === today && !e.completed_at).length;

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
