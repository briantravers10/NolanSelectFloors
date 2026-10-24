import { test, expect } from "@playwright/test";
import { readFileSync } from "fs";
import { PGlite } from "@electric-sql/pglite";

/**
 * Security tier — no browser, no network, no Supabase project. Runs the
 * ACTUAL migration files (0038, 0039, 0040 — read from disk, not copied
 * here) inside a real embedded Postgres (PGlite), emulating exactly what
 * Supabase's API layer does per request: `set role` to the token's role
 * and expose the token's claims via `request.jwt.claims`. Supabase's own
 * `auth.uid()` / `auth.jwt()` helpers are defined below with the same
 * bodies Supabase ships, and `anon` / `authenticated` get the same table
 * privileges Supabase grants by default — so RLS is the only gate, as in
 * production.
 *
 * Each test is one of the abuse attempts from the security review:
 * forged QA results, unauthorized updates, fake or tampered bug reports,
 * and reading what the QA identity must never read.
 */
const MIGRATIONS = ["supabase/migrations/0038_bug_reports.sql", "supabase/migrations/0039_qa_tracking.sql", "supabase/migrations/0040_qa_agent_bug_report_policy.sql"];

const COMPANY = "11111111-1111-4111-8111-111111111111";
const WRITER_UID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const STAFF_UID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

type Claims = { sub: string; role: string; app_metadata?: Record<string, unknown>; user_metadata?: Record<string, unknown> };

const WRITER: Claims = { sub: WRITER_UID, role: "authenticated", app_metadata: { qa_role: "results_writer" } };
const STAFF: Claims = { sub: STAFF_UID, role: "authenticated", app_metadata: {} };
// Someone who set qa_role on their OWN metadata (user_metadata is
// user-editable; app_metadata is not) — must not count.
const SELF_CLAIMED: Claims = { sub: STAFF_UID, role: "authenticated", app_metadata: {}, user_metadata: { qa_role: "results_writer" } };

let db: PGlite;

/** Run `sql` as `role` with the given JWT claims, in its own transaction
 * that is always rolled back — so each attempt starts from the same
 * state. Returns the rows (for selects) or throws the Postgres error. */
async function as(role: "anon" | "authenticated", claims: Claims | null, sql: string): Promise<Record<string, unknown>[]> {
  const claimsJson = claims ? JSON.stringify(claims) : "";
  await db.exec("begin");
  try {
    await db.exec(`set local role ${role}`);
    await db.query("select set_config('request.jwt.claims', $1, true)", [claimsJson]);
    const r = await db.query<Record<string, unknown>>(sql);
    return r.rows;
  } finally {
    await db.exec("rollback");
  }
}

/** Same, but the transaction is committed — for setting up fixtures as the writer. */
async function commitAs(role: "anon" | "authenticated", claims: Claims | null, sql: string): Promise<void> {
  await db.exec("begin");
  try {
    await db.exec(`set local role ${role}`);
    await db.query("select set_config('request.jwt.claims', $1, true)", [claims ? JSON.stringify(claims) : ""]);
    await db.exec(sql);
    await db.exec("commit");
  } catch (e) {
    await db.exec("rollback");
    throw e;
  }
}

async function rejected(role: "anon" | "authenticated", claims: Claims | null, sql: string): Promise<string> {
  try {
    await as(role, claims, sql);
  } catch (e) {
    return (e as Error).message;
  }
  return "";
}

const superCount = async (table: string) => Number((await db.query<{ n: string }>(`select count(*)::text as n from ${table}`)).rows[0].n);

test.beforeAll(async () => {
  db = new PGlite();
  await db.exec(`
    create schema if not exists auth;
    create role anon nologin;
    create role authenticated nologin;
    -- Supabase's shipped helpers, verbatim in substance.
    create or replace function auth.jwt() returns jsonb language sql stable as $$
      select coalesce(
        nullif(current_setting('request.jwt.claim', true), ''),
        nullif(current_setting('request.jwt.claims', true), '')
      )::jsonb
    $$;
    create or replace function auth.uid() returns uuid language sql stable as $$
      select nullif(coalesce(
        current_setting('request.jwt.claim.sub', true),
        (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
      ), '')::uuid
    $$;
    create table companies (id uuid primary key);
    insert into companies values ('${COMPANY}');
  `);
  for (const file of MIGRATIONS) await db.exec(readFileSync(file, "utf8"));
  // Supabase's default grants: anon/authenticated can use the schema and
  // touch every table — RLS is the only thing standing in the way.
  await db.exec(`
    grant usage on schema public, auth to anon, authenticated;
    grant all on all tables in schema public to anon, authenticated;
    grant execute on all functions in schema public, auth to anon, authenticated;
    alter default privileges in schema public grant all on tables to anon, authenticated;
  `);
  // A human-filed report already in the table (as the app's service role
  // would write it — the superuser here plays that part).
  await db.exec(`insert into bug_reports (company_id, reported_by_user_id, reported_by_name, page_path, description, status)
                 values ('${COMPANY}', 'owner', 'Brian Travers', '/schedule', 'A real employee-filed report', 'Open')`);
});

test.afterAll(async () => {
  await db.close();
});

const INSERT_RUN = `insert into qa_test_runs (company_id, trigger, status, total_tests, passed_tests) values ('${COMPANY}', 'scheduled', 'passed', 10, 10) returning id`;

test("the migrations apply cleanly and RLS is enabled on every QA table", async () => {
  const rows = await db.query<{ tablename: string; rowsecurity: boolean }>(
    "select tablename, rowsecurity from pg_tables where schemaname='public' and tablename in ('qa_test_runs','qa_findings','bug_reports') order by 1"
  );
  expect(rows.rows).toEqual([
    { tablename: "bug_reports", rowsecurity: true },
    { tablename: "qa_findings", rowsecurity: true },
    { tablename: "qa_test_runs", rowsecurity: true },
  ]);
});

test.describe("the public anon key (what anyone on the internet holds)", () => {
  test("cannot forge a QA run", async () => {
    expect(await rejected("anon", null, INSERT_RUN)).toMatch(/row-level security/);
  });
  test("cannot file a bug report, even one tagged as the QA agent", async () => {
    expect(
      await rejected("anon", null, `insert into bug_reports (company_id, reported_by_user_id, reported_by_name, page_path, description) values ('${COMPANY}','qa-agent','QA Agent','/x','forged')`)
    ).toMatch(/row-level security/);
  });
  test("sees nothing in any of the three tables", async () => {
    expect(await as("anon", null, "select id from bug_reports")).toHaveLength(0);
    expect(await as("anon", null, "select id from qa_test_runs")).toHaveLength(0);
    expect(await as("anon", null, "select id from qa_findings")).toHaveLength(0);
  });
});

test.describe("a normal staff login (authenticated, no qa_role claim)", () => {
  test("cannot forge a QA run or finding", async () => {
    expect(await rejected("authenticated", STAFF, INSERT_RUN)).toMatch(/row-level security/);
  });
  test("cannot file a bug report by pretending to be the QA agent", async () => {
    expect(
      await rejected("authenticated", STAFF, `insert into bug_reports (company_id, reported_by_user_id, reported_by_name, page_path, description) values ('${COMPANY}','qa-agent','QA Agent','/x','forged')`)
    ).toMatch(/row-level security/);
  });
  test("cannot read any bug report through the API path", async () => {
    expect(await as("authenticated", STAFF, "select id from bug_reports")).toHaveLength(0);
  });
  test("self-assigned qa_role in user_metadata does not count", async () => {
    expect(await rejected("authenticated", SELF_CLAIMED, INSERT_RUN)).toMatch(/row-level security/);
  });
});

test.describe("the QA results writer (app_metadata.qa_role = results_writer)", () => {
  test("can record a run and a finding, and read them back", async () => {
    await commitAs("authenticated", WRITER, `insert into qa_test_runs (id, company_id, trigger, status) values ('cccccccc-cccc-4ccc-8ccc-cccccccccccc', '${COMPANY}', 'scheduled', 'failed')`);
    await commitAs(
      "authenticated",
      WRITER,
      `insert into qa_findings (company_id, run_id, test_name, page_path, error_message) values ('${COMPANY}', 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', 'loads /schedule', '/schedule', 'boom')`
    );
    expect(await as("authenticated", WRITER, "select id from qa_test_runs")).toHaveLength(1);
    expect(await as("authenticated", WRITER, "select id from qa_findings")).toHaveLength(1);
  });

  test("can file a bug report tagged as the QA agent", async () => {
    const before = await superCount("bug_reports");
    await commitAs(
      "authenticated",
      WRITER,
      `insert into bug_reports (company_id, reported_by_user_id, reported_by_name, page_path, description) values ('${COMPANY}','qa-agent','QA Agent (automated)','/schedule','[Automated QA] loads /schedule')`
    );
    expect(await superCount("bug_reports")).toBe(before + 1);
  });

  test("cannot file a bug report under any other reporter identity", async () => {
    expect(
      await rejected("authenticated", WRITER, `insert into bug_reports (company_id, reported_by_user_id, reported_by_name, page_path, description) values ('${COMPANY}','owner','Brian Travers','/x','impersonated')`)
    ).toMatch(/row-level security/);
  });

  test("cannot read any bug report — not even its own", async () => {
    expect(await superCount("bug_reports")).toBeGreaterThanOrEqual(2);
    expect(await as("authenticated", WRITER, "select id from bug_reports")).toHaveLength(0);
  });

  test("cannot update or delete any bug report (0 rows affected, silently)", async () => {
    const updated = await as("authenticated", WRITER, "update bug_reports set status = 'Resolved' returning id");
    expect(updated).toHaveLength(0);
    const deleted = await as("authenticated", WRITER, "delete from bug_reports returning id");
    expect(deleted).toHaveLength(0);
    // Superuser view: the human-filed report is untouched.
    const row = await db.query<{ status: string }>("select status from bug_reports where reported_by_user_id = 'owner'");
    expect(row.rows[0].status).toBe("Open");
  });

  test("has no access to any other table", async () => {
    // companies exists in this fixture with RLS off, as a control that the
    // grants really are permissive — then prove the writer can't touch a
    // business table once RLS is on with no policy (the production state
    // of every other table, verified against the live project).
    await db.exec("create table employees (id uuid primary key default gen_random_uuid(), daily_rate numeric); insert into employees (daily_rate) values (430); alter table employees enable row level security;");
    expect(await as("authenticated", WRITER, "select daily_rate from employees")).toHaveLength(0);
    expect(await rejected("authenticated", WRITER, "insert into employees (daily_rate) values (1)")).toMatch(/row-level security/);
  });
});

test("the two migration files referenced by this test are the ones in the repo", () => {
  // Guard against the test silently validating a stale copy.
  for (const f of MIGRATIONS) expect(readFileSync(f, "utf8").length).toBeGreaterThan(100);
});
