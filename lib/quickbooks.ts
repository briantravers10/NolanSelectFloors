// QuickBooks Online Integration — service layer (Architecture, Not Yet
// Live). This is the ONLY place QuickBooks API calls happen anywhere in
// this codebase; no component or page ever calls `fetch` against Intuit
// directly. Follows the exact "architected but not live" pattern used by
// lib/routing.ts (real driving directions behind an env-var check, null/
// soft-fail otherwise) and lib/google-calendar.ts (real OAuth-shaped sync
// function that's honestly inert with no credentials): every exported
// function here checks `isQuickBooksConfigured()` (or the narrower
// `isQuickBooksConnected()`), NEVER throws an unhandled error, and NEVER
// fakes a success response. No live Intuit OAuth handshake, sandbox call,
// or webhook has been exercised in this environment — there are no
// credentials to do so with.
//
// ---------------------------------------------------------------------
// RESEARCH FINDINGS this file was built against (verified via web search
// against developer.intuit.com and related sources in September 2026 — see
// README "QuickBooks Online Integration — Research Findings" for the full
// write-up and links):
//
// 1. OAuth 2.0 (authorization code grant):
//    - Authorization URL: https://appcenter.intuit.com/connect/oauth2
//    - Token URL:         https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer
//    - Access tokens expire in ~1 hour; refresh tokens are valid ~100 days
//      and are rotated on every refresh (the new refresh_token from a
//      refresh response must be persisted, replacing the old one).
//    - Source: developer.intuit.com "Set up OAuth 2.0" /
//      "OAuth 2.0 Playground" docs, help.developer.intuit.com "OAuth 2.0".
//
// 2. QuickBooks Online Accounting API base URLs:
//    - Sandbox:    https://sandbox-quickbooks.api.intuit.com/v3/company/{realmId}
//    - Production: https://quickbooks.api.intuit.com/v3/company/{realmId}
//    - Customer/Estimate/Invoice all support `POST /{entity}` (create),
//      `GET /{entity}/{id}` (read), and `GET /query?query=...` (SQL-like
//      query language) under this base.
//    - Source: developer.intuit.com "Develop" docs, help.developer.intuit.com
//      "Where do I find out base URL?".
//
// 3. Webhooks: Intuit signs each delivery with an `intuit-signature` header
//    — an HMAC-SHA256 digest of the raw request body, keyed with the app's
//    Webhooks "Verifier Token" (from the Intuit Developer portal's webhooks
//    subscription page), base64-encoded. Verification must happen against
//    the RAW body before any JSON parsing.
//      IMPORTANT: Intuit is retiring the legacy `eventNotifications`
//      envelope in favor of the CNCF CloudEvents v1.0 format (fields:
//      specversion, id, type, time, source, plus Intuit extension
//      attributes and a `data` payload carrying the realm + entity
//      change), with a hard cutover deadline of July 31, 2026 — already
//      past as of this build (today: September 2026). The signature
//      mechanism itself is unaffected by this migration; only the envelope
//      shape changed. This receiver is written for the CloudEvents shape,
//      with a fallback parse of the legacy shape for safety.
//    - Source: help.developer.intuit.com "QuickBooks Webhooks", Intuit
//      Developer blog "Upcoming change to webhooks payload structure"
//      (blogs.intuit.com, Nov 2025 — could not be fetched directly in this
//      environment, network-egress-blocked; details corroborated via
//      independent secondary sources: Maesn "QuickBooks Webhooks to
//      CloudEvents Migration Guide", the intuit/SampleApp-Webhooks-Java-
//      Cloudevents reference sample on GitHub).
//
// 4. Deep links: QuickBooks Online does NOT publish a supported, versioned
//    "open this transaction by ID" API for arbitrary third-party apps, but
//    a widely-used and long-standing web app URL pattern is documented in
//    practice (Intuit community/help posts, integration vendors like
//    Scoro/Zapier): `https://qbo.intuit.com/app/invoice?txnId={txnId}` and
//    the equivalent `.../app/estimate?txnId={txnId}`, where `{txnId}` is
//    the QBO entity's own `Id` (exactly what this app stores as
//    `qb_entity_id` — never fabricated from the human-readable document
//    number). This is the safest real link available and is what
//    buildQuickBooksDeepLink() below produces; the document NUMBER is
//    always shown alongside it regardless, per the client's explicit
//    fallback instruction, since this format isn't part of Intuit's
//    versioned/guaranteed API surface.
// ---------------------------------------------------------------------

import { createHmac, timingSafeEqual } from "crypto";
import type {
  QBDocumentStatus,
  QuickBooksConnection,
  QuickBooksCustomerCandidate,
  QuickBooksEntityType,
  QuickBooksLineItem,
} from "./types";

// ---------------------------------------------------------------------
// CONFIGURATION
// ---------------------------------------------------------------------

export interface QuickBooksConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  environment: "sandbox" | "production";
}

/** Reads the four env vars a real QuickBooks connection needs. A
 * partially-configured environment (e.g. client id with no secret) is
 * treated the same as unconfigured — see lib/google-calendar.ts for the
 * same convention. */
export function getQuickBooksConfig(): QuickBooksConfig | null {
  const clientId = process.env.QUICKBOOKS_CLIENT_ID;
  const clientSecret = process.env.QUICKBOOKS_CLIENT_SECRET;
  const redirectUri = process.env.QUICKBOOKS_REDIRECT_URI;
  if (!clientId || !clientSecret || !redirectUri) return null;
  const environment = process.env.QUICKBOOKS_ENVIRONMENT === "production" ? "production" : "sandbox";
  return { clientId, clientSecret, redirectUri, environment };
}

export function isQuickBooksConfigured(): boolean {
  return getQuickBooksConfig() !== null;
}

export function isWebhookVerificationConfigured(): boolean {
  return !!process.env.QUICKBOOKS_WEBHOOK_VERIFIER_TOKEN;
}

/** Whether there's an active (not disconnected, not needing reconnect)
 * connection row to actually call the API with. */
export function isQuickBooksConnected(connection: QuickBooksConnection | null | undefined): connection is QuickBooksConnection {
  return !!connection && !connection.disconnected_at && !connection.needs_reconnect;
}

const OAUTH_AUTHORIZE_URL = "https://appcenter.intuit.com/connect/oauth2";
const OAUTH_TOKEN_URL = "https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer";
const OAUTH_SCOPE = "com.intuit.quickbooks.accounting";

function apiBaseUrl(environment: "sandbox" | "production"): string {
  return environment === "production"
    ? "https://quickbooks.api.intuit.com/v3/company"
    : "https://sandbox-quickbooks.api.intuit.com/v3/company";
}

// ---------------------------------------------------------------------
// OAUTH 2.0 — AUTHORIZATION CODE FLOW
// ---------------------------------------------------------------------

/**
 * Builds the real Intuit authorization redirect URL. Returns null (never
 * throws) when QuickBooks isn't configured — the "Connect QuickBooks"
 * button/route must show a clear "isn't configured yet" message instead of
 * attempting a broken redirect. `state` should be a per-request random
 * value the caller verifies on callback (CSRF protection).
 */
export function buildAuthorizationUrl(state: string): string | null {
  const config = getQuickBooksConfig();
  if (!config) return null;
  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    response_type: "code",
    scope: OAUTH_SCOPE,
    state,
  });
  return `${OAUTH_AUTHORIZE_URL}?${params.toString()}`;
}

export type TokenResult =
  | { ok: true; accessToken: string; refreshToken: string; expiresAt: string }
  | { ok: false; reason: "not_configured" | "request_failed"; message: string };

/** Exchanges an OAuth authorization code for an access/refresh token pair.
 * Real implementation — correct today, only unreachable without live
 * credentials + a real Intuit redirect having occurred. */
export async function exchangeCodeForTokens(code: string): Promise<TokenResult> {
  const config = getQuickBooksConfig();
  if (!config) return { ok: false, reason: "not_configured", message: "QuickBooks isn't configured yet." };
  try {
    const res = await fetch(OAUTH_TOKEN_URL, {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${config.clientId}:${config.clientSecret}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: config.redirectUri,
      }),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      return { ok: false, reason: "request_failed", message: `Intuit token exchange failed (${res.status}): ${detail.slice(0, 300)}` };
    }
    const data = (await res.json()) as { access_token: string; refresh_token: string; expires_in: number };
    return {
      ok: true,
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: new Date(Date.now() + data.expires_in * 1000).toISOString(),
    };
  } catch (err) {
    return { ok: false, reason: "request_failed", message: err instanceof Error ? err.message : "Unknown error contacting Intuit." };
  }
}

/**
 * Refreshes an expired access token using the stored refresh token. Real
 * implementation, written to actually work once configured — it just can't
 * be EXECUTED against Intuit's servers in this environment (no live
 * connection exists). Callers persist the returned (rotated) refresh token
 * via lib/db.ts#updateQuickBooksConnectionTokens — Intuit rotates the
 * refresh token on every refresh, so the old one must be replaced, not kept.
 */
export async function refreshAccessToken(refreshToken: string): Promise<TokenResult> {
  const config = getQuickBooksConfig();
  if (!config) return { ok: false, reason: "not_configured", message: "QuickBooks isn't configured yet." };
  try {
    const res = await fetch(OAUTH_TOKEN_URL, {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${config.clientId}:${config.clientSecret}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: refreshToken }),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      return { ok: false, reason: "request_failed", message: `Token refresh failed (${res.status}): ${detail.slice(0, 300)}` };
    }
    const data = (await res.json()) as { access_token: string; refresh_token: string; expires_in: number };
    return {
      ok: true,
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: new Date(Date.now() + data.expires_in * 1000).toISOString(),
    };
  } catch (err) {
    return { ok: false, reason: "request_failed", message: err instanceof Error ? err.message : "Unknown error contacting Intuit." };
  }
}

/** True when a connection's access token has expired (or is within 60s of
 * expiring) and needs a refresh before the next API call. */
export function isTokenExpired(connection: Pick<QuickBooksConnection, "token_expires_at">): boolean {
  return new Date(connection.token_expires_at).getTime() - 60_000 <= Date.now();
}

// ---------------------------------------------------------------------
// GENERIC API REQUEST — every Customer/Estimate/Invoice call routes
// through this. Auto-refreshes an expired token once, and NEVER throws:
// every failure comes back as a typed result the caller can display.
// ---------------------------------------------------------------------

export type QBApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; reason: "not_configured" | "not_connected" | "needs_reconnect" | "request_failed"; message: string };

export interface QuickBooksApiContext {
  connection: QuickBooksConnection;
  /** Called when a refresh rotates the token, so the caller can persist it
   * (see lib/db.ts#updateQuickBooksConnectionTokens). Not calling this back
   * would silently drift the stored refresh token out of sync with Intuit's
   * records and eventually strand the connection. */
  onTokenRefreshed?: (tokens: { accessToken: string; refreshToken: string; expiresAt: string }) => Promise<void>;
}

async function qbFetch<T>(ctx: QuickBooksApiContext, path: string, init?: RequestInit): Promise<QBApiResult<T>> {
  if (!isQuickBooksConfigured()) return { ok: false, reason: "not_configured", message: "QuickBooks isn't configured yet." };
  if (ctx.connection.disconnected_at || ctx.connection.needs_reconnect) {
    return ctx.connection.needs_reconnect
      ? { ok: false, reason: "needs_reconnect", message: "QuickBooks Connection Needs Attention — please reconnect." }
      : { ok: false, reason: "not_connected", message: "QuickBooks isn't connected." };
  }

  let accessToken = ctx.connection.access_token;
  if (isTokenExpired(ctx.connection)) {
    const refreshed = await refreshAccessToken(ctx.connection.refresh_token);
    if (!refreshed.ok) {
      return { ok: false, reason: "needs_reconnect", message: "QuickBooks Connection Needs Attention — reconnecting failed: " + refreshed.message };
    }
    accessToken = refreshed.accessToken;
    if (ctx.onTokenRefreshed) await ctx.onTokenRefreshed(refreshed);
  }

  const base = apiBaseUrl(ctx.connection.environment);
  try {
    const res = await fetch(`${base}/${ctx.connection.realm_id}/${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
        "Content-Type": "application/json",
        ...(init?.headers ?? {}),
      },
    });
    if (res.status === 401) {
      return { ok: false, reason: "needs_reconnect", message: "QuickBooks Connection Needs Attention — Intuit rejected the access token." };
    }
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      return { ok: false, reason: "request_failed", message: `QuickBooks API error (${res.status}): ${detail.slice(0, 300)}` };
    }
    const data = (await res.json()) as T;
    return { ok: true, data };
  } catch (err) {
    // Network failure, DNS, timeout, etc. — degrade gracefully, never crash
    // the flooring app over a QuickBooks outage. See README "Security".
    return { ok: false, reason: "request_failed", message: err instanceof Error ? err.message : "Unknown error contacting QuickBooks." };
  }
}

// ---------------------------------------------------------------------
// CUSTOMERS
// ---------------------------------------------------------------------

interface QBCustomerQueryResponse {
  QueryResponse?: { Customer?: { Id: string; DisplayName: string }[] };
}

/**
 * Fuzzy string similarity (normalized token-overlap + Levenshtein blend),
 * 0–1. Pure function, used only to SORT/SURFACE possible matches for a
 * human to confirm — never to auto-link. Good enough for "Riverside Realty
 * Group" ~ "Riverside Realty" without pulling in a dependency.
 */
export function fuzzyNameSimilarity(a: string, b: string): number {
  const na = a.trim().toLowerCase();
  const nb = b.trim().toLowerCase();
  if (!na || !nb) return 0;
  if (na === nb) return 1;
  const setA = new Set(na.split(/\s+/));
  const setB = new Set(nb.split(/\s+/));
  const overlap = [...setA].filter((w) => setB.has(w)).length;
  const tokenScore = overlap / Math.max(setA.size, setB.size);
  const dist = levenshtein(na, nb);
  const editScore = 1 - dist / Math.max(na.length, nb.length);
  return Math.max(0, Math.min(1, tokenScore * 0.6 + editScore * 0.4));
}

function levenshtein(a: string, b: string): number {
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 0; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      dp[i][j] = a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[a.length][b.length];
}

const MIN_MATCH_SCORE = 0.4;

/**
 * Searches live QuickBooks customers by name and returns fuzzy-scored
 * candidates for the matching UI — never auto-links. Returns a
 * "not connected" result honestly when no live connection exists; the
 * Settings UI renders its matching screen structurally either way (see
 * app/company-setup/quickbooks/page.tsx) with an explanatory empty state
 * rather than fabricated candidates.
 */
export async function findCustomerMatchCandidates(
  ctx: QuickBooksApiContext,
  clientCompanyName: string
): Promise<QBApiResult<QuickBooksCustomerCandidate[]>> {
  const result = await qbFetch<QBCustomerQueryResponse>(
    ctx,
    `query?query=${encodeURIComponent("select Id, DisplayName from Customer maxresults 1000")}`
  );
  if (!result.ok) return result;
  const customers = result.data.QueryResponse?.Customer ?? [];
  const candidates = customers
    .map((c) => ({ qb_customer_id: c.Id, qb_customer_name: c.DisplayName, score: fuzzyNameSimilarity(clientCompanyName, c.DisplayName) }))
    .filter((c) => c.score >= MIN_MATCH_SCORE)
    .sort((a, b) => b.score - a.score);
  return { ok: true, data: candidates };
}

export async function searchCustomersByName(ctx: QuickBooksApiContext, query: string): Promise<QBApiResult<{ id: string; name: string }[]>> {
  const escaped = query.replace(/'/g, "\\'");
  const result = await qbFetch<QBCustomerQueryResponse>(
    ctx,
    `query?query=${encodeURIComponent(`select Id, DisplayName from Customer where DisplayName like '%${escaped}%' maxresults 20`)}`
  );
  if (!result.ok) return result;
  return { ok: true, data: (result.data.QueryResponse?.Customer ?? []).map((c) => ({ id: c.Id, name: c.DisplayName })) };
}

/** Fetches CompanyInfo right after connecting, to show a real company name
 * on the Integrations page instead of just the realm id. */
export async function fetchCompanyInfo(ctx: QuickBooksApiContext): Promise<QBApiResult<{ companyName: string }>> {
  const result = await qbFetch<{ CompanyInfo: { CompanyName: string } }>(ctx, `companyinfo/${ctx.connection.realm_id}`);
  if (!result.ok) return result;
  return { ok: true, data: { companyName: result.data.CompanyInfo.CompanyName } };
}

export async function createQuickBooksCustomer(ctx: QuickBooksApiContext, displayName: string): Promise<QBApiResult<{ id: string; name: string }>> {
  const result = await qbFetch<{ Customer: { Id: string; DisplayName: string } }>(ctx, "customer", {
    method: "POST",
    body: JSON.stringify({ DisplayName: displayName }),
  });
  if (!result.ok) return result;
  return { ok: true, data: { id: result.data.Customer.Id, name: result.data.Customer.DisplayName } };
}

// ---------------------------------------------------------------------
// ESTIMATES & INVOICES
// ---------------------------------------------------------------------

export interface CreateDocumentInput {
  qbCustomerId: string;
  lineItems: QuickBooksLineItem[];
}

interface QBTxnResponse {
  Id: string;
  DocNumber?: string;
  TotalAmt: number;
  TxnStatus?: string;
  Balance?: number;
}

function lineItemsToQBLines(items: QuickBooksLineItem[]) {
  // SalesItemLineDetail normally references a QBO Item id; since this app
  // has no live Item catalog to map against, every line is sent as a
  // DescriptionOnly-style amount line (Description + Amount), which the
  // QBO API accepts for both Estimate and Invoice. Quantity/rate are kept
  // in the description for now — a live integration would map to a real
  // Item once the customer's QBO Item list can be read (future work, see
  // README).
  return items.map((item) => ({
    Description: `${item.description} — qty ${item.quantity} × ${item.rate.toFixed(2)}`,
    Amount: item.amount,
    DetailType: "DescriptionOnlyLineDetail" as const,
  }));
}

export interface CreatedDocument {
  qb_entity_id: string;
  document_number?: string;
  amount: number;
  status: QBDocumentStatus;
}

/** "Create Estimate/Invoice in QuickBooks" — called ONLY from a review
 * screen the user has already confirmed. NEVER called automatically (e.g.
 * on job completion) — see README "Estimate/Invoice Creation". Never sends
 * the document — QuickBooks' own UI is the only place a human sends it. */
export async function createEstimate(ctx: QuickBooksApiContext, input: CreateDocumentInput): Promise<QBApiResult<CreatedDocument>> {
  const result = await qbFetch<{ Estimate: QBTxnResponse }>(ctx, "estimate", {
    method: "POST",
    body: JSON.stringify({ CustomerRef: { value: input.qbCustomerId }, Line: lineItemsToQBLines(input.lineItems) }),
  });
  if (!result.ok) return result;
  const e = result.data.Estimate;
  return { ok: true, data: { qb_entity_id: e.Id, document_number: e.DocNumber, amount: e.TotalAmt, status: mapQBEstimateStatus(e.TxnStatus) } };
}

export async function createInvoice(ctx: QuickBooksApiContext, input: CreateDocumentInput): Promise<QBApiResult<CreatedDocument>> {
  const result = await qbFetch<{ Invoice: QBTxnResponse }>(ctx, "invoice", {
    method: "POST",
    body: JSON.stringify({ CustomerRef: { value: input.qbCustomerId }, Line: lineItemsToQBLines(input.lineItems) }),
  });
  if (!result.ok) return result;
  const inv = result.data.Invoice;
  return {
    ok: true,
    data: { qb_entity_id: inv.Id, document_number: inv.DocNumber, amount: inv.TotalAmt, status: mapQBInvoiceStatus(inv.Balance, inv.TotalAmt) },
  };
}

/** Fetches a single Estimate/Invoice by its QBO id — used both by "Link
 * Existing Document" (to confirm the id is real + pull its current amount/
 * status before mapping it) and by Sync Now (to refresh status). */
export async function fetchDocumentById(
  ctx: QuickBooksApiContext,
  entityType: QuickBooksEntityType,
  qbEntityId: string
): Promise<QBApiResult<CreatedDocument>> {
  const path = entityType.toLowerCase();
  const result = await qbFetch<Record<string, QBTxnResponse>>(ctx, `${path}/${qbEntityId}`);
  if (!result.ok) return result;
  const txn = result.data[entityType];
  if (!txn) return { ok: false, reason: "request_failed", message: "Unexpected response shape from QuickBooks." };
  return {
    ok: true,
    data:
      entityType === "Estimate"
        ? { qb_entity_id: txn.Id, document_number: txn.DocNumber, amount: txn.TotalAmt, status: mapQBEstimateStatus(txn.TxnStatus) }
        : { qb_entity_id: txn.Id, document_number: txn.DocNumber, amount: txn.TotalAmt, status: mapQBInvoiceStatus(txn.Balance, txn.TotalAmt) },
  };
}

function mapQBEstimateStatus(txnStatus: string | undefined): QBDocumentStatus {
  switch (txnStatus) {
    case "Accepted":
      return "Accepted";
    case "Closed":
      return "Closed";
    case "Rejected":
      return "Rejected";
    default:
      return "Pending";
  }
}

/** QBO's Invoice entity exposes `Balance` (remaining amount owed) and
 * `TotalAmt`, not a first-class "status" enum — this app derives a
 * status from those two figures (Balance 0 => Paid, 0 < Balance < Total =>
 * Partially Paid, Balance === Total => Open). "Unsent"/"Overdue" require
 * EmailStatus/DueDate context this simplified mapper doesn't yet read; a
 * fuller sync would layer those in. See README for exactly what the QBO
 * Invoice API was found to expose. */
function mapQBInvoiceStatus(balance: number | undefined, total: number): QBDocumentStatus {
  if (balance === undefined) return "Open";
  if (balance <= 0) return "Paid";
  if (balance < total) return "Partially Paid";
  return "Open";
}

/** The paid-amount figure for a document, given its status — Paid counts
 * the full amount, Partially Paid needs its own tracked `amount_paid`
 * (this function is the single place that convention is expressed). */
export function paidAmountForDocument(doc: { status: QBDocumentStatus; amount: number; amount_paid?: number }): number {
  if (doc.status === "Paid") return doc.amount;
  if (doc.status === "Partially Paid") return doc.amount_paid ?? 0;
  return 0;
}

// ---------------------------------------------------------------------
// DEEP LINKS — see the research note at the top of this file. Always
// display the document number alongside this link regardless of whether
// it resolves, since this URL pattern isn't part of Intuit's versioned API
// surface.
// ---------------------------------------------------------------------

export function buildQuickBooksDeepLink(entityType: QuickBooksEntityType, qbEntityId: string): string {
  const path = entityType === "Estimate" ? "estimate" : "invoice";
  return `https://qbo.intuit.com/app/${path}?txnId=${encodeURIComponent(qbEntityId)}`;
}

// ---------------------------------------------------------------------
// WEBHOOKS — signature verification + payload parsing.
// ---------------------------------------------------------------------

/**
 * Verifies the `intuit-signature` header against the RAW request body using
 * HMAC-SHA256 keyed with QUICKBOOKS_WEBHOOK_VERIFIER_TOKEN (from the
 * Intuit Developer portal's webhooks subscription page), matching the
 * base64-encoded digest Intuit sends. Must be called with the raw,
 * unparsed body text — never a re-serialized JSON.stringify of a parsed
 * object, which can produce different bytes than what was actually signed.
 * Returns false (never throws) on any missing config, missing header, or
 * malformed input — callers must reject the request when this is false.
 */
export function verifyIntuitWebhookSignature(rawBody: string, signatureHeader: string | null | undefined): boolean {
  const verifierToken = process.env.QUICKBOOKS_WEBHOOK_VERIFIER_TOKEN;
  if (!verifierToken || !signatureHeader) return false;
  try {
    const expected = createHmac("sha256", verifierToken).update(rawBody, "utf8").digest("base64");
    const expectedBuf = Buffer.from(expected);
    const actualBuf = Buffer.from(signatureHeader);
    if (expectedBuf.length !== actualBuf.length) return false;
    return timingSafeEqual(expectedBuf, actualBuf);
  } catch {
    return false;
  }
}

export interface ParsedWebhookEntityEvent {
  eventId: string;
  realmId: string;
  entityName: string;
  entityId: string;
  operation: string;
}

/**
 * Parses a QuickBooks webhook payload into a flat list of entity-change
 * events, handling BOTH the current CloudEvents v1.0 envelope (the format
 * Intuit's webhooks infrastructure uses as of this build — see the
 * research note above) and the legacy `eventNotifications` envelope as a
 * defensive fallback, since the exact rollout state of any given Intuit
 * app can't be verified without live credentials. Returns an empty array
 * (never throws) for anything unrecognized.
 */
export function parseWebhookPayload(body: unknown): ParsedWebhookEntityEvent[] {
  if (!body || typeof body !== "object") return [];
  const events: ParsedWebhookEntityEvent[] = [];

  // CloudEvents v1.0 shape: either a single CloudEvent object, or (per the
  // migration notes) a batch containing events for multiple realms/
  // companies in one delivery.
  const asArray = Array.isArray(body) ? body : [body];
  for (const item of asArray) {
    if (!item || typeof item !== "object") continue;
    const rec = item as Record<string, unknown>;
    if (typeof rec.specversion === "string" && typeof rec.id === "string" && rec.data && typeof rec.data === "object") {
      const data = rec.data as Record<string, unknown>;
      const realmId = String((data.realmId ?? rec.intuitaccountid) ?? "");
      const entities = Array.isArray(data.entities) ? data.entities : [data];
      for (const entity of entities) {
        if (!entity || typeof entity !== "object") continue;
        const e = entity as Record<string, unknown>;
        const entityId = String(e.id ?? e.entityId ?? "");
        const entityName = String(e.name ?? e.entityName ?? rec.type ?? "");
        if (!entityId) continue;
        events.push({ eventId: String(rec.id), realmId, entityName, entityId, operation: String(e.operation ?? "Update") });
      }
      continue;
    }

    // Legacy eventNotifications envelope, kept as a fallback:
    // { eventNotifications: [{ realmId, dataChangeEvent: { entities: [{ name, id, operation }] } }] }
    const legacy = rec.eventNotifications;
    if (Array.isArray(legacy)) {
      for (const notification of legacy) {
        if (!notification || typeof notification !== "object") continue;
        const n = notification as Record<string, unknown>;
        const realmId = String(n.realmId ?? "");
        const dataChangeEvent = n.dataChangeEvent as Record<string, unknown> | undefined;
        const entities = Array.isArray(dataChangeEvent?.entities) ? (dataChangeEvent!.entities as Record<string, unknown>[]) : [];
        for (const e of entities) {
          const entityId = String(e.id ?? "");
          if (!entityId) continue;
          events.push({
            eventId: `${realmId}:${e.name}:${entityId}:${e.lastUpdated ?? ""}`,
            realmId,
            entityName: String(e.name ?? ""),
            entityId,
            operation: String(e.operation ?? "Update"),
          });
        }
      }
    }
  }
  return events;
}
