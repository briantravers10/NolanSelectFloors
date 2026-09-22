import Link from "next/link";

/**
 * Reusable on-page search for a list/table: a plain GET form (works
 * without JS, server-filters the page) with a "Clear" link that keeps
 * every OTHER query param (a tab, a filter, a view) but drops `q`. Same
 * visual style as Drawings / Purchase Orders' search bars.
 */
export function ListSearchBox({
  action,
  q,
  placeholder,
  extraParams = {},
  ariaLabel,
  className = "",
}: {
  action: string;
  q: string;
  placeholder: string;
  extraParams?: Record<string, string | undefined>;
  ariaLabel?: string;
  className?: string;
}) {
  const kept = Object.entries(extraParams).filter(([, v]) => v);
  const clearHref = kept.length > 0 ? `${action}?${new URLSearchParams(Object.fromEntries(kept) as Record<string, string>).toString()}` : action;

  return (
    <form method="get" action={action} className={`flex flex-wrap gap-2 mb-4 ${className}`}>
      {kept.map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      <input
        name="q"
        defaultValue={q}
        placeholder={placeholder}
        aria-label={ariaLabel ?? placeholder}
        className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm flex-1 min-w-[220px]"
      />
      <button type="submit" className="rounded-lg bg-sky-600 text-white px-4 py-2 text-sm font-medium hover:bg-sky-700">Search</button>
      {q && (
        <Link href={clearHref} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50">Clear</Link>
      )}
    </form>
  );
}
