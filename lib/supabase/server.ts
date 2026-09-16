import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Server-side Supabase client factory (build 12 — Activating Real Login).
 * Reads/writes the Next.js cookie store, so it works in Server Components,
 * Server Actions, and Route Handlers — the standard `@supabase/ssr` App
 * Router pattern (createServerClient + a cookies adapter).
 *
 * Returns null when the public URL/anon key env vars aren't set, mirroring
 * lib/supabaseClient.ts's existing "absent env vars => not configured"
 * convention, so every call site can `if (!supabase) { ...demo fallback... }`
 * instead of throwing.
 *
 * Uses the ANON key (not the service role key) — this client acts as
 * whichever real user's session cookie is present, same as any other
 * Supabase Auth session client. Admin-only operations use
 * lib/supabase/admin.ts instead.
 */
export async function createSupabaseServerClient(): Promise<SupabaseClient | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return null;

  const cookieStore = await cookies();

  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // `setAll` was called from a Server Component render (not a
          // Server Action / Route Handler) — cookies() there is read-only.
          // Safe to ignore because proxy.ts (see lib/supabase/middleware.ts)
          // refreshes the session cookie on every request anyway.
        }
      },
    },
  });
}
