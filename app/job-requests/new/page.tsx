import { listBuildings, listClientCompanies, listContacts } from "@/lib/db";
import { Card, PageHeader, Button } from "@/components/ui";
import { createJobRequestAction } from "../actions";

export default async function NewJobRequestPage({ searchParams }: { searchParams: Promise<{ building?: string }> }) {
  const { building: preselectedBuilding } = await searchParams;
  const [buildings, clients, contacts] = await Promise.all([listBuildings(), listClientCompanies(), listContacts()]);
  const clientById = new Map(clients.map((c) => [c.id, c]));

  return (
    <div className="max-w-xl">
      <PageHeader title="New Job Request" subtitle="Fast entry — pick the building and the rest auto-populates." />
      <Card className="p-4">
        <form action={createJobRequestAction} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-500 uppercase mb-1">Building</label>
            <select name="building_id" defaultValue={preselectedBuilding} required className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
              <option value="">Select a building…</option>
              {buildings.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name} — {clientById.get(b.client_company_id)?.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 uppercase mb-1">Contact (optional)</label>
            <select name="contact_id" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
              <option value="">Select a contact…</option>
              {contacts.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.first_name} {c.last_name} — {c.title}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 uppercase mb-1">Unit / Location</label>
            <input name="unit_number" placeholder="e.g. 4B or Lobby" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 uppercase mb-1">Description of Work</label>
            <textarea name="description" required rows={4} placeholder="What did the manager ask for?" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 uppercase mb-1">Received Via</label>
            <select name="received_via" defaultValue="phone" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
              <option value="phone">Phone</option>
              <option value="email">Email</option>
              <option value="text">Text</option>
              <option value="portal">Vendor Portal</option>
            </select>
          </div>
          <Button type="submit">Create Job Request</Button>
        </form>
      </Card>
    </div>
  );
}
