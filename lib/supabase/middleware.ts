import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Refreshes the Supabase Auth session cookie on every request, and enforces
 * route protection when real auth is configured (build 12 — Activating
 * Real Login). Standard `@supabase/ssr` App Router pattern, called from the
 * root `proxy.ts` (this Next.js version renamed `middleware.ts` ->
 * `proxy.ts` — see node_modules/next/dist/docs/01-app/03-api-reference/
 * 03-file-conventions/proxy.md — "all functionality remains the same, only
 * the file/export names changed").
 *
 * DEMO MODE (no real Supabase project, or NSF_REAL_AUTH_ENABLED not set to
 * "true" — same gate as lib/auth.ts#isRealAuthConfigured()): this returns
 * `NextResponse.next()` immediately, unchanged from today's zero-auth
 * behavior. No cookie refresh, no redirect, dev "acting as" selector works
 * exactly as before.
 */
function withPathnameHeader(request: NextRequest, response: NextResponse): NextResponse {
  // Lets Server Components (the root layout, specifically) know the current
  // path without a client-side hook, so /login can render standalone
  // without the app shell (Sidebar/TopBar/MobileNav) around it — the App
  // Router gives layouts no built-in server-side pathname access.
  response.headers.set("x-pathname", request.nextUrl.pathname);
  return response;
}

export async function updateSession(request: NextRequest): Promise<NextResponse> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const realAuthEnabled = process.env.NSF_REAL_AUTH_ENABLED === "true";

  if (!url || !anonKey || !realAuthEnabled) {
    return withPathnameHeader(request, NextResponse.next());
  }

  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => supabaseResponse.cookies.set(name, value, options));
      },
    },
  });

  // IMPORTANT: do not run any code between createServerClient and this
  // call — a token refresh here is what keeps the session cookie fresh.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  // Route protection (step 4): any page other than /login requires a real
  // session once real auth is configured. API routes have their own
  // auth/secret handling (e.g. app/api/admin/seed, the QuickBooks
  // webhook's signature check) and are left alone here so those existing
  // mechanisms keep working unchanged; static assets are excluded by the
  // proxy.ts matcher already.
  const isLoginPage = pathname === "/login";
  const isApiRoute = pathname.startsWith("/api/");

  if (!user && !isLoginPage && !isApiRoute) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/login";
    return NextResponse.redirect(redirectUrl);
  }

  // IMPORTANT: `supabaseResponse` (not a fresh NextResponse) must be
  // returned so the refreshed cookies set via setAll above actually reach
  // the browser.
  return withPathnameHeader(request, supabaseResponse);
}
