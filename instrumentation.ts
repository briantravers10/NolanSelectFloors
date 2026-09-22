/**
 * Runs once when the server starts (Next.js instrumentation hook). The
 * office works on New York time, so every Date the server touches —
 * "today" for the schedule, timestamps like "Confirmed at 4:02 PM",
 * week boundaries — is computed in that zone rather than the host's UTC.
 * Vercel reserves the TZ environment variable, so it is set here instead.
 */
export function register() {
  process.env.TZ = "America/New_York";
}
