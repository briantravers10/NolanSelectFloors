"use client";

// "Connect Google Calendar" — explains what a real integration would need
// and checks the (always-absent, in this environment) configuration.
// Deliberately does NOT attempt any real OAuth flow or redirect anywhere —
// see lib/google-calendar.ts and README "Owner's Agenda & Future Google
// Calendar Sync".
import { useState, useTransition } from "react";
import { Button } from "@/components/ui";
import { checkGoogleCalendarAction } from "./actions";
import type { SyncResult } from "@/lib/google-calendar";

export function ConnectGoogleCalendar() {
  const [result, setResult] = useState<SyncResult | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div>
      <p className="text-sm text-slate-600 mb-3">
        Sync this agenda with your Google Calendar so events created here (and there) show up in both places. This
        requires a Google Cloud OAuth app with the Calendar API enabled — see the README for the exact setup.
      </p>
      <Button
        type="button"
        variant="secondary"
        disabled={pending}
        onClick={() => startTransition(async () => setResult(await checkGoogleCalendarAction()))}
      >
        {pending ? "Checking…" : "Connect Google Calendar"}
      </Button>
      {result && (
        <p className={`mt-3 text-sm rounded-lg p-3 ${result.configured ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-900"}`}>
          {result.message}
        </p>
      )}
    </div>
  );
}
