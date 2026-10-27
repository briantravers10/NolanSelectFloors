import { test, expect } from "@playwright/test";
import { fetchAll, PAGE_SIZE, type Pageable } from "@/lib/supabase/fetch-all";

/**
 * Unit tier — the paging helper that defeats Supabase's silent 1000-row
 * cap (the root cause of the Oct 2026 "schedule loses crew names" bug).
 * Drives it with a fake query builder that behaves like PostgREST: honors
 * offset/limit, never returns more than PAGE_SIZE rows per call.
 */
function fakeTable(total: number, opts: { failOnPage?: number } = {}) {
  const rows = Array.from({ length: total }, (_, i) => ({ id: i + 1 }));
  const calls: { from: number; to: number }[] = [];
  let orderedBy: string | undefined;
  const builder: Pageable<{ id: number }> = {
    order(column) {
      orderedBy = column;
      return builder;
    },
    range(from, to) {
      calls.push({ from, to });
      const page = calls.length;
      if (opts.failOnPage === page) return Promise.resolve({ data: null, error: { message: "boom" } });
      const slice = rows.slice(from, Math.min(to + 1, from + PAGE_SIZE));
      return Promise.resolve({ data: slice, error: null });
    },
  };
  return { builder, calls, orderedBy: () => orderedBy };
}

test("a table under the cap costs exactly one request and returns everything", async () => {
  const t = fakeTable(368);
  const { data, error } = await fetchAll(t.builder);
  expect(error).toBeNull();
  expect(data).toHaveLength(368);
  expect(t.calls).toEqual([{ from: 0, to: 999 }]);
});

test("a table over the cap is paged until a short page, with nothing lost or duplicated", async () => {
  const t = fakeTable(2345);
  const { data } = await fetchAll(t.builder);
  expect(data).toHaveLength(2345);
  expect(new Set(data!.map((r) => r.id)).size).toBe(2345);
  expect(t.calls).toEqual([
    { from: 0, to: 999 },
    { from: 1000, to: 1999 },
    { from: 2000, to: 2999 },
  ]);
});

test("an exact multiple of the page size stops after one extra empty page, not forever", async () => {
  const t = fakeTable(2000);
  const { data } = await fetchAll(t.builder);
  expect(data).toHaveLength(2000);
  expect(t.calls).toHaveLength(3);
});

test("pages are ordered by id so they can never overlap or skip", async () => {
  const t = fakeTable(5);
  await fetchAll(t.builder);
  expect(t.orderedBy()).toBe("id");
});

test("an error on any page surfaces as an error, never as a partial result", async () => {
  const t = fakeTable(2500, { failOnPage: 2 });
  const { data, error } = await fetchAll(t.builder);
  expect(data).toBeNull();
  expect(error?.message).toBe("boom");
});
