// Color tokens for the schedule's own controls (schedule color, COI,
// materials rollup, job status) — kept separate from components/ui.tsx's
// BADGE_COLORS map since these are schedule-specific vocabularies, not
// existing app-wide statuses.
import type { CoiStatus, ScheduleColor, ScheduleJobStatus, ScheduleMaterialsStatus } from "@/lib/types";

export const SCHEDULE_COLOR_CLASSES: Record<ScheduleColor, string> = {
  Yellow: "bg-amber-100 text-amber-800 border-amber-300",
  Blue: "bg-sky-100 text-sky-800 border-sky-300",
  Gray: "bg-slate-100 text-slate-700 border-slate-300",
  Pink: "bg-pink-100 text-pink-800 border-pink-300",
};

// A small solid dot version for the Monthly view's lightweight indicators.
export const SCHEDULE_COLOR_DOT: Record<ScheduleColor, string> = {
  Yellow: "bg-amber-400",
  Blue: "bg-sky-500",
  Gray: "bg-slate-400",
  Pink: "bg-pink-400",
};

export const COI_CLASSES: Record<CoiStatus, string> = {
  "Not Sent": "bg-rose-100 text-rose-700 border-rose-300",
  Sent: "bg-sky-100 text-sky-700 border-sky-300",
  "In Progress": "bg-amber-100 text-amber-700 border-amber-300",
  Approved: "bg-emerald-100 text-emerald-700 border-emerald-300",
};

export const MATERIALS_CLASSES: Record<ScheduleMaterialsStatus, string> = {
  "Not Ordered": "bg-rose-100 text-rose-700 border-rose-300",
  Ordered: "bg-amber-100 text-amber-700 border-amber-300",
  "Sent/Delivered": "bg-emerald-100 text-emerald-700 border-emerald-300",
};

export const JOB_STATUS_CLASSES: Record<ScheduleJobStatus, string> = {
  Scheduled: "bg-sky-100 text-sky-700 border-sky-300",
  "In Progress": "bg-blue-100 text-blue-700 border-blue-300",
  Complete: "bg-emerald-100 text-emerald-700 border-emerald-300",
};
