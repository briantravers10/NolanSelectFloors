import { Card, PageHeader, Button } from "@/components/ui";
import { createClientAction } from "../actions";

export default function NewClientPage() {
  return (
    <div className="max-w-xl">
      <PageHeader title="New Client" subtitle="Add a property management company." />
      <Card className="p-4">
        <form action={createClientAction} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-500 uppercase mb-1">Company Name</label>
            <input name="name" required className="input" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-500 uppercase mb-1">Main Phone</label>
              <input name="phone" className="input" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 uppercase mb-1">Main Email</label>
              <input name="email" type="email" className="input" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 uppercase mb-1">Office / Billing Address</label>
            <input name="address" className="input" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 uppercase mb-1">Website</label>
            <input name="website" placeholder="https://…" className="input" />
          </div>
          <div className="border-t border-slate-200 pt-4">
            <div className="text-xs font-semibold text-slate-500 uppercase mb-2">Accounts Payable Contact</div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <input name="ap_contact_name" placeholder="Name" className="input" />
              <input name="ap_contact_phone" placeholder="Phone" className="input" />
              <input name="ap_contact_email" placeholder="Email" type="email" className="input" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-500 uppercase mb-1">Relationship Start Date</label>
              <input name="relationship_start_date" type="date" className="input" />
            </div>
            <label className="flex items-center gap-2 text-sm text-slate-700 pt-6">
              <input type="checkbox" name="active" defaultChecked className="rounded border-slate-300" /> Active
            </label>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 uppercase mb-1">Billing Notes</label>
            <textarea name="billing_notes" rows={2} className="input" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 uppercase mb-1">Notes</label>
            <textarea name="notes" rows={3} className="input" />
          </div>
          <Button type="submit">Create Client</Button>
        </form>
      </Card>
    </div>
  );
}
