"use client";

import { useState } from "react";
import { Button } from "@/components/ui";
import { Icon } from "@/components/Icon";

export function SendScheduleButton({ message }: { message: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)}>
        <Icon name="mail" className="w-4 h-4" /> Send Schedule (Preview)
      </Button>
      {open && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={() => setOpen(false)}>
          <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-lg p-5" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-slate-900">Night-Before Schedule — Preview</h3>
              <button onClick={() => setOpen(false)} className="p-1 text-slate-400"><Icon name="close" className="w-5 h-5" /></button>
            </div>
            <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-3">
              Preview only — no message is actually sent. Twilio SMS integration is architected but not wired up yet (see README).
            </p>
            <pre className="whitespace-pre-wrap text-sm bg-slate-50 border border-slate-200 rounded-lg p-3 text-slate-700 font-sans max-h-80 overflow-y-auto">{message}</pre>
            <div className="mt-4 flex justify-end">
              <Button onClick={() => setOpen(false)}>Close</Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
