/**
 * TEMPORARY — Phase 2 verification only. Deliberately throws so we can
 * confirm a real error reaches Sentry from this branch's preview
 * deployment before trusting the integration. Delete once confirmed.
 */
export async function GET() {
  throw new Error("Sentry verification test — AI bug monitoring Phase 2, safe to ignore/resolve in Sentry");
}
