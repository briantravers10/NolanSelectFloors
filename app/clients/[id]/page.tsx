import Link from "next/link";
import { notFound } from "next/navigation";
import { listBuildingContacts, listBuildings, listClientCompanies, listContacts, listJobRequests, listProjects } from "@/lib/db";
import { Card, PageHeader, PhoneLink, EmailLink, StatusBadge, EmptyState, Stat } from "@/components/ui";
import { formatDateLong } from "@/lib/dates";
import { canEdit } from "@/lib/permissions";
import { formatCurrency, isActiveProjectStage } from "@/lib/calculations";

export default async function ClientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [clients, buildings, contacts, buildingContacts, projects, jobRequests] = await Promise.all([
    listClientCompanies(),
    listBuildings(),
    listContacts(),
    listBuildingContacts(),
    listProjects(),
    listJobRequests(),
  ]);
  const client = clients.find((c) => c.id === id);
  if (!client) notFound();
  const canEditClients = await canEdit("clients");

  const clientBuildings = buildings.filter((b) => b.client_company_id === id);
  const buildingIds = new Set(clientBuildings.map((b) => b.id));
  const clientContacts = contacts.filter((c) => c.client_company_id === id);
  const clientProjects = projects.filter((p) => buildingIds.has(p.building_id)).sort((a, b) => (b.start_date ?? "").localeCompare(a.start_date ?? ""));
  const clientJobRequests = jobRequests.filter((j) => buildingIds.has(j.building_id));

  const activeProjects = clientProjects.filter(isActiveProjectStage);
  const previousProjects = clientProjects.filter((p) => !isActiveProjectStage(p));
  const thisYear = new Date().getFullYear();
  const jobsThisYear = clientProjects.filter((p) => p.start_date && new Date(p.start_date).getFullYear() === thisYear).length;
  const lastJobReceived = clientJobRequests.slice().sort((a, b) => (b.received_at < a.received_at ? -1 : 1))[0];
  const buildingById = new Map(buildings.map((b) => [b.id, b]));
  const contactById = new Map(contacts.map((c) => [c.id, c]));
  const mainContact = client.main_contact_id ? contactById.get(client.main_contact_id) : undefined;

  // Point of contact per building — primary contact first, falling back to
  // whichever contact is linked, so it's visible right here without an
  // extra click into the building page (see AGENTS.md Task 1).
  function primaryContactFor(buildingId: string) {
    const links = buildingContacts.filter((bc) => bc.building_id === buildingId);
    const primary = links.find((l) => l.is_primary) ?? links[0];
    return primary ? contactById.get(primary.contact_id) : undefined;
  }

  return (
    <div>
      <PageHeader
        title={client.name}
        subtitle={client.address}
        action={
          <div className="flex items-center gap-3 text-sm">
            <PhoneLink phone={client.phone} />
            <EmailLink email={client.email} />
            {canEditClients && (
              <Link href={`/clients/${id}/edit`} className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50">
                Edit Client
              </Link>
            )}
          </div>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <Stat label="Buildings" value={clientBuildings.length} />
        <Stat label="Jobs This Year" value={jobsThisYear} />
        <Stat label="Total Job History" value={clientProjects.length} />
        <Stat label="Last Job Received" value={lastJobReceived ? formatDateLong(lastJobReceived.received_at.slice(0, 10)) : "—"} />
      </div>

      <Card className="p-4 mb-5">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
          <div>
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Main Point of Contact</div>
            {mainContact ? (
              <>
                <div className="font-medium text-slate-800">{mainContact.first_name} {mainContact.last_name}</div>
                {mainContact.title && <div className="text-xs text-slate-500">{mainContact.title}</div>}
                <PhoneLink phone={mainContact.phone} className="text-xs" />
                <div><EmailLink email={mainContact.email} className="text-xs" /></div>
              </>
            ) : (
              <div className="text-slate-400">Not set</div>
            )}
          </div>
          <div>
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Accounts Payable</div>
            {client.ap_contact_name || client.ap_contact_phone || client.ap_contact_email ? (
              <>
                <div className="font-medium text-slate-800">{client.ap_contact_name}</div>
                <PhoneLink phone={client.ap_contact_phone} className="text-xs" />
                <div><EmailLink email={client.ap_contact_email} className="text-xs" /></div>
              </>
            ) : (
              <div className="text-slate-400">Not set</div>
            )}
          </div>
          <div>
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Relationship</div>
            <div className="text-slate-800">Since {client.relationship_start_date ? formatDateLong(client.relationship_start_date) : "—"}</div>
            <div className="text-xs text-slate-500">{client.active === false ? "Inactive" : "Active"}</div>
            {client.billing_notes && <div className="text-xs text-slate-600 mt-1"><span className="font-medium">Billing:</span> {client.billing_notes}</div>}
          </div>
        </div>
      </Card>

      {client.notes && (
        <Card className="p-4 mb-5">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Notes</div>
          <p className="text-sm text-slate-700">{client.notes}</p>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 space-y-5">
          <Card className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-slate-900 uppercase tracking-wide">Active / Upcoming Jobs</h2>
            </div>
            {activeProjects.length === 0 ? (
              <EmptyState message="No active jobs for this client." />
            ) : (
              <div className="divide-y divide-slate-100">
                {activeProjects.map((p) => (
                  <Link key={p.id} href={`/projects/${p.id}`} className="flex items-center justify-between py-2.5 hover:bg-slate-50 -mx-1 px-1 rounded">
                    <div>
                      <div className="text-sm font-medium text-slate-800">{buildingById.get(p.building_id)?.name} {p.unit_number && `— Unit ${p.unit_number}`}</div>
                      <div className="text-xs text-slate-500">{p.name}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm text-slate-700">{formatCurrency(p.project_value)}</div>
                      <StatusBadge status={p.pipeline_stage} />
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </Card>

          <Card className="p-4">
            <h2 className="text-sm font-semibold text-slate-900 uppercase tracking-wide mb-3">Job History</h2>
            {previousProjects.length === 0 ? (
              <EmptyState message="No completed job history yet." />
            ) : (
              <div className="divide-y divide-slate-100">
                {previousProjects.map((p) => (
                  <Link key={p.id} href={`/projects/${p.id}`} className="flex items-center justify-between py-2.5 hover:bg-slate-50 -mx-1 px-1 rounded">
                    <div>
                      <div className="text-sm font-medium text-slate-800">{buildingById.get(p.building_id)?.name} {p.unit_number && `— Unit ${p.unit_number}`}</div>
                      <div className="text-xs text-slate-500">{p.name}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm text-slate-700">{formatCurrency(p.project_value)}</div>
                      <StatusBadge status={p.pipeline_stage} />
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </Card>

          <Card className="p-4">
            <h2 className="text-sm font-semibold text-slate-900 uppercase tracking-wide mb-3">Job Requests</h2>
            {clientJobRequests.length === 0 ? (
              <EmptyState message="No job requests recorded." />
            ) : (
              <div className="divide-y divide-slate-100">
                {clientJobRequests.map((jr) => (
                  <Link key={jr.id} href={`/job-requests/${jr.id}`} className="flex items-center justify-between py-2.5 hover:bg-slate-50 -mx-1 px-1 rounded gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-slate-800 truncate">{buildingById.get(jr.building_id)?.name} {jr.unit_number && `— ${jr.unit_number}`}</div>
                      <div className="text-xs text-slate-500 truncate">{jr.description}</div>
                    </div>
                    <StatusBadge status={jr.status} />
                  </Link>
                ))}
              </div>
            )}
          </Card>
        </div>

        <Card className="p-4 h-fit">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-slate-900 uppercase tracking-wide">Contacts</h2>
          </div>
          <div className="space-y-3">
            {clientContacts.map((c) => (
              <div key={c.id} className="border border-slate-100 rounded-lg p-2.5">
                <div className="font-medium text-sm text-slate-800">{c.first_name} {c.last_name}</div>
                <div className="text-xs text-slate-500 mb-1">{c.title}</div>
                <PhoneLink phone={c.phone} className="text-xs" />
                <div><EmailLink email={c.email} className="text-xs" /></div>
              </div>
            ))}
          </div>
          <h2 className="text-sm font-semibold text-slate-900 uppercase tracking-wide mt-5 mb-3">Buildings</h2>
          <div className="space-y-2">
            {clientBuildings.map((b) => {
              const poc = primaryContactFor(b.id);
              return (
                <Link key={b.id} href={`/buildings/${b.id}`} className="block border border-slate-100 rounded-lg p-2.5 hover:border-sky-200">
                  <div className="text-sm text-sky-700 font-medium">{b.name}</div>
                  {poc ? (
                    <div className="text-xs text-slate-500 mt-0.5">
                      POC: {poc.first_name} {poc.last_name}{poc.title ? ` (${poc.title})` : ""}
                    </div>
                  ) : (
                    <div className="text-xs text-slate-400 mt-0.5">No point of contact linked.</div>
                  )}
                </Link>
              );
            })}
          </div>
        </Card>
      </div>
    </div>
  );
}
