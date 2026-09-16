// Owner's Personal Agenda — Google Calendar sync (Architecture, Not Yet
// Live). Mirrors the exact "architected but not live" pattern used
// elsewhere in this app: lib/routing.ts (real driving directions behind an
// env-var check, null/soft-fail otherwise) and the Email Assistant &
// Invoice Routing feature (see README). No live Google OAuth or Calendar
// API call is made anywhere in this codebase — Google Cloud credentials
// aren't available in this environment, and faking a successful sync would
// be worse than being honest that it isn't connected yet.
//
// See README "Owner's Agenda & Future Google Calendar Sync" for exactly
// what a real integration needs (OAuth app, Calendar API scope,
// refresh-token storage, and how the env vars below get used once set).

export interface SyncResult {
  configured: boolean;
  synced: number;
  message: string;
}

/**
 * Reads the three env vars a real Google Calendar sync would need. All
 * three must be present — a partially-configured environment is treated
 * the same as an unconfigured one, since a client id/secret with no
 * refresh token can't make an authenticated call.
 */
export function isGoogleCalendarConfigured(): boolean {
  return !!(
    process.env.GOOGLE_CALENDAR_CLIENT_ID &&
    process.env.GOOGLE_CALENDAR_CLIENT_SECRET &&
    process.env.GOOGLE_CALENDAR_REFRESH_TOKEN
  );
}

/**
 * Would pull the owner's Google Calendar events into `agenda_events`
 * (upserting by `external_event_id` via lib/db.ts#upsertGoogleAgendaEvent
 * so a re-sync never duplicates a row) and/or push manually-entered events
 * back out. Never throws and never fakes success: with no credentials
 * configured (always true in this environment) it returns immediately with
 * `configured: false` and an honest message. The `ownerUserId` param is
 * threaded through now so the real implementation has everywhere it needs
 * to scope the sync per owner once auth exists.
 */
export async function syncAgendaWithGoogleCalendar(ownerUserId: string): Promise<SyncResult> {
  void ownerUserId; // unused until a real sync is implemented — kept for the future call site's signature
  if (!isGoogleCalendarConfigured()) {
    return {
      configured: false,
      synced: 0,
      message:
        "Google Calendar isn't connected. This requires a Google Cloud OAuth app with the Calendar API enabled, plus GOOGLE_CALENDAR_CLIENT_ID, GOOGLE_CALENDAR_CLIENT_SECRET and GOOGLE_CALENDAR_REFRESH_TOKEN configured — see README \"Owner's Agenda & Future Google Calendar Sync\".",
    };
  }
  // Real implementation would live here once credentials exist: exchange
  // the refresh token for an access token, call events.list on the
  // owner's primary calendar, and upsert each result via
  // lib/db.ts#upsertGoogleAgendaEvent. Intentionally unreachable today.
  return { configured: true, synced: 0, message: "Sync not yet implemented." };
}
