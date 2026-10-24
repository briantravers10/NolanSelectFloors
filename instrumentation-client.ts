import * as Sentry from "@sentry/nextjs";
import { scrubSentryEvent } from "@/lib/sentry-scrub";

/**
 * Browser-side Sentry init. Same "no DSN configured → stays silent"
 * convention as instrumentation.ts (server/edge) — Sentry's own SDK
 * already no-ops safely when `dsn` is undefined, so this file is a
 * harmless no-op in every environment until NEXT_PUBLIC_SENTRY_DSN is set.
 */
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NEXT_PUBLIC_VERCEL_ENV ?? "development",
  tracesSampleRate: 0.1,
  // See instrumentation.ts — same scrub, no sendDefaultPii flag in this SDK version.
  beforeSend: scrubSentryEvent,
});

// Tags each error/transaction with which page the user was on when it
// happened (Phase 2 requirement: "record which page or feature").
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
