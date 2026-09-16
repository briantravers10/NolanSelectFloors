import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createQuickBooksConnection, setQuickBooksCompanyName, updateQuickBooksConnectionTokens } from "@/lib/db";
import { exchangeCodeForTokens, fetchCompanyInfo, getQuickBooksConfig, isQuickBooksConfigured } from "@/lib/quickbooks";
import { getActingUser, canManageQuickBooksConnection } from "@/lib/current-user";
import { QUICKBOOKS_OAUTH_STATE_COOKIE } from "../auth/route";

/**
 * Real Intuit OAuth 2.0 callback handler — GET
 * /api/quickbooks/callback?code=...&realmId=...&state=.... Verifies the
 * CSRF `state` cookie, exchanges the authorization code for tokens (see
 * lib/quickbooks.ts#exchangeCodeForTokens), fetches CompanyInfo, and
 * persists the connection via lib/db.ts. Correct and complete, but
 * unreachable without a real Intuit redirect (which requires live
 * QUICKBOOKS_CLIENT_ID/SECRET/REDIRECT_URI — see README).
 */
export async function GET(req: NextRequest) {
  const actingUser = await getActingUser();
  if (!canManageQuickBooksConnection(actingUser)) {
    return NextResponse.redirect(new URL("/company-setup/quickbooks?error=forbidden", req.url));
  }
  if (!isQuickBooksConfigured()) {
    return NextResponse.redirect(new URL("/company-setup/quickbooks?error=not_configured", req.url));
  }

  const { searchParams } = req.nextUrl;
  const code = searchParams.get("code");
  const realmId = searchParams.get("realmId");
  const state = searchParams.get("state");
  const jar = await cookies();
  const expectedState = jar.get(QUICKBOOKS_OAUTH_STATE_COOKIE)?.value;
  jar.delete(QUICKBOOKS_OAUTH_STATE_COOKIE);

  if (!code || !realmId || !state || state !== expectedState) {
    return NextResponse.redirect(new URL("/company-setup/quickbooks?error=invalid_callback", req.url));
  }

  const tokens = await exchangeCodeForTokens(code);
  if (!tokens.ok) {
    return NextResponse.redirect(new URL(`/company-setup/quickbooks?error=token_exchange_failed`, req.url));
  }

  const environment = getQuickBooksConfig()?.environment ?? "sandbox";
  const connection = await createQuickBooksConnection({
    realm_id: realmId,
    access_token: tokens.accessToken,
    refresh_token: tokens.refreshToken,
    token_expires_at: tokens.expiresAt,
    environment,
    connected_by: actingUser.fullName,
  });

  // Best-effort — a failed CompanyInfo fetch never blocks the connection
  // itself from being saved; the name just stays unset until Sync Now.
  const companyInfo = await fetchCompanyInfo({
    connection,
    onTokenRefreshed: (rotated) => updateQuickBooksConnectionTokens(connection.id, rotated),
  });
  if (companyInfo.ok) {
    await setQuickBooksCompanyName(connection.id, companyInfo.data.companyName);
  }

  return NextResponse.redirect(new URL("/company-setup/quickbooks?connected=1", req.url));
}
