"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { usePathname } from "next/navigation";
import { Icon } from "@/components/Icon";
import { StatusBadge } from "@/components/ui";
import { submitBugReportAction, listMyBugReportsAction } from "@/app/support/actions";
import { getLastSentryEventId } from "@/lib/sentry-scrub";
import { formatDateTime } from "@/lib/dates";
import type { BugReport } from "@/lib/types";

/**
 * "Report a Problem" (AI bug monitoring & support, Phase 3 — see
 * docs/ai-bug-support/architecture-notes.md). Floating panel, same
 * always-on-screen pattern as AssistantPanel.tsx, opposite corner so the
 * two never overlap. Captures who's reporting (getActingUser, server-side)
 * and what page they were on (usePathname, client-side) automatically —
 * the employee only has to type what went wrong.
 */
export function ReportProblemPanel() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [description, setDescription] = useState("");
  const [showDetails, setShowDetails] = useState(false);
  const [additionalDetails, setAdditionalDetails] = useState("");
  const [reports, setReports] = useState<BugReport[] | null>(null);
  const [justSubmitted, setJustSubmitted] = useState(false);
  const [isPending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<string>).detail;
      setOpen(detail !== "close");
    };
    window.addEventListener("nsf:report-problem", handler);
    return () => window.removeEventListener("nsf:report-problem", handler);
  }, []);

  useEffect(() => {
    if (!open) return;
    startTransition(async () => {
      try {
        setReports(await listMyBugReportsAction());
      } catch {
        setReports([]);
      }
    });
    // Re-fetches every time it's opened, not just once — so a report an
    // admin updated status on (Phase 4) shows current, not stale.
  }, [open, justSubmitted]);

  if (!open) return null;

  const lastEventId = getLastSentryEventId();

  return (
    <div
      className="fixed z-40 bottom-20 md:bottom-5 left-2 md:left-5 w-[calc(100vw-1rem)] sm:w-[380px] max-h-[75vh] flex flex-col rounded-2xl border border-slate-300 bg-white shadow-2xl"
      role="dialog"
      aria-label="Report a Problem"
    >
      <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-slate-200 bg-rose-900 text-white rounded-t-2xl">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Icon name="alert" className="w-4 h-4 text-rose-300" />
          Report a Problem
        </div>
        <button type="button" onClick={() => setOpen(false)} className="p-1 text-rose-200 hover:text-white" aria-label="Close">
          <Icon name="close" className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3 text-sm">
        <form
          ref={formRef}
          action={(formData) => {
            startTransition(async () => {
              await submitBugReportAction(formData);
              setDescription("");
              setAdditionalDetails("");
              setShowDetails(false);
              setJustSubmitted((j) => !j);
              formRef.current?.reset();
            });
          }}
          className="space-y-2"
        >
          <input type="hidden" name="page_path" value={pathname} />
          {lastEventId && <input type="hidden" name="sentry_event_id" value={lastEventId} />}
          <label className="block text-xs font-semibold text-slate-700">What happened?</label>
          <textarea
            name="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            required
            placeholder={'e.g. "I moved an employee to another job, but the schedule didn\'t update."'}
            className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm"
          />
          <p className="text-[11px] text-slate-500">
            Reporting from <span className="font-mono text-slate-700">{pathname}</span>
            {lastEventId && <span className="text-emerald-700"> · error details attached</span>}
          </p>

          {showDetails ? (
            <textarea
              name="additional_details"
              value={additionalDetails}
              onChange={(e) => setAdditionalDetails(e.target.value)}
              rows={2}
              placeholder="Anything else — what you expected, steps to reproduce, who else saw it…"
              className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm"
            />
          ) : (
            <button type="button" onClick={() => setShowDetails(true)} className="text-xs text-sky-600 hover:underline">
              + Add more details
            </button>
          )}

          <button
            type="submit"
            disabled={isPending || !description.trim()}
            className="w-full rounded-lg bg-rose-700 text-white px-3 py-2 text-sm font-medium hover:bg-rose-800 disabled:opacity-50"
          >
            {isPending ? "Sending…" : "Send Report"}
          </button>
        </form>

        <div className="border-t border-slate-200 pt-2">
          <div className="text-xs font-semibold text-slate-700 mb-1.5">Your reports</div>
          {reports === null ? (
            <p className="text-xs text-slate-400">Loading…</p>
          ) : reports.length === 0 ? (
            <p className="text-xs text-slate-400">Nothing reported yet.</p>
          ) : (
            <ul className="space-y-1.5">
              {reports.map((r) => (
                <li key={r.id} className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-xs text-slate-800 leading-snug line-clamp-2">{r.description}</p>
                    <StatusBadge status={r.status} />
                  </div>
                  <p className="text-[10px] text-slate-500 mt-1">{r.page_path} · {formatDateTime(r.created_at)}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
