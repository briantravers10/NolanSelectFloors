import Link from "next/link";
import { listBuildings, listClientCompanies, listContacts, findOpenDuplicateBids, listProjectsByBuilding } from "@/lib/db";
import { Card, PageHeader, Button, AlertPill } from "@/components/ui";
import { formatJobNumber } from "@/lib/calculations";
import { createJobRequestAction } from "../actions";
import { BuildingSelectWithReminder } from "./BuildingSelectWithReminder";

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

  // "Previous work at this location" — non-intrusive, informational only.
  // Never auto-copies anything into the new job; just a count + most
  // recent job with a link to the full history. DB-filtered on building_id.
  let priorHistory: { count: number; mostRecentName: string; mostRecentJobNumber: number; mostRecentDate: string } | undefined;
  if (defaultBuildingId) {
    const buildingJobs = await listProjectsByBuilding(defaultBuildingId);
    const matching = sp.unit_number ? buildingJobs.filter((p) => (p.unit_number ?? "").trim().toLowerCase() === sp.unit_number!.trim().toLowerCase()) : buildingJobs;
    if (matching.length > 0) {
      const mostRecent = matching[0]; // already newest-first
      priorHistory = { count: matching.length, mostRecentName: mostRecent.name, mostRecentJobNumber: mostRecent.job_number, mostRecentDate: mostRecent.created_at.slice(0, 10) };
    }
  }

  return (
    <div className="max-w-xl">
      <PageHeader title="New Job Request" subtitle="Fast entry — pick the building and the rest auto-populates." />

      {priorHistory && !isDuplicateReturn && (
        <Card className="p-3 mb-4 border-slate-200 bg-slate-50">
          <p className="text-sm text-slate-700">
            Previous work at this location: {priorHistory.count} prior job{priorHistory.count > 1 ? "s" : ""}. Most recent —{" "}
            <span className="font-mono text-xs">{formatJobNumber(priorHistory.mostRecentJobNumber)}</span> {priorHistory.mostRecentName} ({priorHistory.mostRecentDate}).{" "}
            <Link href={`/buildings/${defaultBuildingId}`} className="text-sky-600 hover:underline">
              View Job History →
            </Link>
          </p>
        </Card>
      )}

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
          <BuildingSelectWithReminder
            buildings={buildings.map((b) => ({ id: b.id, label: `${b.name} — ${clientById.get(b.client_company_id)?.name}` }))}
            defaultBuildingId={defaultBuildingId}
          />
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
