import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs/config";

const nextConfig: NextConfig = {
  // Sidebar "needs attention" badges (lib/nav-badges.ts) are computed fresh
  // on every server render, but the client-side Router Cache normally reuses
  // a recently-visited route's cached RSC payload for a while instead of
  // re-requesting it — so opening a section (clearing its badge) then
  // navigating back to a page you were just on could still show the old
  // count until that cache entry expired. Disabling it for dynamic routes
  // (this whole app, since every page reads the acting user/session) means
  // every navigation always re-renders the layout against current data.
  experimental: {
    staleTimes: {
      dynamic: 0,
    },
  },
};

// Only wraps the build with Sentry's plugin (source-map upload etc.) when
// a build-time auth token is actually configured — without one (every
// environment today, including this preview branch) the build is exactly
// what it was before Sentry was added, byte for byte.
export default process.env.SENTRY_AUTH_TOKEN
  ? withSentryConfig(nextConfig, {
      org: "travers-group-llc",
      project: process.env.SENTRY_PROJECT ?? "nolan-select-floors",
      authToken: process.env.SENTRY_AUTH_TOKEN,
      silent: true,
      widenClientFileUpload: true,
      webpack: { automaticVercelMonitors: false },
    })
  : nextConfig;
