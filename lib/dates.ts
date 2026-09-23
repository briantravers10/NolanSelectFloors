// Small date helpers used by seed data + scheduling logic.
// Keep dependency-free (no date-fns) to keep the bundle lean.

export function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function addDays(d: Date, days: number): Date {
  const copy = new Date(d);
  copy.setDate(copy.getDate() + days);
  return copy;
}

/** Monday of the week containing `d` (local server time). */
export function startOfWeek(d: Date): Date {
  const copy = new Date(d);
  const day = copy.getDay(); // 0 = Sunday
  const diff = day === 0 ? -6 : 1 - day; // shift back to Monday
  copy.setDate(copy.getDate() + diff);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

export function todayIso(): string {
  return isoDate(new Date());
}

/** Office time zone — see instrumentation.ts, which sets process.env.TZ to match. */
export const OFFICE_TIME_ZONE = "America/New_York";

/** A timestamp as the office sees it, e.g. "Mon, Sep 21, 4:02 PM". */
export function formatDateTime(iso?: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-US", { timeZone: OFFICE_TIME_ZONE, weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

export function formatDateLong(iso?: string): string {
  if (!iso) return "—";
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" });
}

export function formatDateShort(iso?: string): string {
  if (!iso) return "—";
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/** Saturday / Sunday check on an ISO date string (no timezone drift). */
export function isWeekend(iso: string): boolean {
  const d = new Date(iso + "T00:00:00");
  const w = d.getDay();
  return w === 0 || w === 6;
}

export function dayLabel(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("en-US", { weekday: "long" });
}

export function isPast(iso?: string): boolean {
  if (!iso) return false;
  return iso < todayIso();
}

/** 0 = Monday .. 6 = Sunday, for the given date's local weekday. */
export function weekdayIndexMondayBased(d: Date): number {
  const day = d.getDay();
  return day === 0 ? 6 : day - 1;
}

/** "Mon".."Sun" for an ISO date string — matches lib/types.ts WEEKDAYS. */
export function weekdayAbbrev(iso: string): string {
  const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  return WEEKDAYS[weekdayIndexMondayBased(new Date(iso + "T00:00:00"))];
}

export function daysBetween(a: string, b: string): number {
  const da = new Date(a + "T00:00:00").getTime();
  const db = new Date(b + "T00:00:00").getTime();
  return Math.round((db - da) / (1000 * 60 * 60 * 24));
}
