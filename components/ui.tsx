import Link from "next/link";
import type { ReactNode } from "react";
import { Icon } from "./Icon";

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`bg-white rounded-xl border border-slate-200 shadow-sm ${className}`}>{children}</div>;
}

export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 mb-5">
      <div>
        <h1 className="text-xl md:text-2xl font-semibold text-slate-900">{title}</h1>
        {subtitle && <p className="text-sm text-slate-500 mt-0.5">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function Stat({ label, value, tone = "default" }: { label: string; value: ReactNode; tone?: "default" | "warn" | "good" | "bad" }) {
  const toneClass = {
    default: "text-slate-900",
    warn: "text-amber-600",
    good: "text-emerald-600",
    bad: "text-rose-600",
  }[tone];
  return (
    <Card className="p-4">
      <div className="text-xs font-medium text-slate-500 uppercase tracking-wide">{label}</div>
      <div className={`text-2xl font-semibold mt-1 ${toneClass}`}>{value}</div>
    </Card>
  );
}

const BADGE_COLORS: Record<string, string> = {
  // Job request statuses
  "New Request": "bg-sky-100 text-sky-700",
  "Site Visit Required": "bg-amber-100 text-amber-700",
  "Site Visit Scheduled": "bg-amber-100 text-amber-700",
  "Estimate Required": "bg-amber-100 text-amber-700",
  "Estimate Sent": "bg-indigo-100 text-indigo-700",
  "Awaiting Approval": "bg-indigo-100 text-indigo-700",
  Approved: "bg-emerald-100 text-emerald-700",
  "Ready to Schedule": "bg-emerald-100 text-emerald-700",
  "Converted to Project": "bg-slate-200 text-slate-600",
  Declined: "bg-rose-100 text-rose-700",
  Cancelled: "bg-rose-100 text-rose-700",
  // Task/lead/misc "Completed" and invoice "Paid" (kept — still used by
  // those, even though the old 13-value ProjectStatus that also used them
  // is gone; see README "Project Pipeline Stage Simplification").
  Completed: "bg-emerald-100 text-emerald-700",
  Paid: "bg-slate-200 text-slate-600",
  // Material statuses
  Needed: "bg-rose-100 text-rose-700",
  "Quote Requested": "bg-amber-100 text-amber-700",
  Ordered: "bg-sky-100 text-sky-700",
  "Partially Delivered": "bg-orange-100 text-orange-700",
  Delivered: "bg-emerald-100 text-emerald-700",
  Problem: "bg-rose-100 text-rose-700",
  Returned: "bg-slate-200 text-slate-600",
  // Task statuses
  "To Do": "bg-slate-200 text-slate-700",
  Waiting: "bg-amber-100 text-amber-700",
  // Lead statuses
  New: "bg-sky-100 text-sky-700",
  Contacted: "bg-indigo-100 text-indigo-700",
  "Site Visit": "bg-amber-100 text-amber-700",
  Estimate: "bg-amber-100 text-amber-700",
  "Follow Up": "bg-orange-100 text-orange-700",
  Won: "bg-emerald-100 text-emerald-700",
  Lost: "bg-rose-100 text-rose-700",
  // Pipeline stages — simplified to 5 values (build 9, see README "Project
  // Pipeline Stage Simplification"): Bid Sent, Bid Accepted, Scheduled, In
  // Progress, Complete. `Scheduled` and `In Progress` are shared color keys
  // also used by Task/COI/Bid statuses — kept consistent across the app.
  "Bid Sent": "bg-sky-100 text-sky-700",
  "Bid Accepted": "bg-indigo-100 text-indigo-700",
  Scheduled: "bg-amber-100 text-amber-700",
  "In Progress": "bg-orange-100 text-orange-700",
  Complete: "bg-emerald-100 text-emerald-700",
  // Bid statuses
  Unclaimed: "bg-rose-100 text-rose-700",
  Claimed: "bg-amber-100 text-amber-700",
  "Ready for Review": "bg-lime-100 text-lime-700",
  "Completed/Sent": "bg-teal-100 text-teal-700",
  Accepted: "bg-emerald-100 text-emerald-700",
  Rejected: "bg-rose-100 text-rose-700",
};

export function StatusBadge({ status }: { status: string }) {
  const cls = BADGE_COLORS[status] ?? "bg-slate-200 text-slate-700";
  return <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap ${cls}`}>{status}</span>;
}

export function AlertPill({ children, tone = "warn" }: { children: ReactNode; tone?: "warn" | "bad" }) {
  const cls = tone === "bad" ? "bg-rose-50 text-rose-700 border-rose-200" : "bg-amber-50 text-amber-800 border-amber-200";
  return (
    <span className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium ${cls}`}>
      <Icon name="alert" className="w-3.5 h-3.5" />
      {children}
    </span>
  );
}

export function PhoneLink({ phone, className = "" }: { phone?: string; className?: string }) {
  if (!phone) return <span className="text-slate-400">—</span>;
  return (
    <a href={`tel:${phone.replace(/[^\d+]/g, "")}`} className={`text-sky-600 hover:underline inline-flex items-center gap-1 ${className}`}>
      <Icon name="phone" className="w-3.5 h-3.5" />
      {phone}
    </a>
  );
}

export function EmailLink({ email, className = "" }: { email?: string; className?: string }) {
  if (!email) return <span className="text-slate-400">—</span>;
  return (
    <a href={`mailto:${email}`} className={`text-sky-600 hover:underline inline-flex items-center gap-1 break-all ${className}`}>
      <Icon name="mail" className="w-3.5 h-3.5 shrink-0" />
      {email}
    </a>
  );
}

export function EmptyState({ message }: { message: string }) {
  return <div className="text-sm text-slate-500 py-8 text-center">{message}</div>;
}

export function LinkButton({ href, children, variant = "primary" }: { href: string; children: ReactNode; variant?: "primary" | "secondary" }) {
  const cls =
    variant === "primary"
      ? "bg-sky-600 text-white hover:bg-sky-700"
      : "bg-white text-slate-700 border border-slate-300 hover:bg-slate-50";
  return (
    <Link href={href} className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-sm font-medium transition-colors ${cls}`}>
      {children}
    </Link>
  );
}

export function Button({
  children,
  variant = "primary",
  type = "button",
  onClick,
  className = "",
  disabled,
}: {
  children: ReactNode;
  variant?: "primary" | "secondary" | "danger";
  type?: "button" | "submit";
  onClick?: () => void;
  className?: string;
  disabled?: boolean;
}) {
  const cls =
    variant === "primary"
      ? "bg-sky-600 text-white hover:bg-sky-700 disabled:bg-sky-300"
      : variant === "danger"
      ? "bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100"
      : "bg-white text-slate-700 border border-slate-300 hover:bg-slate-50";
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed ${cls} ${className}`}
    >
      {children}
    </button>
  );
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex items-center justify-between mb-3">
      <h2 className="text-sm font-semibold text-slate-900 uppercase tracking-wide">{children}</h2>
      {action}
    </div>
  );
}
