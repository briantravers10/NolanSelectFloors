"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  createQuickBooksDocument,
  getProject,
  getQuickBooksConnection,
  getQuickBooksCustomerMappingForClient,
  listBuildings,
  logQuickBooksSyncEvent,
  updateQuickBooksConnectionTokens,
} from "@/lib/db";
import { getActingUser, canManageQuickBooksDocuments } from "@/lib/current-user";
import { createEstimate, createInvoice, fetchDocumentById } from "@/lib/quickbooks";
import type { QuickBooksEntityType, QuickBooksLineItem } from "@/lib/types";

function revalidateProject(projectId: string) {
  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/schedule");
  revalidatePath("/schedule/completed");
}

async function resolveQBCustomerId(projectId: string): Promise<string | undefined> {
  const project = await getProject(projectId);
  if (!project) return undefined;
  const buildings = await listBuildings();
  const building = buildings.find((b) => b.id === project.building_id);
  if (!building) return undefined;
  const mapping = await getQuickBooksCustomerMappingForClient(building.client_company_id);
  return mapping?.qb_customer_id;
}

/**
 * "Create Estimate/Invoice in QuickBooks" — called ONLY from the review
 * screen the user has already confirmed (app/projects/[id]/quickbooks/
 * prepare-estimate or prepare-invoice). Never called automatically. Safe
 * when QuickBooks isn't connected: the service layer returns a clear
 * "not connected" result, which is surfaced back on the review page rather
 * than silently succeeding.
 */
export async function createQuickBooksDocumentAction(projectId: string, entityType: QuickBooksEntityType, formData: FormData) {
  const actingUser = await getActingUser();
  if (!canManageQuickBooksDocuments(actingUser)) throw new Error("You don't have permission to create QuickBooks documents.");

  const lineItems = JSON.parse(String(formData.get("line_items") ?? "[]")) as QuickBooksLineItem[];
  const connection = await getQuickBooksConnection();
  const qbCustomerId = await resolveQBCustomerId(projectId);

  const backHref = `/projects/${projectId}/quickbooks/prepare-${entityType.toLowerCase()}`;

  if (!connection) {
    redirect(`${backHref}?error=${encodeURIComponent("QuickBooks isn't connected.")}`);
  }
  if (!qbCustomerId) {
    redirect(`${backHref}?error=${encodeURIComponent("This job's management company isn't linked to a QuickBooks customer yet — link it from Settings → Integrations → QuickBooks first.")}`);
  }

  const ctx = { connection, onTokenRefreshed: (rotated: Parameters<typeof updateQuickBooksConnectionTokens>[1]) => updateQuickBooksConnectionTokens(connection.id, rotated) };
  const result = entityType === "Estimate" ? await createEstimate(ctx, { qbCustomerId, lineItems }) : await createInvoice(ctx, { qbCustomerId, lineItems });

  if (!result.ok) {
    await logQuickBooksSyncEvent({ action: `${entityType} create attempted`, project_id: projectId, entity_type: entityType, success: false, error_detail: result.message, initiated_by: actingUser.fullName });
    redirect(`${backHref}?error=${encodeURIComponent(result.message)}`);
  }

  await createQuickBooksDocument({
    project_id: projectId,
    qb_realm_id: connection.realm_id,
    entity_type: entityType,
    qb_entity_id: result.data.qb_entity_id,
    document_number: result.data.document_number,
    status: result.data.status,
    amount: result.data.amount,
    qb_customer_id: qbCustomerId,
    actorName: actingUser.fullName,
  });
  revalidateProject(projectId);
  redirect(`/projects/${projectId}`);
}

/** "Link Existing QuickBooks Estimate/Invoice" — confirms the id is real
 * (fetches it) before mapping it, with duplicate-mapping protection via
 * lib/db.ts#createQuickBooksDocument's pre-insert check (backed by the
 * migration's unique index). */
export async function linkExistingQuickBooksDocumentAction(projectId: string, formData: FormData) {
  const actingUser = await getActingUser();
  if (!canManageQuickBooksDocuments(actingUser)) throw new Error("You don't have permission to link QuickBooks documents.");

  const entityType = String(formData.get("entity_type") ?? "") as QuickBooksEntityType;
  const qbEntityId = String(formData.get("qb_entity_id") ?? "").trim();
  const backHref = `/projects/${projectId}/quickbooks/link`;
  if (!qbEntityId || (entityType !== "Estimate" && entityType !== "Invoice")) {
    redirect(`${backHref}?error=${encodeURIComponent("Enter a QuickBooks Estimate or Invoice ID.")}`);
  }

  const connection = await getQuickBooksConnection();
  if (!connection) {
    redirect(`${backHref}?error=${encodeURIComponent("QuickBooks isn't connected.")}`);
  }
  const qbCustomerId = await resolveQBCustomerId(projectId);
  if (!qbCustomerId) {
    redirect(`${backHref}?error=${encodeURIComponent("This job's management company isn't linked to a QuickBooks customer yet.")}`);
  }

  const result = await fetchDocumentById(
    { connection, onTokenRefreshed: (rotated) => updateQuickBooksConnectionTokens(connection.id, rotated) },
    entityType,
    qbEntityId
  );
  if (!result.ok) {
    redirect(`${backHref}?error=${encodeURIComponent(result.message)}`);
  }

  try {
    await createQuickBooksDocument({
      project_id: projectId,
      qb_realm_id: connection.realm_id,
      entity_type: entityType,
      qb_entity_id: result.data.qb_entity_id,
      document_number: result.data.document_number,
      status: result.data.status,
      amount: result.data.amount,
      qb_customer_id: qbCustomerId,
      actorName: actingUser.fullName,
    });
  } catch (err) {
    redirect(`${backHref}?error=${encodeURIComponent(err instanceof Error ? err.message : "Could not link this document.")}`);
  }
  revalidateProject(projectId);
  redirect(`/projects/${projectId}`);
}

// Used by the review pages to check whether a customer mapping exists
// before letting the form render as usable.
export async function getResolvedQBCustomerId(projectId: string) {
  return resolveQBCustomerId(projectId);
}
