"use server";

import { revalidatePath } from "next/cache";
import { createBugReport, listBugReports, listBugReportsForUser, updateBugReport } from "@/lib/db";
import { getActingUser } from "@/lib/current-user";
import { isOwnerActingUser } from "@/lib/permissions";
import { BUG_REPORT_STATUSES, BUG_REPORT_PRIORITIES, type BugReport } from "@/lib/types";

/**
 * "Report a Problem" (Phase 3 of the AI bug monitoring/support system —
 * see docs/ai-bug-support/architecture-notes.md). Anyone signed in can
 * submit one — no section permission gate, since any employee hitting a
 * bug should be able to report it regardless of what else they have
 * access to. Admin triage (status/priority/notes) is Phase 4.
 */
export async function submitBugReportAction(formData: FormData) {
  const description = String(formData.get("description") ?? "").trim();
  const pagePath = String(formData.get("page_path") ?? "").trim() || "unknown";
  const additionalDetails = String(formData.get("additional_details") ?? "").trim();
  const sentryEventId = String(formData.get("sentry_event_id") ?? "").trim();
  if (!description) return;

  const actingUser = await getActingUser();
  await createBugReport({
    reported_by_user_id: actingUser.id,
    reported_by_name: actingUser.fullName,
    page_path: pagePath,
    description,
    additional_details: additionalDetails || undefined,
    sentry_event_id: sentryEventId || undefined,
  });
  // No dedicated page reads bug reports yet (Phase 4 admin dashboard will),
  // so nothing to revalidate besides wherever this was submitted from —
  // the panel re-fetches its own "Your reports" list client-side instead.
  revalidatePath("/");
}

/** The current user's own recent reports + status, for the Report a
 * Problem panel's "Your reports" list — called directly from the client
 * component (not a <form action>), same as any server action can be. */
export async function listMyBugReportsAction(): Promise<BugReport[]> {
  const actingUser = await getActingUser();
  return (await listBugReportsForUser(actingUser.id)).slice(0, 10);
}

/**
 * Admin triage from the "AI Support" dashboard (Phase 4) — status,
 * priority, investigation notes, and a linked GitHub PR once a fix
 * exists. Owner/Admin only; silently no-ops for anyone else (the page
 * itself is already gated the same way, so this is a second check, not
 * the only one — never trust a hidden nav link as the real boundary).
 */
export async function updateBugReportAdminAction(id: string, formData: FormData) {
  const actingUser = await getActingUser();
  if (!(await isOwnerActingUser(actingUser))) return;

  const statusRaw = String(formData.get("status") ?? "");
  const priorityRaw = String(formData.get("priority") ?? "");
  const patch: Parameters<typeof updateBugReport>[1] = {
    admin_notes: String(formData.get("admin_notes") ?? "").trim() || undefined,
    github_pr_url: String(formData.get("github_pr_url") ?? "").trim() || undefined,
  };
  if ((BUG_REPORT_STATUSES as readonly string[]).includes(statusRaw)) patch.status = statusRaw as (typeof BUG_REPORT_STATUSES)[number];
  if ((BUG_REPORT_PRIORITIES as readonly string[]).includes(priorityRaw)) patch.priority = priorityRaw as (typeof BUG_REPORT_PRIORITIES)[number];

  await updateBugReport(id, patch, actingUser.fullName);
  revalidatePath("/ai-support");
}

/**
 * "Investigate with AI" (Phase 5 — see
 * docs/ai-bug-support/phase-5-claude-investigation-workflow.md). This is
 * the trigger point, not the workflow itself: no GitHub credential is
 * configured, so there's nothing here that reads code, writes a fix, or
 * opens a PR. It moves the report to Investigating and records a
 * timestamped, attributed note — both in admin_notes (visible on the
 * dashboard immediately) and in Change History (logActivity, inside
 * updateBugReport) — so every investigation request has an audit trail
 * from day one, per the "secure credentials, limited permissions and
 * audit logs" requirement, well before the automated half of this exists.
 */
export async function requestAiInvestigationAction(id: string) {
  const actingUser = await getActingUser();
  if (!(await isOwnerActingUser(actingUser))) return;

  const report = (await listBugReports()).find((r) => r.id === id);
  if (!report) return;
  const note = `[${new Date().toISOString()}] AI investigation requested by ${actingUser.fullName}. Automated investigation isn't wired up yet (Phase 5 infrastructure only) — see docs/ai-bug-support/phase-5-claude-investigation-workflow.md for what's needed to go live.`;
  const admin_notes = [report.admin_notes, note].filter(Boolean).join("\n\n");

  await updateBugReport(id, { status: "Investigating", admin_notes }, actingUser.fullName);
  revalidatePath("/ai-support");
}
