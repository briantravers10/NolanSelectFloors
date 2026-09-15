export interface NavItem {
  href: string;
  label: string;
  icon: string; // emoji-free short glyph, rendered via <NavIcon>
}

export const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: "grid" },
  { href: "/clients", label: "Clients", icon: "building-2" },
  { href: "/buildings", label: "Buildings", icon: "home" },
  { href: "/job-requests", label: "Job Requests", icon: "inbox" },
  { href: "/projects", label: "Projects", icon: "clipboard" },
  { href: "/schedule", label: "Schedule", icon: "calendar" },
  { href: "/staff", label: "Staff", icon: "users" },
  { href: "/materials", label: "Materials", icon: "box" },
  { href: "/tasks", label: "Tasks", icon: "check" },
  { href: "/new-business", label: "New Business", icon: "spark" },
  { href: "/reports", label: "Reports", icon: "chart" },
  { href: "/company-setup", label: "Company Setup", icon: "settings" },
];

// Subset shown in the mobile bottom bar — keep it to 5 for tap-target size.
export const MOBILE_NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Home", icon: "grid" },
  { href: "/schedule", label: "Schedule", icon: "calendar" },
  { href: "/projects", label: "Projects", icon: "clipboard" },
  { href: "/staff", label: "Staff", icon: "users" },
  { href: "/more", label: "More", icon: "menu" },
];
