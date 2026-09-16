import Link from "next/link";
import {
  getQuickBooksConnection,
  listClientCompanies,
  listQuickBooksCustomerMappings,
} from "@/lib/db";
import { canManageQuickBooksConnection, canSyncQuickBooks, canViewQuickBooks, canViewQuickBooksSyncLog, getActingUser } from "@/lib/current-user";
import { findCustomerMatchCandidates, isQuickBooksConfigured, isQuickBooksConnected } from "@/lib/quickbooks";
import { updateQuickBooksConnectionTokens } from "@/lib/db";
import type { QuickBooksCustomerCandidate } from "@/lib/types";
import { Card, PageHeader, Button, EmptyState, AlertPill } from "@/components/ui";
import { CustomerMatchRow } from "@/components/quickbooks/CustomerMatchRow";
import { disconnectQuickBooksAction, syncNowAction } from "./actions";
import { getSectionAccessFor } from "@/lib/permissions";
import { AccessDenied } from "@/components/AccessDenied";

const ERROR_MESSAGES: Record<string, string> = {
  not_configured: "QuickBooks isn't configured yet — QUICKBOOKS_CLIENT_ID, QUICKBOOKS_CLIENT_SECRET and QUICKBOOKS_REDIRECT_URI need to be set (see README).",
  invalid_callback: "The QuickBooks connection attempt failed a security check (state mismatch) — please try connecting again.",
  token_exchange_failed: "QuickBooks didn't accept the connection request — please try again, or check the credentials in README.",
  forbidden: "Only Owner/Admin can manage the QuickBooks connection.",
};

export default async function QuickBooksIntegrationPage({ searchParams }: { searchParams: Promise<{ error?: string; connected?: string }> }) {
  const { error, connected } = await searchParams;
  const actingUser = await getActingUser();

  // Two gates apply here (see README "Permissions & Staff Access" for how
  // they relate): the pre-existing access_role tier (canViewQuickBooks —
  // unchanged, still governs connection management specifically) AND the
  // new per-section grant (build 11). Either one denying is a denial.
  const sectionAccess = await getSectionAccessFor(actingUser, "quickbooks");
  if (!canViewQuickBooks(actingUser) || sectionAccess === "none") {
    return (
      <div>
        <PageHeader title="QuickBooks" subtitle="Settings → Integrations" />
        <AccessDenied section="QuickBooks" />
      </div>
    );
  }

  const [connection, clientCompanies, mappings] = await Promise.all([
    getQuickBooksConnection(),
    listClientCompanies(),
    listQuickBooksCustomerMappings(),
  ]);
  const configured = isQuickBooksConfigured();
  const isLive = isQuickBooksConnected(connection);
  const canManageConnection = canManageQuickBooksConnection(actingUser);
  const canSync = canSyncQuickBooks(actingUser);
  const mappedClientIds = new Set(mappings.map((m) => m.client_company_id));
  const unmatchedClients = clientCompanies.filter((c) => !mappedClientIds.has(c.id));

  // Possible matches are only meaningful with a live connection — fetched
  // per client company via the real (disconnected-safe) service layer.
  // See lib/quickbooks.ts findCustomerMatchCandidates().
  const candidatesByClient = new Map<string, QuickBooksCustomerCandidate[]>();
  if (isLive && connection) {
    await Promise.all(
      unmatchedClients.map(async (client) => {
        const result = await findCustomerMatchCandidates(
          { connection, onTokenRefreshed: (rotated) => updateQuickBooksConnectionTokens(connection.id, rotated) },
          client.name
        );
        if (result.ok) candidatesByClient.set(client.id, result.data);
      })
    );
  }

  return (
    <div className="max-w-3xl">
      <PageHeader title="QuickBooks" subtitle="Settings → Integrations — connects accounting (customers, estimates, invoices) to this app's jobs, without duplicating QuickBooks' own job." />

      <div className="mb-4">
        <Link href="/company-setup" className="text-sm text-sky-600 hover:underline">← Back to Company Setup</Link>
      </div>

      {error && <div className="mb-4"><AlertPill tone="bad">{ERROR_MESSAGES[error] ?? "Something went wrong connecting to QuickBooks."}</AlertPill></div>}
      {connected === "1" && !error && <div className="mb-4"><AlertPill>Connected to QuickBooks.</AlertPill></div>}

      <Card className="p-4 mb-6">
        <h2 className="text-sm font-semibold text-slate-900 uppercase tracking-wide mb-3">Connection</h2>

        {!configured && (
          <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-3">
            QuickBooks isn&apos;t configured yet. This requires an Intuit Developer app with QUICKBOOKS_CLIENT_ID, QUICKBOOKS_CLIENT_SECRET,
            QUICKBOOKS_REDIRECT_URI and QUICKBOOKS_ENVIRONMENT set — see README &quot;QuickBooks Online Integration&quot; for exactly what to create and where.
          </p>
        )}

        {!connection && configured && <p className="text-sm text-slate-500 mb-3">Not Connected.</p>}

        {connection && connection.needs_reconnect && (
          <p className="text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2 mb-3">
            QuickBooks Connection Needs Attention — the stored authorization was rejected or has expired. Reconnect to restore syncing.
          </p>
        )}

        {isLive && connection && (
          <div className="grid sm:grid-cols-2 gap-3 text-sm mb-3">
            <div><div className="text-xs text-slate-500 uppercase">Company</div><div>{connection.company_name ?? `Realm ${connection.realm_id}`}</div></div>
            <div><div className="text-xs text-slate-500 uppercase">Environment</div><div className="capitalize">{connection.environment}</div></div>
            <div><div className="text-xs text-slate-500 uppercase">Connected</div><div>{new Date(connection.connected_at).toLocaleString()}</div></div>
            <div><div className="text-xs text-slate-500 uppercase">Last Sync</div><div>{connection.last_sync_at ? new Date(connection.last_sync_at).toLocaleString() : "Never"}</div></div>
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          {(!connection || connection.needs_reconnect || connection.disconnected_at) && canManageConnection && (
            <a href="/api/quickbooks/auth">
              <Button disabled={!configured}>{connection?.needs_reconnect ? "Reconnect" : "Connect QuickBooks"}</Button>
            </a>
          )}
          {(!connection || connection.needs_reconnect || connection.disconnected_at) && !canManageConnection && (
            <span className="text-xs text-slate-400">Only Owner/Admin can connect or manage QuickBooks.</span>
          )}
          {isLive && canSync && (
            <form action={syncNowAction}>
              <Button type="submit" variant="secondary">Sync Now</Button>
            </form>
          )}
          {isLive && canManageConnection && (
            <form action={disconnectQuickBooksAction}>
              <Button type="submit" variant="danger">Disconnect</Button>
            </form>
          )}
        </div>
      </Card>

      {canViewQuickBooksSyncLog(actingUser) && (
        <div className="mb-6">
          <Link href="/company-setup/quickbooks/sync-log" className="text-sm text-sky-600 hover:underline">View Sync Log →</Link>
        </div>
      )}

      <Card className="p-4">
        <h2 className="text-sm font-semibold text-slate-900 uppercase tracking-wide mb-1">Customer Matching</h2>
        <p className="text-xs text-slate-500 mb-3">
          Links each management company to a QuickBooks customer. Possible matches are surfaced by name similarity for a human to confirm — never
          linked automatically.
        </p>

        {!isLive && (
          <p className="text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 mb-3">
            Connect QuickBooks to see live customer matches. The actions below still call the real QuickBooks service layer, which will show a clear
            &quot;not connected&quot; result until then.
          </p>
        )}

        {mappings.length > 0 && (
          <div className="mb-4">
            <div className="text-[11px] font-semibold text-slate-500 uppercase mb-1.5">Already Linked</div>
            <div className="space-y-1">
              {mappings.map((m) => {
                const client = clientCompanies.find((c) => c.id === m.client_company_id);
                return (
                  <div key={m.id} className="flex items-center justify-between text-sm border-b border-slate-100 py-1.5">
                    <span className="text-slate-800">{client?.name ?? m.client_company_id}</span>
                    <span className="text-slate-500">→ {m.qb_customer_name}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {unmatchedClients.length === 0 ? (
          <EmptyState message="Every management company is linked." />
        ) : (
          <div className="space-y-2">
            {unmatchedClients.map((client) => (
              <CustomerMatchRow
                key={client.id}
                clientCompanyId={client.id}
                clientCompanyName={client.name}
                connected={isLive}
                canManage={canSync}
                candidates={candidatesByClient.get(client.id) ?? []}
              />
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
