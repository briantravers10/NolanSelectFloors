/**
 * LOCAL VALIDATION ONLY — a tiny stand-in for the Supabase API, so the
 * app can be run in REAL-AUTH mode (NSF_REAL_AUTH_ENABLED=true) against
 * no real project at all. Serves the in-memory seed store through a
 * PostgREST-shaped read API, a GoTrue-shaped password login, and refuses
 * every write. This is what lets qa/tests/readonly/authenticated.spec.ts
 * and the middleware write-block be exercised end to end without a
 * production account or a paid Supabase branch.
 *
 * Never used by the GitHub Actions workflow and never deployed.
 *
 *   npx tsx qa/mock/supabase-mock.mts            # listens on :54321
 *   NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321 NEXT_PUBLIC_SUPABASE_ANON_KEY=mock \
 *   SUPABASE_SERVICE_ROLE_KEY=mock NSF_REAL_AUTH_ENABLED=true \
 *   QA_MONITOR_EMAIL=qa-monitor@example.com npx next dev -p 3100
 */
import { createServer, type IncomingMessage, type ServerResponse } from "http";
import { createHmac } from "crypto";
import { buildSeedData } from "../../lib/seed-data";
import type { OfficeUser, SectionPermission } from "../../lib/types";

const PORT = Number(process.env.MOCK_PORT || 54321);
// PostgREST's `max-rows` behavior (Supabase default 1000): a request never
// gets more than this many rows, whatever limit it asks for. Emulated so
// lib/supabase/fetch-all.ts can be proven end to end through supabase-js.
const MAX_ROWS = Number(process.env.MOCK_MAX_ROWS || 1000);
const store = buildSeedData() as unknown as Record<string, Record<string, unknown>[]>;
// Synthetic oversized table for the paging check.
store.bigRows = Array.from({ length: 2345 }, (_, i) => ({ id: String(100000 + i).padStart(8, "0"), n: i }));

// ---- identities ---------------------------------------------------------
export const MONITOR = { id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", email: "qa-monitor@example.com", password: "monitor-pass-123", officeUserId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc" };
export const STAFF = { id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", email: "sbennett@nolanselectfloors.com", password: "staff-pass-123", officeUserId: "ou-1" };

const monitorRow: OfficeUser = {
  id: MONITOR.officeUserId,
  company_id: (store.officeUsers[0] as unknown as OfficeUser).company_id,
  full_name: "QA Monitor",
  email: MONITOR.email,
  role: "estimator",
  access_role: "field_employee",
  active: true,
  created_at: "2026-01-01T00:00:00.000Z",
  auth_user_id: MONITOR.id,
  is_owner: false,
};
store.officeUsers.push(monitorRow as unknown as Record<string, unknown>);
(store.officeUsers.find((u) => u.id === STAFF.officeUserId) as unknown as OfficeUser).auth_user_id = STAFF.id;

// Minimum-necessary grant for monitoring: VIEW on the sections it checks,
// nothing on pricing / company setup / QuickBooks.
for (const key of ["dashboard", "clients", "buildings", "job_requests", "projects", "schedule", "staff", "materials", "reports"]) {
  const perm: SectionPermission = {
    id: `qa-perm-${key}`,
    company_id: monitorRow.company_id,
    office_user_id: MONITOR.officeUserId,
    section_key: key as SectionPermission["section_key"],
    access_level: "view",
    updated_at: "2026-01-01T00:00:00.000Z",
  };
  store.sectionPermissions.push(perm as unknown as Record<string, unknown>);
}

// ---- helpers ------------------------------------------------------------
const b64url = (s: string | Buffer) => Buffer.from(s).toString("base64url");
function mintJwt(user: { id: string; email: string }) {
  const header = b64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload = b64url(
    JSON.stringify({ sub: user.id, email: user.email, role: "authenticated", aud: "authenticated", iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 3600, app_metadata: {}, user_metadata: {} })
  );
  const sig = b64url(createHmac("sha256", "mock-secret").update(`${header}.${payload}`).digest());
  return `${header}.${payload}.${sig}`;
}
function userFromBearer(req: IncomingMessage) {
  const token = (req.headers.authorization ?? "").replace(/^Bearer\s+/i, "");
  try {
    const payload = JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString());
    return [MONITOR, STAFF].find((u) => u.id === payload.sub) ?? null;
  } catch {
    return null;
  }
}
const authUser = (u: { id: string; email: string }) => ({ id: u.id, aud: "authenticated", role: "authenticated", email: u.email, email_confirmed_at: "2026-01-01T00:00:00.000Z", app_metadata: {}, user_metadata: {}, created_at: "2026-01-01T00:00:00.000Z" });
const session = (u: { id: string; email: string }) => ({ access_token: mintJwt(u), token_type: "bearer", expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, refresh_token: `refresh-${u.id}`, user: authUser(u) });

const camel = (t: string) => t.replace(/_([a-z])/g, (_, c) => c.toUpperCase());

function applyFilter(rows: Record<string, unknown>[], key: string, raw: string): Record<string, unknown>[] {
  const [op, ...rest] = raw.split(".");
  const val = rest.join(".");
  const coerce = (v: unknown) => (v === null || v === undefined ? null : String(v));
  switch (op) {
    case "eq":
      return rows.filter((r) => coerce(r[key]) === val);
    case "neq":
      return rows.filter((r) => coerce(r[key]) !== val);
    case "gt":
      return rows.filter((r) => coerce(r[key])! > val);
    case "gte":
      return rows.filter((r) => coerce(r[key])! >= val);
    case "lt":
      return rows.filter((r) => coerce(r[key])! < val);
    case "lte":
      return rows.filter((r) => coerce(r[key])! <= val);
    case "is":
      return rows.filter((r) => (val === "null" ? r[key] == null : val === "true" ? r[key] === true : r[key] === false));
    case "in": {
      const set = new Set(val.replace(/^\(|\)$/g, "").split(",").map((s) => s.replace(/^"|"$/g, "")));
      return rows.filter((r) => set.has(coerce(r[key]) ?? ""));
    }
    case "not": {
      // not.is.null etc.
      const inner = applyFilter(rows, key, rest.join("."));
      return rows.filter((r) => !inner.includes(r));
    }
    default:
      console.warn(`[mock] unsupported filter ${key}=${raw}`);
      return rows;
  }
}

function query(table: string, url: URL, accept: string | undefined): { status: number; body: unknown } {
  const key = camel(table);
  let rows = store[key];
  if (!rows) {
    console.warn(`[mock] no seed table for "${table}" — returning []`);
    rows = [];
  }
  let out = [...rows];
  for (const [k, v] of url.searchParams) {
    if (k === "select" || k === "order" || k === "limit" || k === "offset") continue;
    out = applyFilter(out, k, v);
  }
  const order = url.searchParams.get("order");
  if (order) {
    for (const spec of order.split(",").reverse()) {
      const [col, dir] = spec.split(".");
      out.sort((a, b) => (String(a[col] ?? "") < String(b[col] ?? "") ? -1 : String(a[col] ?? "") > String(b[col] ?? "") ? 1 : 0) * (dir === "desc" ? -1 : 1));
    }
  }
  const offset = Number(url.searchParams.get("offset") ?? 0);
  const limit = Math.min(Number(url.searchParams.get("limit") ?? MAX_ROWS), MAX_ROWS);
  out = out.slice(offset, offset + limit);

  if (accept?.includes("vnd.pgrst.object")) {
    if (out.length === 1) return { status: 200, body: out[0] };
    return { status: 406, body: { code: "PGRST116", details: `${out.length} rows`, hint: null, message: "JSON object requested, multiple (or no) rows returned" } };
  }
  return { status: 200, body: out };
}

const writes: string[] = [];

async function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve) => {
    let data = "";
    req.on("data", (c) => (data += c));
    req.on("end", () => resolve(data));
  });
}

function send(res: ServerResponse, status: number, body: unknown, headers: Record<string, string> = {}) {
  const json = body === undefined ? "" : JSON.stringify(body);
  res.writeHead(status, { "content-type": "application/json", "content-range": "0-0/*", ...headers });
  res.end(json);
}

createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", `http://127.0.0.1:${PORT}`);
  const method = (req.method ?? "GET").toUpperCase();
  const p = url.pathname;

  // ---- GoTrue ----
  if (p === "/auth/v1/token" && method === "POST") {
    const body = JSON.parse((await readBody(req)) || "{}");
    const grant = url.searchParams.get("grant_type");
    if (grant === "password") {
      const u = [MONITOR, STAFF].find((x) => x.email === body.email && x.password === body.password);
      if (!u) return send(res, 400, { error: "invalid_grant", error_description: "Invalid login credentials", code: 400, msg: "Invalid login credentials" });
      return send(res, 200, session(u));
    }
    if (grant === "refresh_token") {
      const u = [MONITOR, STAFF].find((x) => `refresh-${x.id}` === body.refresh_token);
      return u ? send(res, 200, session(u)) : send(res, 400, { error: "invalid_grant" });
    }
    return send(res, 400, { error: "unsupported_grant_type" });
  }
  if (p === "/auth/v1/user" && method === "GET") {
    const u = userFromBearer(req);
    return u ? send(res, 200, authUser(u)) : send(res, 401, { message: "invalid JWT" });
  }
  if (p === "/auth/v1/logout") return send(res, 204, undefined);

  // ---- PostgREST ----
  if (p === "/rest/v1/rpc/has_any_real_account") return send(res, 200, true);
  if (p.startsWith("/rest/v1/")) {
    const table = p.slice("/rest/v1/".length);
    if (method === "GET" || method === "HEAD") {
      const { status, body } = query(table, url, req.headers.accept);
      return send(res, status, body);
    }
    // EVERY write is refused and recorded — the app under test must not
    // need any to render the monitored pages.
    writes.push(`${method} ${table}`);
    console.warn(`[mock] REFUSED write: ${method} ${p}`);
    return send(res, 403, { code: "42501", message: "mock is read-only: write refused" });
  }
  if (p === "/__mock/writes") return send(res, 200, writes);
  if (p.startsWith("/storage/")) return send(res, 404, { message: "no storage in mock" });

  console.warn(`[mock] unhandled ${method} ${p}`);
  send(res, 404, { message: "not found" });
}).listen(PORT, "127.0.0.1", () => console.log(`[mock] Supabase mock listening on http://127.0.0.1:${PORT} — monitor=${MONITOR.email} staff=${STAFF.email}`));
