import Link from "next/link";
import { notFound } from "next/navigation";
import {
  listBuildingContacts,
  listBuildings,
  listClientCompanies,
  listContacts,
  listJobRequests,
  listProjects,
} from "@/lib/db";
import { Card, PageHeader, PhoneLink, StatusBadge, EmptyState } from "@/components/ui";
import { formatCurrency } from "@/lib/calculations";
import type { Building } from "@/lib/types";

const FIELD_LABELS: { key: keyof Building; label: string }[] = [
  { key: "access_instructions", label: "Access Instructions" },
  { key: "working_hours", label: "Working Hours" },
  { key: "coi_requirements", label: "COI Requirements" },
  { key: "parking_loading", label: "Parking / Loading" },
  { key: "elevator_info", label: "Elevator Info" },
  { key: "delivery_instructions", label: "Delivery Instructions" },
  { key: "building_rules", label: "Building Rules" },
  { key: "notes", label: "Notes" },
];

export default async function BuildingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [buildings, clients, contacts, buildingContacts, projects, jobRequests] = await Promise.all([
    listBuildings(),
    listClientCompanies(),
    listContacts(),
    listBuildingContacts(),
    listProjects(),
    listJobRequests(),
  ]);
  const building = buildings.find((b) => b.id === id);
  if (!building) notFound();

  const client = clients.find((c) => c.id === building.client_company_id);
  const contactLinks = buildingContacts.filter((bc) => bc.building_id === id);
  const buildingContactPeople = contactLinks
    .map((bc) => ({ link: bc, contact: contacts.find((c) => c.id === bc.contact_id) }))
    .filter((x) => x.contact);

  const buildingProjects = projects.filter((p) => p.building_id === id).sort((a, b) => (b.start_date ?? "").localeCompare(a.start_date ?? ""));
  const activeStatuses = new Set(["Approved", "Pre-Construction", "Materials Required", "Materials Ordered", "Materials Ready", "Ready to Schedule", "Scheduled", "In Progress", "Paused", "Punch List"]);
  const activeProjects = buildingProjects.filter((p) => activeStatuses.has(p.status));
  const pastProjects = buildingProjects.filter((p) => !activeStatuses.has(p.status));
  const buildingJobRequests = jobRequests.filter((j) => j.building_id === id);

  return (
    <div>
      <PageHeader
        title={building.name}
        subtitle={`${building.address}, ${building.city}, ${building.state} ${building.zip}`}
        action={
          client && (
            <Link href={`/clients/${client.id}`} className="text-sm text-sky-600 hover:underline">
              {client.name} →
            </Link>
          )
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 space-y-5">
          <Card className="p-4">
            <h2 className="text-sm font-semibold text-slate-900 uppercase tracking-wide mb-3">Building Profile</h2>
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-sm">
              <div>
                <dt className="text-xs text-slate-500 uppercase">Superintendent</dt>
                <dd className="text-slate-800">{building.superintendent_name ?? "—"}</dd>
                <dd><PhoneLink phone={building.superintendent_phone} className="text-xs" /></dd>
              </div>
              {FIELD_LABELS.map(({ key, label }) => (
                <div key={key}>
                  <dt className="text-xs text-slate-500 uppercase">{label}</dt>
                  <dd className="text-slate-800">{(building[key] as string) || "—"}</dd>
                </div>
              ))}
            </dl>
          </Card>

          <Card className="p-4">
            <h2 className="text-sm font-semibold text-slate-900 uppercase tracking-wide mb-3">Current / Upcoming Projects</h2>
            {activeProjects.length === 0 ? (
              <EmptyState message="No active projects at this building." />
            ) : (
              <div className="divide-y divide-slate-100">
                {activeProjects.map((p) => (
                  <Link key={p.id} href={`/projects/${p.id}`} className="flex items-center justify-between py-2.5 hover:bg-slate-50 -mx-1 px-1 rounded">
                    <div>
                      <div className="text-sm font-medium text-slate-800">{p.unit_number ? `Unit ${p.unit_number}` : p.name}</div>
                      <div className="text-xs text-slate-500">{p.name}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm text-slate-700">{formatCurrency(p.project_value)}</div>
                      <StatusBadge status={p.status} />
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </Card>

          <Card className="p-4">
            <h2 className="text-sm font-semibold text-slate-900 uppercase tracking-wide mb-3">Job History</h2>
            {pastProjects.length === 0 ? (
              <EmptyState message="No completed job history yet." />
            ) : (
              <div className="divide-y divide-slate-100">
                {pastProjects.map((p) => (
                  <Link key={p.id} href={`/projects/${p.id}`} className="flex items-center justify-between py-2.5 hover:bg-slate-50 -mx-1 px-1 rounded">
                    <div>
                      <div className="text-sm font-medium text-slate-800">{p.unit_number ? `Unit ${p.unit_number}` : p.name}</div>
                      <div className="text-xs text-slate-500">{p.name}</div>
                    </div>
                    <StatusBadge status={p.status} />
                  </Link>
                ))}
              </div>
            )}
          </Card>

          <Card className="p-4">
            <h2 className="text-sm font-semibold text-slate-900 uppercase tracking-wide mb-3">Job Requests</h2>
            {buildingJobRequests.length === 0 ? (
              <EmptyState message="No job requests recorded." />
            ) : (
              <div className="divide-y divide-slate-100">
                {buildingJobRequests.map((jr) => (
                  <Link key={jr.id} href={`/job-requests/${jr.id}`} className="flex items-center justify-between py-2.5 hover:bg-slate-50 -mx-1 px-1 rounded gap-3">
                    <div className="text-sm text-slate-800 truncate">{jr.description}</div>
                    <StatusBadge status={jr.status} />
                  </Link>
                ))}
              </div>
            )}
          </Card>
        </div>

        <Card className="p-4 h-fit">
          <h2 className="text-sm font-semibold text-slate-900 uppercase tracking-wide mb-3">Contacts</h2>
          {buildingContactPeople.length === 0 ? (
            <EmptyState message="No contacts linked yet." />
          ) : (
            <div className="space-y-3">
              {buildingContactPeople.map(({ link, contact }) => (
                <Link key={link.id} href={`/contacts/${contact!.id}`} className="block border border-slate-100 rounded-lg p-2.5 hover:border-sky-200">
                  <div className="font-medium text-sm text-slate-800">{contact!.first_name} {contact!.last_name}</div>
                  <div className="text-xs text-slate-500 mb-1">{link.role}{link.is_primary ? " · Primary" : ""}</div>
                  <PhoneLink phone={contact!.phone} className="text-xs" />
                </Link>
              ))}
            </div>
          )}
          <Link href={`/job-requests/new?building=${building.id}`} className="mt-4 block text-center text-sm bg-sky-600 text-white rounded-lg py-2 font-medium hover:bg-sky-700">
            + New Job Request
          </Link>
        </Card>
      </div>
    </div>
  );
}
