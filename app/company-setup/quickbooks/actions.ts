"use server";

import { revalidatePath } from "next/cache";
import {
  createQuickBooksCustomerMapping,
  disconnectQuickBooks,
  getQuickBooksConnection,
  listQuickBooksDocuments,
  logQuickBooksSyncEvent,
  setQuickBooksLastSync,
  updateQuickBooksConnectionTokens,
  updateQuickBooksDocumentStatus,
} from "@/lib/db";
import { getActingUser, canManageQuickBooksConnection, canSyncQuickBooks } from "@/lib/current-user";
import { createQuickBooksCustomer, fetchDocumentById } from "@/lib/quickbooks";

function revalidateQuickBooksViews() {
  revalidatePath("/company-setup/quickbooks");
  revalidatePath("/company-setup/quickbooks/sync-log");
}

export async function disconnectQuickBooksAction() {
  const actingUser = await getActingUser();
  if (!canManageQuickBooksConnection(actingUser)) throw new Error("Only Owner/Admin can manage the QuickBooks connection.");
  const connection = await getQuickBooksConnection();
  if (!connection) return;
  await disconnectQuickBooks(connection.id, actingUser.fullName);
  revalidateQuickBooksViews();
}

/**
 * "Sync Now" — refreshes every linked document's status/amount from
 * QuickBooks. Safe when not connected (each call comes back "not
 * connected" and is logged as such, never thrown). Every meaningful action
 * is logged to BOTH the QuickBooks sync log and the existing activity_log
 * (see lib/db.ts).
 */
export async function syncNowAction() {
  const actingUser = await getActingUser();
  if (!canSyncQuickBooks(actingUser)) throw new Error("You don't have permission to sync QuickBooks.");
  const connection = await getQuickBooksConnection();
  if (!connection) {
    await logQuickBooksSyncEvent({ action: "Sync run", success: false, error_detail: "Not connected.", initiated_by: actingUser.fullName });
    revalidateQuickBooksViews();
    return;
  }
  const documents = await listQuickBooksDocuments();
  let successCount = 0;
  for (const doc of documents.filter((d) => d.qb_realm_id === connection.realm_id)) {
    const refreshed = await fetchDocumentById(
      { connection, onTokenRefreshed: (rotated) => updateQuickBooksConnectionTokens(connection.id, rotated) },
      doc.entity_type,
      doc.qb_entity_id
    );
    if (refreshed.ok) {
      await updateQuickBooksDocumentStatus(doc.id, { status: refreshed.data.status, amount: refreshed.data.amount });
      successCount++;
    }
    await logQuickBooksSyncEvent({
      action: "Sync run",
      project_id: doc.project_id,
      entity_type: doc.entity_type,
      qb_entity_id: doc.qb_entity_id,
      document_number: doc.document_number,
      success: refreshed.ok,
      error_detail: refreshed.ok ? undefined : refreshed.message,
      initiated_by: actingUser.fullName,
    });
  }
  await setQuickBooksLastSync(connection.id, new Date().toISOString());
  if (documents.length === 0) {
    await logQuickBooksSyncEvent({ action: "Sync run", success: true, error_detail: "No linked documents to sync.", initiated_by: actingUser.fullName });
  }
  void successCount;
  revalidatePath("/projects", "layout");
  revalidatePath("/schedule");
  revalidatePath("/schedule/completed");
  revalidateQuickBooksViews();
}

export async function linkQuickBooksCustomerAction(clientCompanyId: string, formData: FormData) {
  const actingUser = await getActingUser();
  if (!canSyncQuickBooks(actingUser)) throw new Error("You don't have permission to link QuickBooks customers.");
  const qbCustomerId = String(formData.get("qb_customer_id") ?? "");
  const qbCustomerName = String(formData.get("qb_customer_name") ?? "");
  if (!qbCustomerId || !qbCustomerName) return;
  await createQuickBooksCustomerMapping({ client_company_id: clientCompanyId, qb_customer_id: qbCustomerId, qb_customer_name: qbCustomerName, linked_by: actingUser.fullName });
  revalidateQuickBooksViews();
}

/** "Create New QuickBooks Customer" — calls the real (unconfigured/
 * disconnected-safe) service layer, which returns a clear "not connected"
 * result rather than pretending to create anything. */
export async function createQuickBooksCustomerAction(clientCompanyId: string, formData: FormData) {
  const actingUser = await getActingUser();
  if (!canSyncQuickBooks(actingUser)) throw new Error("You don't have permission to create QuickBooks customers.");
  const displayName = String(formData.get("display_name") ?? "").trim();
  if (!displayName) return;
  const connection = await getQuickBooksConnection();
  if (!connection) {
    await logQuickBooksSyncEvent({ action: "Customer create attempted", success: false, error_detail: "QuickBooks isn't connected.", initiated_by: actingUser.fullName });
    revalidateQuickBooksViews();
    return;
  }
  const result = await createQuickBooksCustomer(
    { connection, onTokenRefreshed: (rotated) => updateQuickBooksConnectionTokens(connection.id, rotated) },
    displayName
  );
  if (result.ok) {
    await createQuickBooksCustomerMapping({ client_company_id: clientCompanyId, qb_customer_id: result.data.id, qb_customer_name: result.data.name, linked_by: actingUser.fullName });
  } else {
    await logQuickBooksSyncEvent({ action: "Customer create attempted", success: false, error_detail: result.message, initiated_by: actingUser.fullName });
  }
  revalidateQuickBooksViews();
}

