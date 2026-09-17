import { listLeads } from "@/lib/db";
import { PhoneInput } from "@/components/PhoneInput";
import { Card, PageHeader, StatusBadge, Button, PhoneLink, EmailLink, EmptyState } from "@/components/ui";
import { formatCurrency } from "@/lib/calculations";
import { LEAD_STATUSES } from "@/lib/types";
import { addLeadAction, convertLeadAction, setLeadStatusAction } from "./actions";
import { requireSectionAccess } from "@/lib/permissions";
import { AccessDenied } from "@/components/AccessDenied";

export default async function NewBusinessPage() {
  const access = await requireSectionAccess("new_business");
  if (access === "none") return <AccessDenied section="New Business" />;

  const leads = await listLeads();

  return (
    <div>
      <PageHeader title="New Business" subtitle="Secondary pipeline — prospective management companies not yet under contract." />

      <Card className="p-4 mb-5">
        <h2 className="text-sm font-semibold text-slate-900 uppercase tracking-wide mb-3">Add a Lead</h2>
        <form action={addLeadAction} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <input name="company_name" placeholder="Company name" required className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          <input name="contact_name" placeholder="Contact name" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          <PhoneInput name="phone" placeholder="Phone" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          <input name="email" placeholder="Email" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          <input name="source" placeholder="Source (referral, website, etc.)" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          <input name="estimated_value" type="number" placeholder="Estimated annual value $" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          <textarea name="notes" placeholder="Notes" rows={2} className="sm:col-span-2 rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          <div className="sm:col-span-2"><Button type="submit">Add Lead</Button></div>
        </form>
      </Card>

      {leads.length === 0 ? (
        <EmptyState message="No leads yet." />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {leads.map((lead) => (
            <Card key={lead.id} className="p-4">
              <div className="flex items-start justify-between gap-2 mb-1">
                <div className="font-medium text-slate-900">{lead.company_name}</div>
                <StatusBadge status={lead.status} />
              </div>
              <div className="text-sm text-slate-600">{lead.contact_name}</div>
              <div className="flex gap-3 text-sm mt-1">
                <PhoneLink phone={lead.phone} />
                <EmailLink email={lead.email} />
              </div>
              {lead.estimated_value && <div className="text-sm text-slate-700 mt-1">Est. value: {formatCurrency(lead.estimated_value)}</div>}
              {lead.notes && <p className="text-xs text-slate-500 mt-2">{lead.notes}</p>}
              <div className="flex flex-wrap gap-1.5 mt-3">
                {LEAD_STATUSES.filter((s) => s !== lead.status).map((s) => (
                  <form key={s} action={setLeadStatusAction.bind(null, lead.id, s)}>
                    <button type="submit" className="text-[11px] rounded-full border border-slate-300 px-2 py-0.5 text-slate-500 hover:bg-slate-100">{s}</button>
                  </form>
                ))}
              </div>
              {lead.status === "Won" && !lead.converted_client_company_id && (
                <form action={convertLeadAction.bind(null, lead.id)} className="mt-3">
                  <Button type="submit" variant="secondary">Convert to Client</Button>
                </form>
              )}
              {lead.converted_client_company_id && <div className="text-xs text-emerald-600 mt-2">Converted to client company.</div>}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
