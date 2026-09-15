import { buildSeedData, SeedData } from "./seed-data";

// A module-level singleton, pinned to globalThis so it survives Next.js
// dev-server hot reloads and route-module re-imports within one process.
// This is the in-memory fallback "database" used whenever Supabase env
// vars are absent. Mutations (creating a job request, assigning crew, etc.)
// operate directly on these arrays so the app feels real in a demo even
// with no live database connected.
const g = globalThis as unknown as { __nsfStore?: SeedData };

export function getStore(): SeedData {
  if (!g.__nsfStore) {
    g.__nsfStore = buildSeedData();
  }
  return g.__nsfStore;
}

export function resetStore(): SeedData {
  g.__nsfStore = buildSeedData();
  return g.__nsfStore;
}
