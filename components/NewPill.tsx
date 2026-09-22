/** Small highlighted "New" tag for an item that arrived since this user
 * last opened its section — see lib/nav-badges.ts / lib/db.ts
 * getNavSectionLastSeen. Gone the next time they leave and come back
 * (viewing the page marks the section seen). */
export function NewPill() {
  return (
    <span className="inline-flex items-center rounded-full bg-rose-100 text-rose-700 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide">
      New
    </span>
  );
}
