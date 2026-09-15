import Link from "next/link";
import { listEmailRoutingRules } from "@/lib/db";
import { Card, PageHeader, Button, EmptyState } from "@/components/ui";
import { EMAIL_ROUTING_ACTIONS, EMAIL_ROUTING_BY } from "@/lib/types";
import { createEmailRoutingRuleAction, setEmailRoutingRuleActiveAction } from "../actions";

export default async function EmailRoutingRulesPage() {
  const rules = await listEmailRoutingRules();

  return (
    <div>
      <PageHeader title="Email Routing Rules" subtitle="Configuration for a future Gmail-connected assistant." />

      <div className="flex flex-wrap gap-2 mb-5 border-b border-slate-200 pb-3">
        <Link href="/invoices" className="text-sm font-medium rounded-lg px-3 py-1.5 text-slate-500 hover:bg-slate-100">
          All Invoices
        </Link>
        <Link href="/invoices/rules" className="text-sm font-medium rounded-lg px-3 py-1.5 bg-slate-900 text-white">
          Email Routing Rules
        </Link>
      </div>

      <Card className="p-4 mb-5 border-sky-200 bg-sky-50">
        <p className="text-sm text-sky-900">
          These rules define how a <strong>future Gmail-connected assistant</strong> will automatically route incoming
          emails — detecting invoices and calendar-worthy requests (like site visit scheduling) and filing them by
          supplier or job/address. <strong>Email is not yet connected.</strong> Until it is, invoices are entered
          manually on the Invoices page, and every rule below is a plan for what should happen once it is — see the
          README for the integration architecture.
        </p>
      </Card>

      <Card className="p-4 mb-6">
        <h2 className="text-sm font-semibold text-slate-900 uppercase tracking-wide mb-3">+ New Rule</h2>
        <form action={createEmailRoutingRuleAction} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-slate-500 uppercase mb-1">Keyword</label>
            <input name="keyword" required placeholder="e.g. invoice, site visit, Home Depot Pro" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 uppercase mb-1">Action</label>
            <select name="action_type" defaultValue="Flag For Review" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
              {EMAIL_ROUTING_ACTIONS.map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 uppercase mb-1">Route By</label>
            <select name="route_by" defaultValue="Manual/Case-by-Case" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
              {EMAIL_ROUTING_BY.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-slate-500 uppercase mb-1">Notes</label>
            <input name="notes" placeholder="Optional context for this rule" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          </div>
          <div className="sm:col-span-2">
            <Button type="submit">Add Rule</Button>
          </div>
        </form>
      </Card>

      <Card>
        {rules.length === 0 ? (
          <EmptyState message="No email routing rules configured yet." />
        ) : (
          <div className="divide-y divide-slate-100">
            {rules.map((rule) => (
              <div key={rule.id} className="px-4 py-3 flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-slate-900">&quot;{rule.keyword}&quot;</span>
                    {!rule.active && <span className="text-[10px] font-semibold uppercase text-slate-500 bg-slate-100 rounded-full px-1.5 py-0.5">Inactive</span>}
                  </div>
                  <div className="text-xs text-slate-500">{rule.action_type} · Route by {rule.route_by}</div>
                  {rule.notes && <p className="text-sm text-slate-600 mt-1">{rule.notes}</p>}
                </div>
                <form action={setEmailRoutingRuleActiveAction.bind(null, rule.id, !rule.active)} className="shrink-0">
                  <button type="submit" className="text-xs rounded-full border border-slate-300 px-3 py-1 text-slate-600 hover:bg-slate-100">
                    {rule.active ? "Deactivate" : "Activate"}
                  </button>
                </form>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
