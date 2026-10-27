"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

/**
 * Catches a crash in the ROOT layout itself — something React's normal
 * per-page error boundaries never see, since the layout wraps them. Rare,
 * but when it happens this is the only thing standing between the user
 * and a blank white screen, so it stays a plain, dependency-free page
 * (no Sidebar/Tailwind component imports — if the layout is what broke,
 * don't risk pulling in whatever broke it) and reports to Sentry if
 * configured (silently does nothing otherwise, same as every other Sentry
 * call site in this app).
 */
export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui, sans-serif", padding: "3rem 1.5rem", textAlign: "center", color: "#1e293b" }}>
        <h1 style={{ fontSize: "1.25rem", fontWeight: 600, marginBottom: "0.5rem" }}>Something went wrong</h1>
        <p style={{ color: "#64748b", marginBottom: "1.5rem" }}>
          The page hit an unexpected error. It&apos;s been reported — try reloading, or go back to the dashboard.
        </p>
        {/* A plain <a>, not next/link or useRouter — the root layout (and
            whatever providers/router context it sets up) is exactly what
            may have just crashed, so this avoids depending on any of it.
            next/link still goes through the app's client-side router,
            which is the thing in question here, so it's the wrong tool
            for this one specific file. */}
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
        <a
          href="/"
          style={{ display: "inline-block", background: "#0284c7", color: "white", borderRadius: "0.5rem", padding: "0.625rem 1.25rem", fontSize: "0.875rem", fontWeight: 500, textDecoration: "none" }}
        >
          Back to Dashboard
        </a>
      </body>
    </html>
  );
}
