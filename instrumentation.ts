import * as Sentry from "@sentry/nextjs";
import { scrubSentryEvent } from "@/lib/sentry-scrub";

/**
 * Runs once when the server starts (Next.js instrumentation hook). The
 * office works on New York time, so every Date the server touches —
 * "today" for the schedule, timestamps like "Confirmed at 4:02 PM",
 * week boundaries — is computed in that zone rather than the host's UTC.
 * Vercel reserves the TZ environment variable, so it is set here instead.
 *
 * Also initializes Sentry (server + edge runtimes) when configured — same
 * "silently does nothing until set up" convention as the AI Assistant's
 * ANTHROPIC_API_KEY and the Supabase dual-mode data layer: no
 * NEXT_PUBLIC_SENTRY_DSN means this is a no-op, so an environment without
 * Sentry configured (every environment today) behaves exactly as before.
 */
export async function register() {
  process.env.TZ = "America/New_York";

  if (!process.env.NEXT_PUBLIC_SENTRY_DSN) return;

  const options: Sentry.NodeOptions = {
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    environment: process.env.VERCEL_ENV ?? "development",
    tracesSampleRate: 0.1,
    // The installed SDK version has no sendDefaultPii flag to disable —
    // this scrub is the active protection: strips request cookies/headers
    // outright and redacts any sensitive-looking field name (pay rates,
    // tokens, etc.) from whatever IS sent. See lib/sentry-scrub.ts.
    beforeSend: scrubSentryEvent,
  };

  if (process.env.NEXT_RUNTIME === "nodejs") Sentry.init(options);
  if (process.env.NEXT_RUNTIME === "edge") Sentry.init(options);
}

// Captures errors thrown inside Server Components / Route Handlers that
// Next.js's own error boundaries don't see — records the request path
// (so we know which page/feature) alongside the error automatically.
export const onRequestError = Sentry.captureRequestError;
