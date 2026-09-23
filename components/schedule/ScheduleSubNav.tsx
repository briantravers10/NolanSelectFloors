import Link from "next/link";

// The client's hard requirement: a clear split between VIEWING the
// schedule and CREATING/EDITING it, plus the existing End of Day Review /
// Change History / Completed Jobs screens — all reachable from one nav so
// nothing about where to go is ambiguous.
const TABS = [
  { key: "view", href: "/schedule", label: "View Schedule" },
  { key: "edit", href: "/schedule/edit", label: "Create / Edit Schedule" },
  { key: "review", href: "/schedule/review", label: "End of Day Review" },
  { key: "history", href: "/schedule/history", label: "Change History" },
  { key: "completed", href: "/schedule/completed", label: "Completed Jobs" },
  { key: "weekly", href: "/schedule/weekly", label: "Weekly Summary" },
  { key: "friday-review", href: "/schedule/friday-review", label: "Weekly Review" },
] as const;

export function ScheduleSubNav({ active }: { active: "view" | "edit" | "review" | "history" | "completed" | "weekly" | "friday-review" }) {
  return (
    <div className="flex flex-wrap gap-1 mb-4 border-b border-slate-200">
      {TABS.map((tab) => (
        <Link
          key={tab.href}
          href={tab.href}
          className={`px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
            tab.key === active ? "border-sky-600 text-sky-700" : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          {tab.label}
        </Link>
      ))}
    </div>
  );
}
