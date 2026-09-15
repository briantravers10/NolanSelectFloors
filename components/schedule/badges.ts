// Color tokens for the schedule's own controls (schedule color, COI,
// materials rollup, job status) — kept separate from components/ui.tsx's
// BADGE_COLORS map since these are schedule-specific vocabularies, not
// existing app-wide statuses.
import type { CoiStatus, ScheduleColor, ScheduleJobStatus, ScheduleMaterialsStatus } from "@/lib/types";

// Small badge/select chip treatment — still used on the Create/Edit form's
// selects and any compact indicators.
export const SCHEDULE_COLOR_CLASSES: Record<ScheduleColor, string> = {
  Yellow: "bg-amber-100 text-amber-800 border-amber-300",
  Blue: "bg-sky-100 text-sky-800 border-sky-300",
  Gray: "bg-slate-100 text-slate-700 border-slate-300",
  Pink: "bg-pink-100 text-pink-800 border-pink-300",
};

// A small solid dot version for the Monthly/Weekly views' lightweight indicators.
export const SCHEDULE_COLOR_DOT: Record<ScheduleColor, string> = {
  Yellow: "bg-amber-400",
  Blue: "bg-sky-500",
  Gray: "bg-slate-400",
  Pink: "bg-pink-400",
};

/**
 * Full-block background/border treatment for a View Schedule job block —
 * the color must tint the ENTIRE card, not just a dot or a dropdown, per
 * the client spec. Light tinted background + dark (slate-900) text keeps
 * contrast strong while each color stays visually distinct from the
 * others and from a plain white/neutral background.
 */
export const SCHEDULE_COLOR_BLOCK_CLASSES: Record<ScheduleColor, string> = {
  Yellow: "bg-amber-100 border-amber-300",
  Blue: "bg-sky-100 border-sky-300",
  Gray: "bg-slate-200 border-slate-400",
  Pink: "bg-pink-100 border-pink-300",
};

/** Plain-language labels for the Create/Edit Schedule form's "Schedule
 * Type" select — same underlying ScheduleColor values/meanings/sort order,
 * just spelled out instead of a bare color name. */
export const SCHEDULE_COLOR_FORM_LABELS: Record<ScheduleColor, string> = {
  Yellow: "Yellow — Priority (delivery / meeting / other)",
  Blue: "Blue — Job Starting Today",
  Gray: "Gray — Continuation of Job in Progress",
  Pink: "Pink — Waiting / Pending",
};

export const COI_CLASSES: Record<CoiStatus, string> = {
  "Not Sent": "bg-rose-100 text-rose-700 border-rose-300",
  Sent: "bg-sky-100 text-sky-700 border-sky-300",
  "In Progress": "bg-amber-100 text-amber-700 border-amber-300",
  Approved: "bg-emerald-100 text-emerald-700 border-emerald-300",
};

/** Full-sentence label for the View Schedule block: "Certificate of
 * Insurance: SENT" etc. — spelled out per spec, never abbreviated "COI". */
export const COI_DISPLAY_LABELS: Record<CoiStatus, string> = {
  "Not Sent": "NOT SENT",
  Sent: "SENT",
  "In Progress": "IN PROGRESS",
  Approved: "APPROVED",
};

export const MATERIALS_CLASSES: Record<ScheduleMaterialsStatus, string> = {
  "Not Ordered": "bg-rose-100 text-rose-700 border-rose-300",
  Ordered: "bg-amber-100 text-amber-700 border-amber-300",
  "Sent/Delivered": "bg-emerald-100 text-emerald-700 border-emerald-300",
};

export const MATERIALS_DISPLAY_LABELS: Record<ScheduleMaterialsStatus, string> = {
  "Not Ordered": "NOT ORDERED",
  Ordered: "ORDERED",
  "Sent/Delivered": "SENT / DELIVERED",
};

export const JOB_STATUS_CLASSES: Record<ScheduleJobStatus, string> = {
  Scheduled: "bg-sky-100 text-sky-700 border-sky-300",
  "In Progress": "bg-blue-100 text-blue-700 border-blue-300",
  Complete: "bg-emerald-100 text-emerald-700 border-emerald-300",
};
