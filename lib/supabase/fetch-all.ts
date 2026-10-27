/**
 * Supabase's API silently caps every query at 1000 rows (its `max-rows`
 * setting) — a bare `.select("*")` on a table that has grown past that
 * returns an arbitrary 1000 of them with no error. schedule_assignments
 * and actual_labor_entries both crossed that line in Oct 2026, which is
 * what made the schedule editor "lose" crew it couldn't see (it reconciled
 * the form against a truncated list) and duplicate rows on re-save.
 *
 * Every unbounded list read in lib/db.ts goes through this: it pages in
 * 1000-row chunks until a short page, ordered by `id` as a tiebreaker so
 * pages never overlap or skip (every table read this way has an `id`
 * column — verified against the live schema). Tables under 1000 rows
 * still cost exactly one request, same as before.
 *
 * Kept outside lib/db.ts (a "use server" module, whose exports must all
 * be Server Actions) so it can be unit-tested directly — see
 * qa/tests/unit/fetch-all.spec.ts.
 */
export const PAGE_SIZE = 1000;

export interface Pageable<T> {
  order(column: string, options?: { ascending?: boolean }): Pageable<T>;
  range(from: number, to: number): PromiseLike<{ data: T[] | null; error: { message: string } | null }>;
}

export async function fetchAll<T>(query: Pageable<T>): Promise<{ data: T[] | null; error: { message: string } | null }> {
  const ordered = query.order("id", { ascending: true });
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await ordered.range(from, from + PAGE_SIZE - 1);
    if (error) return { data: null, error };
    rows.push(...(data ?? []));
    if (!data || data.length < PAGE_SIZE) break;
  }
  return { data: rows, error: null };
}
