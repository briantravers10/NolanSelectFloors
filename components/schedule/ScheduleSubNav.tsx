import Link from "next/link";

const TABS = [
  { href: "/schedule", label: "Calendar" },
  { href: "/schedule/review", label: "End of Day Review" },
  { href: "/schedule/history", label: "Change History" },
  { href: "/schedule/completed", label: "Completed Jobs" },
];

export function ScheduleSubNav({ active }: { active: "calendar" | "review" | "history" | "completed" }) {
  const activeIndex = { calendar: 0, review: 1, history: 2, completed: 3 }[active];
  return (
    <div className="flex flex-wrap gap-1 mb-4 border-b border-slate-200">
      {TABS.map((tab, i) => (
        <Link
          key={tab.href}
          href={tab.href}
          className={`px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
            i === activeIndex ? "border-sky-600 text-sky-700" : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          {tab.label}
        </Link>
      ))}
    </div>
  );
}
