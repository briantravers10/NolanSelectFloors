// "Last worked with [Management Company]" reminder — shown when starting a
// NEW job (job request or project) tied to a management company, so the
// person taking the call has a quick read on relationship recency without
// digging through the client's job history.
//
// Deliberately a pure DERIVED calculation over existing `projects` +
// `buildings` rows — no new table. See README "Last Worked With" reminder.
import { getClientCompany, listBuildings, listProjects } from "./db";
import { daysBetween, todayIso } from "./dates";

export interface LastWorkedWithResult {
  hasPrior: boolean;
  /** Human-readable sentence, ready to render as-is, e.g.
   * "Last worked with ABC Property Management: 3 months, 2 weeks ago" or
   * "No prior jobs on record for ABC Property Management." */
  label: string;
  /** The date the calculation is based on (see below), when hasPrior. */
  lastDate?: string;
  clientName?: string;
}

/**
 * Most recent PREVIOUS project tied to a management company, excluding
 * `excludeProjectId` (the job currently being created, if it already has a
 * project row — e.g. a job request mid-conversion).
 *
 * DATE CHOICE: uses `actual_end_date` when the job has one (the most
 * meaningful "we were last on site" date), falling back to `start_date`,
 * and finally `created_at` for a project that never got dates filled in.
 * This favors "when work actually wrapped" over "when it was booked",
 * which is the more honest read of relationship recency.
 */
export async function getLastWorkedWithClient(
  clientCompanyId: string,
  excludeProjectId?: string
): Promise<LastWorkedWithResult> {
  const [client, buildings, projects] = await Promise.all([
    getClientCompany(clientCompanyId),
    listBuildings(),
    listProjects(),
  ]);
  const clientName = client?.name ?? "this management company";
  const buildingIds = new Set(buildings.filter((b) => b.client_company_id === clientCompanyId).map((b) => b.id));

  const candidates = projects
    .filter((p) => buildingIds.has(p.building_id) && p.id !== excludeProjectId)
    .map((p) => ({ project: p, date: p.actual_end_date ?? p.start_date ?? p.created_at.slice(0, 10) }))
    .filter((c) => !!c.date);

  if (candidates.length === 0) {
    return { hasPrior: false, label: `No prior jobs on record for ${clientName}.`, clientName };
  }

  candidates.sort((a, b) => (a.date! < b.date! ? 1 : -1));
  const lastDate = candidates[0].date!;

  return {
    hasPrior: true,
    label: `Last worked with ${clientName}: ${formatTimeAgo(lastDate)} ago`,
    lastDate,
    clientName,
  };
}

/**
 * Breaks a day count into years/months/weeks/days (approximate: 365-day
 * years, 30-day months — fine for a human "roughly how long ago" reminder,
 * not a billing calculation) and renders the two largest non-zero units,
 * e.g. "3 months, 2 weeks" or "5 days" or "1 year, 2 months". Omits zero
 * units entirely rather than showing all four, per spec.
 */
export function formatTimeAgo(pastIso: string): string {
  const diffDays = Math.max(0, daysBetween(pastIso, todayIso()));
  if (diffDays === 0) return "today";

  const years = Math.floor(diffDays / 365);
  let remainder = diffDays % 365;
  const months = Math.floor(remainder / 30);
  remainder %= 30;
  const weeks = Math.floor(remainder / 7);
  const days = remainder % 7;

  const parts: string[] = [];
  if (years > 0) parts.push(`${years} year${years === 1 ? "" : "s"}`);
  if (months > 0) parts.push(`${months} month${months === 1 ? "" : "s"}`);
  if (weeks > 0) parts.push(`${weeks} week${weeks === 1 ? "" : "s"}`);
  if (days > 0) parts.push(`${days} day${days === 1 ? "" : "s"}`);

  // Show at most the two largest non-zero units — keeps the reminder a
  // quick, clean phrase instead of a cluttered "X years, Y months, Z
  // weeks, W days" string.
  return parts.slice(0, 2).join(", ");
}
