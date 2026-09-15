// Minimal hand-rolled icon set (no icon library dependency — CSP only
// allows a short list of external script hosts and this keeps the bundle
// tiny). Every nav icon and a few common in-page icons live here.
const PATHS: Record<string, string> = {
  grid: "M4 4h7v7H4V4zm9 0h7v7h-7V4zM4 13h7v7H4v-7zm9 0h7v7h-7v-7z",
  "building-2": "M4 21V6a1 1 0 0 1 1-1h7a1 1 0 0 1 1 1v15M13 21V10a1 1 0 0 1 1-1h5a1 1 0 0 1 1 1v11M7 8h1M7 11h1M7 14h1M16 12h1M16 15h1M4 21h16",
  home: "M4 11.5 12 4l8 7.5M6 10v10h12V10",
  inbox: "M4 12h4l2 3h4l2-3h4M4 12 5.5 5h13L20 12M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7",
  clipboard: "M9 4h6a1 1 0 0 1 1 1v1H8V5a1 1 0 0 1 1-1zM6 6h12v14a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V6z",
  calendar: "M7 3v3M17 3v3M4 8h16M5 6h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1z",
  users: "M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM3 20c0-3 2.5-5 6-5s6 2 6 5M17 11a3 3 0 1 0 0-6M21 20c0-2.6-1.9-4.4-4.5-4.9",
  box: "M21 8 12 3 3 8l9 5 9-5zM3 8v9l9 5M21 8v9l-9 5M12 13v9",
  check: "M4 12h4l2 3h4l2-3h4M6 6l3 3M18 6l-3 3M9 3h6M4.5 9 6 6M19.5 9 18 6",
  spark: "M12 3v4M12 17v4M4.2 4.2l2.8 2.8M17 17l2.8 2.8M3 12h4M17 12h4M4.2 19.8 7 17M17 7l2.8-2.8",
  chart: "M4 20V10M10 20V4M16 20v-7M22 20H2",
  settings: "M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1.04 1.56V21a2 2 0 1 1-4 0v-.09A1.7 1.7 0 0 0 9 19.35a1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.7 1.7 0 0 0 4.64 15a1.7 1.7 0 0 0-1.56-1.04H3a2 2 0 1 1 0-4h.09A1.7 1.7 0 0 0 4.65 9a1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.7 1.7 0 0 0 9 4.64a1.7 1.7 0 0 0 1.04-1.56V3a2 2 0 1 1 4 0v.09A1.7 1.7 0 0 0 15 4.65a1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.7 1.7 0 0 0 19.36 9c.14.6.6 1.04 1.56 1.04H21a2 2 0 1 1 0 4h-.09a1.7 1.7 0 0 0-1.51 1z",
  menu: "M4 6h16M4 12h16M4 18h16",
  search: "M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM21 21l-4.35-4.35",
  phone: "M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2C10.5 21 3 13.5 3 6a2 2 0 0 1 2-2z",
  mail: "M4 5h16a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1zM3.5 6l8.5 6 8.5-6",
  alert: "M12 3 2 20h20L12 3zM12 10v4M12 17h.01",
  truck: "M3 6h11v9H3zM14 10h4l3 3v2h-7zM7.5 19a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3zM17.5 19a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z",
  plus: "M12 5v14M5 12h14",
  arrowRight: "M5 12h14M13 6l6 6-6 6",
  close: "M6 6l12 12M18 6L6 18",
  dot: "M12 12m-3 0a3 3 0 1 0 6 0a3 3 0 1 0 -6 0",
};

export function Icon({ name, className = "w-5 h-5" }: { name: string; className?: string }) {
  const d = PATHS[name] ?? PATHS.dot;
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d={d} />
    </svg>
  );
}
