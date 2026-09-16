import { NextRequest, NextResponse } from "next/server";
import {
  fetchDocumentById,
  isWebhookVerificationConfigured,
  parseWebhookPayload,
  verifyIntuitWebhookSignature,
} from "@/lib/quickbooks";
import {
  getQuickBooksConnection,
  hasProcessedQuickBooksWebhookEvent,
  listQuickBooksDocuments,
  logQuickBooksSyncEvent,
  recordQuickBooksWebhookEvent,
  updateQuickBooksConnectionTokens,
  updateQuickBooksDocumentStatus,
} from "@/lib/db";

/**
 * QuickBooks webhook receiver. Verifies the `intuit-signature` header
 * (HMAC-SHA256 keyed with QUICKBOOKS_WEBHOOK_VERIFIER_TOKEN) against the
 * RAW request body BEFORE parsing or processing anything, and rejects any
 * request that doesn't verify — see lib/quickbooks.ts for the exact
 * mechanism and its citations. Idempotent: every event's id is checked
 * against `quickbooks_webhook_events` before being acted on, so a
 * redelivered notification (Intuit retries on a non-2xx response) is
 * recognized and skipped rather than double-processed.
 *
 * This code is written to be fully correct once QUICKBOOKS_CLIENT_ID/
 * SECRET/WEBHOOK_VERIFIER_TOKEN are configured and a webhook subscription
 * is registered in the Intuit Developer portal — it cannot be exercised
 * against a live Intuit delivery in this environment (no credentials
 * exist here), but the signature-rejection path (missing/invalid header)
 * is fully live and testable today, and is exactly what protects this
 * route in production.
 */
export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const signature = req.headers.get("intuit-signature");

  if (!isWebhookVerificationConfigured()) {
    // No verifier token configured — there is nothing safe to verify
    // against, so every delivery is rejected rather than trusted blindly.
    return NextResponse.json({ error: "QuickBooks webhooks aren't configured." }, { status: 503 });
  }
  if (!verifyIntuitWebhookSignature(rawBody, signature)) {
    return NextResponse.json({ error: "Invalid or missing Intuit-Signature." }, { status: 401 });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Malformed JSON body." }, { status: 400 });
  }

  const events = parseWebhookPayload(payload);
  const connection = await getQuickBooksConnection();

  for (const event of events) {
    const alreadyProcessed = await hasProcessedQuickBooksWebhookEvent(event.eventId);
    if (alreadyProcessed) continue;
    await recordQuickBooksWebhookEvent({ event_id: event.eventId, payload_summary: `${event.entityName} ${event.entityId} — ${event.operation}` });

    if (!connection || connection.realm_id !== event.realmId) continue; // Not this app's active connection.
    if (event.entityName !== "Estimate" && event.entityName !== "Invoice") continue;

    const documents = await listQuickBooksDocuments();
    const match = documents.find((d) => d.entity_type === event.entityName && d.qb_entity_id === event.entityId);
    if (!match) continue; // A QBO change to a document we haven't linked to a job — nothing to update.

    const refreshed = await fetchDocumentById(
      { connection, onTokenRefreshed: (rotated) => updateQuickBooksConnectionTokens(connection.id, rotated) },
      event.entityName,
      event.entityId
    );
    if (refreshed.ok) {
      await updateQuickBooksDocumentStatus(match.id, { status: refreshed.data.status, amount: refreshed.data.amount });
      await logQuickBooksSyncEvent({
        action: "Webhook processed",
        project_id: match.project_id,
        entity_type: event.entityName,
        qb_entity_id: event.entityId,
        document_number: match.document_number,
        success: true,
      });
    } else {
      await logQuickBooksSyncEvent({
        action: "Webhook processed",
        project_id: match.project_id,
        entity_type: event.entityName,
        qb_entity_id: event.entityId,
        document_number: match.document_number,
        success: false,
        error_detail: refreshed.message,
      });
    }
  }

  return NextResponse.json({ received: events.length });
}
