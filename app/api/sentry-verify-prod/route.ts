/**
 * TEMPORARY — one-time verification that Sentry is actually receiving
 * errors now that it's turned on for production. Deliberately throws.
 * Deleted immediately after confirming in Sentry Issues.
 */
export async function GET() {
  throw new Error("Sentry verification test — production activation, safe to ignore/resolve in Sentry");
}
