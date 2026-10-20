"use client";

import { useRef } from "react";
import { StatusBadge } from "@/components/ui";
import { updateBugReportAdminAction } from "@/app/support/actions";
import { BUG_REPORT_STATUSES, BUG_REPORT_PRIORITIES, type BugReport } from "@/lib/types";
import { formatDateTime } from "@/lib/dates";

const PRIORITY_CLASSES: Record<string, string> = {
  Low: "bg-slate-100 text-slate-700 border-slate-300",
  Medium: "bg-sky-100 text-sky-700 border-sky-300",
  High: "bg-amber-100 text-amber-800 border-amber-300",
  Urgent: "bg-rose-100 text-rose-800 border-rose-300",
};

/**
 * One editable row on the AI Support dashboard (Phase 4). Status and
 * priority auto-submit on change; notes/PR link need the explicit Save
 * button, so typing doesn't fire a save on every keystroke. All four
 * fields live in one form — see updateBugReportAdminAction.
 */
export function AdminReportRow({ report }: { report: BugReport }) {
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <form ref={formRef} action={updateBugReportAdminAction.bind(null, report.id)} className="rounded-xl border border-slate-200 bg-white p-3.5 space-y-2.5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm text-slate-900 leading-snug whitespace-pre-wrap">{report.description}</p>
          {report.additional_details && <p className="text-xs text-slate-600 mt-1 whitespace-pre-wrap">{report.additional_details}</p>}
        </div>
        <StatusBadge status={report.status} />
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-500">
        <span>
          <span className="font-medium text-slate-700">{report.reported_by_name}</span> · {formatDateTime(report.created_at)}
        </span>
        <span className="font-mono">{report.page_path}</span>
        {report.sentry_event_id && (
          <span className="text-emerald-700" title={`Sentry event ${report.sentry_event_id}`}>
            🔗 error attached
          </span>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <label className="flex items-center gap-1.5 text-xs text-slate-600">
          Status
          <select
            name="status"
            defaultValue={report.status}
            onChange={() => formRef.current?.requestSubmit()}
            className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs"
          >
            {BUG_REPORT_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-1.5 text-xs text-slate-600">
          Priority
          <select
            name="priority"
            defaultValue={report.priority ?? ""}
            onChange={() => formRef.current?.requestSubmit()}
            className={`rounded-md border px-2 py-1 text-xs font-medium ${report.priority ? PRIORITY_CLASSES[report.priority] : "border-slate-300 bg-white text-slate-500"}`}
          >
            <option value="">Not set</option>
            {BUG_REPORT_PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div>
        <label className="block text-[11px] font-semibold text-slate-600 mb-1">Investigation notes / proposed fix</label>
        <textarea
          name="admin_notes"
          defaultValue={report.admin_notes ?? ""}
          rows={2}
          placeholder="What's the likely cause? What's the plan?"
          className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-xs"
        />
      </div>

      <div className="flex flex-wrap items-end gap-2">
        <div className="flex-1 min-w-[200px]">
          <label className="block text-[11px] font-semibold text-slate-600 mb-1">GitHub PR link</label>
          <input
            type="url"
            name="github_pr_url"
            defaultValue={report.github_pr_url ?? ""}
            placeholder="https://github.com/…/pull/123"
            className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-xs"
          />
        </div>
        <button type="submit" className="rounded-md bg-slate-800 text-white px-3 py-1.5 text-xs font-medium hover:bg-slate-900">
          Save
        </button>
        {report.github_pr_url && (
          <a href={report.github_pr_url} target="_blank" rel="noreferrer" className="text-xs text-sky-600 hover:underline">
            Open PR →
          </a>
        )}
      </div>
    </form>
  );
}
