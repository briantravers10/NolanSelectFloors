/**
 * The dedicated, read-only "QA monitor" identity used by the production
 * monitoring job (see qa/README.md "Production monitoring"). Pure
 * functions, no imports — called from the Edge middleware
 * (lib/supabase/middleware.ts), so this file must stay free of Node-only
 * or server-only dependencies.
 *
 * Identified by email (QA_MONITOR_EMAIL env var) rather than a new column
 * or role so no schema or permission-grid change is needed. The identity
 * is ALSO locked down independently by the app's own permission layers
 * (a view-only office_users row with is_owner=false — every mutating
 * server action re-checks canEdit() and refuses), so an unset env var
 * degrades to "a normal view-only user", never to "a user who can
 * write". The env var adds the hard stop below on top of that.
 */

/** Methods that can never mutate anything in this app. Everything else —
 * including POST, which is how every Server Action and form submit
 * arrives — is refused for the monitor before any app code runs. */
const READ_ONLY_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

export function isQaMonitorEmail(email: string | null | undefined, configured: string | undefined = process.env.QA_MONITOR_EMAIL): boolean {
  if (!email || !configured) return false;
  return email.trim().toLowerCase() === configured.trim().toLowerCase();
}

/** True when a request from the QA monitor's session must be refused. */
export function isBlockedQaMonitorRequest(method: string, email: string | null | undefined, configured?: string): boolean {
  return isQaMonitorEmail(email, configured) && !READ_ONLY_METHODS.has(method.toUpperCase());
}
