"use client";

import { useEffect } from "react";

/**
 * On a phone the edit form sits below the day's tiles, so tapping Edit on
 * a job would leave you looking at the list. This scrolls the form into
 * view whenever the selected job changes — only on narrow screens, where
 * the form isn't already beside the list.
 */
export function ScrollToFormOnSmallScreens({ targetId, when }: { targetId: string; when: string }) {
  useEffect(() => {
    if (!when) return;
    if (typeof window === "undefined" || window.innerWidth >= 1280) return;
    document.getElementById(targetId)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [targetId, when]);
  return null;
}
