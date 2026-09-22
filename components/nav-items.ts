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
  // Everyone's meetings for the day — schedule entries flagged as meetings.
  { href: "/meetings", label: "Meetings", icon: "calendar", sectionKey: "schedule" },
  { href: "/staff", label: "Staff", icon: "users", sectionKey: "staff" },
  { href: "/materials", label: "Materials", icon: "box", sectionKey: "materials" },
  // Spend by supplier — the same invoice/material lines as the job pages,
  // plus supplier-only invoices not linked to any job. Gated with Materials.
  { href: "/suppliers", label: "Suppliers", icon: "building-2", sectionKey: "materials" },
  // Every drawing across every job in one searchable library.
  { href: "/drawings", label: "Drawings", icon: "clipboard", sectionKey: "projects" },
  { href: "/pricing", label: "Pricing", icon: "chart", sectionKey: "pricing" },
  // Drawings / invoices forwarded from the office Gmail, waiting to be filed.
  { href: "/inbox", label: "Email Inbox", icon: "inbox", sectionKey: "projects" },
  // Customer purchase orders filed from Email Inbox, each linked to its job.
  { href: "/purchase-orders", label: "Purchase Orders", icon: "clipboard", sectionKey: "projects" },
  // Potential bids filed from Email Inbox — things worth pricing.
  { href: "/bids", label: "Bids", icon: "chart", sectionKey: "job_requests" },
  { href: "/reports", label: "Reports", icon: "chart", sectionKey: "reports" },
  // Weekly hours by person, grouped W-4 / 1099 — gated with Reports.
  { href: "/payroll", label: "Payroll", icon: "clipboard", sectionKey: "reports" },
  // Not section-gated — the owner's personal agenda, always visible.
  { href: "/agenda", label: "My Agenda", icon: "calendar" },
  // Company Setup is deliberately off the menu bar (client's ask) — the
  // page and its sub-pages (Staff Access, Work Types, Email Routing,
  // QuickBooks) still exist at /company-setup and are reached by direct
  // link, e.g. the "Change access →" / "Give access" links on a staff
  // member's page.
  // Opens the floating helper (see components/assistant/AssistantPanel.tsx).
  { href: "#assistant", label: "AI Assistant", icon: "spark" },
];

// Subset shown in the mobile bottom bar — keep it to 5 for tap-target size.
export const MOBILE_NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Home", icon: "grid" },
  { href: "/schedule", label: "Schedule", icon: "calendar" },
  { href: "/projects", label: "Projects", icon: "clipboard" },
  { href: "/staff", label: "Staff", icon: "users" },
  { href: "/more", label: "More", icon: "menu" },
];
