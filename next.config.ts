import type { NextConfig } from "next";

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

export default nextConfig;
