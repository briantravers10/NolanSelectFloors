/** Small red "needs attention" count next to a nav item — see
 * lib/nav-badges.ts for what each section's count means. Renders nothing
 * for 0/undefined so untouched sections stay clean; caps the printed
 * number at 99+ so a big count never breaks the sidebar's width. */
export function NavBadge({ count }: { count: number | undefined }) {
  if (!count) return null;
  return (
    <span className="inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1 rounded-full bg-rose-600 text-white text-[11px] font-semibold leading-none shrink-0">
      {count > 99 ? "99+" : count}
    </span>
  );
}
