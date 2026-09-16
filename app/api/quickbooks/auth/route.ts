import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { cookies } from "next/headers";
import { buildAuthorizationUrl, isQuickBooksConfigured } from "@/lib/quickbooks";
import { getActingUser } from "@/lib/current-user";
import { canManageQuickBooksConnection } from "@/lib/current-user";

// "Connect QuickBooks" entry point — GET /api/quickbooks/auth. Redirects to
// the real Intuit authorization URL when configured; when it isn't, this
// never attempts a broken redirect, it sends the user back to the
// Integrations page with a clear "isn't configured yet" message. See
// lib/quickbooks.ts for the OAuth endpoint citations.
export const QUICKBOOKS_OAUTH_STATE_COOKIE = "nsf_qb_oauth_state";

export async function GET(req: NextRequest) {
  const actingUser = await getActingUser();
  if (!canManageQuickBooksConnection(actingUser)) {
    return NextResponse.redirect(new URL("/company-setup/quickbooks?error=forbidden", req.url));
  }
  if (!isQuickBooksConfigured()) {
    return NextResponse.redirect(new URL("/company-setup/quickbooks?error=not_configured", req.url));
  }
  const state = randomUUID();
  const url = buildAuthorizationUrl(state);
  if (!url) {
    return NextResponse.redirect(new URL("/company-setup/quickbooks?error=not_configured", req.url));
  }
  const jar = await cookies();
  jar.set(QUICKBOOKS_OAUTH_STATE_COOKIE, state, { httpOnly: true, secure: true, sameSite: "lax", maxAge: 600, path: "/" });
  return NextResponse.redirect(url);
}
