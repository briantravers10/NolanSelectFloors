import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

/**
 * Root Proxy (build 12 — Activating Real Login). Named `proxy.ts`, not
 * `middleware.ts` — this Next.js version deprecated and renamed the
 * `middleware.js` file convention to `proxy.js` (identical behavior, new
 * file/export name only). See node_modules/next/dist/docs/01-app/
 * 03-api-reference/03-file-conventions/proxy.md.
 *
 * Delegates to lib/supabase/middleware.ts#updateSession(), which refreshes
 * the Supabase Auth session cookie and redirects unauthenticated requests
 * to /login — but ONLY when real auth is configured
 * (NEXT_PUBLIC_SUPABASE_URL/ANON_KEY set AND NSF_REAL_AUTH_ENABLED=true).
 * With no real Supabase project connected, or that flag unset, this is a
 * no-op passthrough and today's demo-mode behavior (no redirect, dev
 * "acting as" selector) is fully preserved.
 */
export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    // Skip static assets, image optimization, and favicon — auth checks
    // shouldn't ever block these.
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
