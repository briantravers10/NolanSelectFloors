"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui";
import { runQaTestsNowAction } from "@/app/qa/actions";

export function RunQaTestsButton() {
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  return (
    <div>
      <Button
        type="button"
        disabled={isPending}
        onClick={() =>
          startTransition(async () => {
            const result = await runQaTestsNowAction();
            setMessage({ ok: result.ok, text: result.message });
          })
        }
      >
        {isPending ? "Starting…" : "▶ Run QA Tests Now"}
      </Button>
      {message && <p className={`text-xs mt-1.5 ${message.ok ? "text-emerald-700" : "text-amber-700"}`}>{message.text}</p>}
    </div>
  );
}
