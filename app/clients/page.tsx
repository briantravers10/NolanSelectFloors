import Link from "next/link";
import { listBuildings, listClientCompanies, listContacts, listProjects } from "@/lib/db";
import { Card, PageHeader, PhoneLink, EmailLink, LinkButton } from "@/components/ui";
import { Icon } from "@/components/Icon";
import { isActiveProjectStage } from "@/lib/calculations";

export default async function ClientsPage() {
  const [clients, buildings, contacts, projects] = await Promise.all([
    listClientCompanies(),
    listBuildings(),
    listContacts(),
    listProjects(),
  ]);

  const rows = clients.map((c) => {
    const clientBuildings = buildings.filter((b) => b.client_company_id === c.id);
    const buildingIds = new Set(clientBuildings.map((b) => b.id));
    const clientContacts = contacts.filter((ct) => ct.client_company_id === c.id);
    const clientProjects = projects.filter((p) => buildingIds.has(p.building_id));
    const activeProjects = clientProjects.filter(isActiveProjectStage);
    return { client: c, buildingCount: clientBuildings.length, contactCount: clientContacts.length, projectCount: clientProjects.length, activeCount: activeProjects.length };
  });

  return (
    <div>
      <PageHeader
        title="Clients"
        subtitle="Property management companies you do recurring work for."
        action={<LinkButton href="/clients/new"><Icon name="plus" className="w-4 h-4" />New Client</LinkButton>}
      />
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-slate-500 uppercase tracking-wide border-b border-slate-200">
                <th className="px-4 py-3">Management Company</th>
                <th className="px-4 py-3">Phone</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3 text-center">Buildings</th>
                <th className="px-4 py-3 text-center">Contacts</th>
                <th className="px-4 py-3 text-center">Active Jobs</th>
                <th className="px-4 py-3 text-center">Total Jobs</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ client, buildingCount, contactCount, projectCount, activeCount }) => (
                <tr key={client.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <Link href={`/clients/${client.id}`} className="font-medium text-slate-900 hover:text-sky-600">
                      {client.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3"><PhoneLink phone={client.phone} /></td>
                  <td className="px-4 py-3"><EmailLink email={client.email} /></td>
                  <td className="px-4 py-3 text-center">{buildingCount}</td>
                  <td className="px-4 py-3 text-center">{contactCount}</td>
                  <td className="px-4 py-3 text-center">{activeCount}</td>
                  <td className="px-4 py-3 text-center">{projectCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
