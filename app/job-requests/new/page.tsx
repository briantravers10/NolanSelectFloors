import Link from "next/link";
import { listBuildings, listClientCompanies, listContacts, findOpenDuplicateBids } from "@/lib/db";
import { Card, PageHeader, Button, AlertPill } from "@/components/ui";
import { createJobRequestAction } from "../actions";

export default async function NewJobRequestPage({
  searchParams,
}: {
  searchParams: Promise<{
    building?: string;
    dup?: string;
    building_id?: string;
    contact_id?: string;
    unit_number?: string;
    description?: string;
    received_via?: string;
  }>;
}) {
  const sp = await searchParams;
  const [buildings, clients, contacts] = await Promise.all([listBuildings(), listClientCompanies(), listContacts()]);
  const clientById = new Map(clients.map((c) => [c.id, c]));
  const buildingById = new Map(buildings.map((b) => [b.id, b]));

  const isDuplicateReturn = sp.dup === "1" && !!sp.building_id;
  const duplicates = isDuplicateReturn ? await findOpenDuplicateBids(sp.building_id!, sp.unit_number) : [];

  const defaultBuildingId = sp.building_id ?? sp.building;

  return (
    <div className="max-w-xl">
      <PageHeader title="New Job Request" subtitle="Fast entry — pick the building and the rest auto-populates." />

      {isDuplicateReturn && duplicates.length > 0 && (
        <Card className="p-4 mb-4 border-amber-300 bg-amber-50">
          <div className="mb-2"><AlertPill>Possible duplicate bid</AlertPill></div>
          <p className="text-sm text-amber-900 mb-2">
            {duplicates.length} existing open record{duplicates.length > 1 ? "s" : ""} already match this building + unit:
          </p>
          <ul className="text-sm text-amber-900 space-y-1 mb-2">
            {duplicates.map((m) => (
              <li key={`${m.type}-${m.id}`}>
                {buildingById.get(m.buildingId)?.name ?? "Building"}
                {m.unitNumber ? ` — ${m.unitNumber}` : ""} · {m.status}
                {m.estimatorName ? ` · claimed by ${m.estimatorName}` : ""} ·{" "}
                <Link href={m.type === "project" ? `/projects/${m.id}` : `/job-requests/${m.id}`} className="underline">
                  Open existing record →
                </Link>
              </li>
            ))}
          </ul>
          <p className="text-xs text-amber-800">
            If this is genuinely a different job, give a reason below and click &quot;Create Anyway&quot; — the override is
            logged to the activity feed.
          </p>
        </Card>
      )}

      <Card className="p-4">
        <form action={createJobRequestAction} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-500 uppercase mb-1">Building</label>
            <select name="building_id" defaultValue={defaultBuildingId} required className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
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
            <select name="contact_id" defaultValue={sp.contact_id} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
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
            <input name="unit_number" defaultValue={sp.unit_number} placeholder="e.g. 4B or Lobby" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 uppercase mb-1">Description of Work</label>
            <textarea name="description" defaultValue={sp.description} required rows={4} placeholder="What did the manager ask for?" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 uppercase mb-1">Received Via</label>
            <select name="received_via" defaultValue={sp.received_via ?? "phone"} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
              <option value="phone">Phone</option>
              <option value="email">Email</option>
              <option value="text">Text</option>
              <option value="portal">Vendor Portal</option>
            </select>
          </div>

          {isDuplicateReturn && duplicates.length > 0 && (
            <>
              <input type="hidden" name="confirm_duplicate" value="1" />
              <div>
                <label className="block text-xs font-medium text-amber-700 uppercase mb-1">Reason for creating anyway (required)</label>
                <input
                  name="duplicate_reason"
                  required
                  placeholder="Why is this a separate job?"
                  className="w-full rounded-lg border border-amber-300 px-3 py-2 text-sm"
                />
              </div>
              <Button type="submit" variant="danger">Create Anyway</Button>
            </>
          )}
          {!(isDuplicateReturn && duplicates.length > 0) && <Button type="submit">Create Job Request</Button>}
        </form>
      </Card>
    </div>
  );
}
