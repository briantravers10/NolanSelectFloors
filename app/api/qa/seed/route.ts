import { randomUUID } from "crypto";
import { getSupabaseClient } from "@/lib/supabaseClient";
import { getStore } from "@/lib/store";
import { getCurrentCompanyId } from "@/lib/current-user";
import type { InboundEmail } from "@/lib/types";

/**
 * QA-only synthetic data injection — used by the workflow-tier Playwright
 * tests (see qa/tests/workflow and qa/tests/regression) to set up
 * scenarios the UI alone can't quickly create (e.g. a large unfiled-email
 * backlog, for the Inbox pagination regression test).
 *
 * Safety: this is a 404 whenever a real Supabase project is configured —
 * i.e. whenever it could possibly touch real data. It only ever writes to
 * the in-memory seed store (lib/store.ts), which is what the app falls
 * back to with no Supabase env vars set — exactly the environment the QA
 * workflow starts the app in (see .github/workflows/qa.yml). There is no
 * code path here that can reach a configured Supabase project.
 */
export async function POST(request: Request) {
  if (getSupabaseClient()) {
    return new Response("Not available — a real database is configured.", { status: 404 });
  }

  const body = (await request.json().catch(() => ({}))) as { action?: string; count?: number };
  const store = getStore();

  // Answered by qa/global-setup.ts before any write-capable test runs:
  // reaching this line at all means no real database is configured.
  if (body.action === "probe") {
    return Response.json({ ok: true, isolated: true });
  }

  if (body.action === "seed-unfiled-emails") {
    const count = Math.min(Math.max(body.count ?? 30, 1), 500);
    const now = Date.now();
    const emails: InboundEmail[] = Array.from({ length: count }, (_, i) => ({
      id: `qa-inbound-${randomUUID()}`,
      company_id: getCurrentCompanyId(),
      provider_email_id: `qa-${i}`,
      from_email: "qa-test@example.com",
      from_name: "QA Test Sender",
      to_email: "office@nolanselectfloors.com",
      subject: `QA synthetic unfiled email ${i}`,
      text_preview: "Synthetic QA test data",
      received_at: new Date(now - i * 3_600_000).toISOString(),
      kind: "unknown",
      status: "unfiled",
      attachments: [{ id: `qa-att-${i}`, filename: `qa-${i}.pdf`, size: 1000, content_type: "application/pdf" }],
      created_at: new Date(now - i * 3_600_000).toISOString(),
    }));
    store.inboundEmails.push(...emails);
    return Response.json({ ok: true, created: emails.length });
  }

  if (body.action === "reset") {
    const { resetStore } = await import("@/lib/store");
    resetStore();
    return Response.json({ ok: true });
  }

  return new Response("Unknown action", { status: 400 });
}
