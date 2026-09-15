import { Card, PageHeader, Button } from "@/components/ui";
import { STAFF_CAPABILITIES } from "@/lib/types";
import { createStaffAction } from "../actions";

export default function NewStaffPage() {
  return (
    <div className="max-w-xl">
      <PageHeader title="New Staff" subtitle="Add a crew member." />
      <Card className="p-4">
        <form action={createStaffAction} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-500 uppercase mb-1">First Name</label>
              <input name="first_name" required className="input" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 uppercase mb-1">Last Name</label>
              <input name="last_name" required className="input" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 uppercase mb-1">Job Title</label>
            <input name="title" placeholder="e.g. Installer, Sander, Foreman" className="input" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-500 uppercase mb-1">Phone</label>
              <input name="phone" className="input" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 uppercase mb-1">Email</label>
              <input name="email" type="email" className="input" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-500 uppercase mb-1">Day Rate ($)</label>
              <input name="day_rate" type="number" step="0.01" defaultValue={0} className="input" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 uppercase mb-1">Hire Date</label>
              <input name="hire_date" type="date" className="input" />
            </div>
          </div>
          <div className="flex items-center gap-6">
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" name="is_driver" className="rounded border-slate-300" /> Driver
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" name="active" defaultChecked className="rounded border-slate-300" /> Active
            </label>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 uppercase mb-2">Capabilities</label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
              {STAFF_CAPABILITIES.map((cap) => (
                <label key={cap} className="flex items-center gap-1.5 text-sm text-slate-700">
                  <input type="checkbox" name="capabilities" value={cap} className="rounded border-slate-300" />
                  {cap}
                </label>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 uppercase mb-1">Notes</label>
            <textarea name="notes" rows={3} className="input" />
          </div>
          <Button type="submit">Create Staff Member</Button>
        </form>
      </Card>
    </div>
  );
}
