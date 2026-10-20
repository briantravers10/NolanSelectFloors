/**
 * Sentry PII/financial-data scrubbing — belt-and-braces on top of
 * `sendDefaultPii: false` in every Sentry.init() call. That flag stops the
 * SDK's own auto-collected IP/user data; this additionally strips known
 * sensitive FIELD NAMES from whatever extra context/breadcrumbs get
 * attached deliberately later (e.g. a bug report's page state), so a pay
 * rate, a project value, or a token never leaves the app even by
 * accident. Used as the `beforeSend`/`beforeBreadcrumb` hook in both
 * instrumentation.ts (server/edge) and instrumentation-client.ts (browser).
 */
const SENSITIVE_KEY_PATTERN =
  /(password|secret|token|api[_-]?key|service_role|dsn|auth|session|cookie|ssn|ein|ach|routing_number|account_number|daily_rate|hourly_rate|day_rate|pay_rate|project_value|invoiced|assignment_cost|rate_amount|credit_card|card_number)/i;

function scrubValue(value: unknown, depth = 0): unknown {
  if (depth > 6 || value === null || value === undefined) return value;
  if (Array.isArray(value)) return value.map((v) => scrubValue(v, depth + 1));
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      out[key] = SENSITIVE_KEY_PATTERN.test(key) ? "[redacted]" : scrubValue(val, depth + 1);
    }
    return out;
  }
  return value;
}

/** Sentry event `beforeSend` hook — scrubs `extra`, `contexts`, and request data. */
export function scrubSentryEvent<T extends { extra?: unknown; contexts?: unknown; request?: { data?: unknown; cookies?: unknown; headers?: unknown } }>(
  event: T
): T {
  if (event.extra) event.extra = scrubValue(event.extra) as T["extra"];
  if (event.contexts) event.contexts = scrubValue(event.contexts) as T["contexts"];
  if (event.request) {
    if (event.request.data) event.request.data = scrubValue(event.request.data);
    // Cookies/headers can carry session tokens — never send them at all.
    delete event.request.cookies;
    delete event.request.headers;
  }
  return event;
}
