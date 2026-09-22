import "server-only";

/**
 * Runs `fn` over `items` with at most `limit` calls in flight at once,
 * preserving result order (same as Promise.all, just capped). Used for
 * batches of signed-URL requests (see the performance audit report) where
 * an unlimited Promise.all could, as the business's data grows, fire
 * hundreds of simultaneous Supabase Storage requests at once. Small
 * collections finish in the same one "wave" as a plain Promise.all would;
 * large ones are throttled instead of flooding the storage API.
 */
export async function mapWithConcurrency<T, R>(items: T[], limit: number, fn: (item: T, index: number) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  async function worker() {
    for (;;) {
      const i = next++;
      if (i >= items.length) return;
      results[i] = await fn(items[i], i);
    }
  }
  const workerCount = Math.max(1, Math.min(limit, items.length));
  await Promise.all(Array.from({ length: workerCount }, () => worker()));
  return results;
}
