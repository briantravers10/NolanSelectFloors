import type { SectionKey } from "@/lib/types";

export interface NavItem {
  href: string;
  label: string;
  icon: string; // emoji-free short glyph, rendered via <NavIcon>
  // Which lib/types.ts SectionKey gates this item (build 11 — see
  // lib/permissions.ts and README "Permissions & Staff Access"). Omitted
  // for items that aren't section-gated (e.g. the owner's personal
  // Agenda) — those always show.
  sectionKey?: SectionKey;
}

export const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: "grid", sectionKey: "dashboard" },
  // Prominent top-level entry point into the SAME fast-entry New Job
  // Request flow as "+ New Job Request" inside Job Requests (build 9, per
  // the client's own words: "i need a section where it will be like new
  // job in the menu bar on the left"). Not a separate creation flow — see
  // README "New Job — Top-Level Nav Entry Point". Gated by the same
  // job_requests section key as the Job Requests list.
  { href: "/job-requests/new", label: "New Job", icon: "plus", sectionKey: "job_requests" },
  { href: "/clients", label: "Clients", icon: "building-2", sectionKey: "clients" },
  { href: "/buildings", label: "Buildings", icon: "home", sectionKey: "buildings" },
  { href: "/job-requests", label: "Job Requests", icon: "inbox", sectionKey: "job_requests" },
  { href: "/projects", label: "Projects", icon: "clipboard", sectionKey: "projects" },
  { href: "/schedule", label: "Schedule", icon: "calendar", sectionKey: "schedule" },
  { href: "/staff", label: "Staff", icon: "users", sectionKey: "staff" },
  { href: "/materials", label: "Materials", icon: "box", sectionKey: "materials" },
  { href: "/pricing", label: "Pricing", icon: "chart", sectionKey: "pricing" },
  { href: "/invoices", label: "Invoices", icon: "clipboard", sectionKey: "invoices" },
  // Drawings / invoices forwarded from the office Gmail, waiting to be filed.
  { href: "/inbox", label: "Email Inbox", icon: "inbox", sectionKey: "projects" },
  { href: "/reports", label: "Reports", icon: "chart", sectionKey: "reports" },
  // Weekly hours by person, grouped W-4 / 1099 — gated with Reports.
  { href: "/payroll", label: "Payroll", icon: "clipboard", sectionKey: "reports" },
  // Not section-gated — the owner's personal agenda, always visible.
  { href: "/agenda", label: "My Agenda", icon: "calendar" },
  { href: "/company-setup", label: "Company Setup", icon: "settings", sectionKey: "company_setup" },
];

// Subset shown in the mobile bottom bar — keep it to 5 for tap-target size.
export const MOBILE_NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Home", icon: "grid" },
  { href: "/schedule", label: "Schedule", icon: "calendar" },
  { href: "/projects", label: "Projects", icon: "clipboard" },
  { href: "/staff", label: "Staff", icon: "users" },
  { href: "/more", label: "More", icon: "menu" },
];
