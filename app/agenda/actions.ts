"use server";

import { revalidatePath } from "next/cache";
import { createAgendaEvent, deleteAgendaEvent } from "@/lib/db";
import { getActingUser } from "@/lib/current-user";
import { syncAgendaWithGoogleCalendar, type SyncResult } from "@/lib/google-calendar";
import type { RelatedRecordType } from "@/lib/types";

export async function createAgendaEventAction(formData: FormData) {
  const title = String(formData.get("title") ?? "").trim();
  const event_date = String(formData.get("event_date") ?? "");
  if (!title || !event_date) return;
  const start_time = String(formData.get("start_time") ?? "") || undefined;
  const end_time = String(formData.get("end_time") ?? "") || undefined;
  const location = String(formData.get("location") ?? "") || undefined;
  const notes = String(formData.get("notes") ?? "") || undefined;
  const related_type = (String(formData.get("related_type") ?? "") || undefined) as RelatedRecordType | undefined;
  const related_id = String(formData.get("related_id") ?? "") || undefined;

  const actingUser = await getActingUser();
  await createAgendaEvent({
    owner_user_id: actingUser.id,
    title,
    event_date,
    start_time,
    end_time,
    location,
    notes,
    related_type: related_id ? related_type : undefined,
    related_id: related_type ? related_id : undefined,
    actorName: actingUser.fullName,
  });
  revalidatePath("/agenda");
}

export async function deleteAgendaEventAction(id: string) {
  const actingUser = await getActingUser();
  await deleteAgendaEvent(id, actingUser.fullName);
  revalidatePath("/agenda");
}

/**
 * Bound to the "Connect Google Calendar" button — always returns
 * `configured: false` in this environment (see lib/google-calendar.ts).
 * Never attempts a real OAuth redirect.
 */
export async function checkGoogleCalendarAction(): Promise<SyncResult> {
  const actingUser = await getActingUser();
  return syncAgendaWithGoogleCalendar(actingUser.id);
}
