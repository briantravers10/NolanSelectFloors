import { notFound } from "next/navigation";
import { listBuildingContacts, listBuildings, listClientCompanies, listContacts } from "@/lib/db";
import { Card, PageHeader } from "@/components/ui";
import { NewClientForm } from "@/components/clients/NewClientForm";
import type { ClientFormInitial } from "@/components/clients/NewClientForm";

/** Same form as New Client, prefilled from what's saved — add or change
 * what you need and save, no starting over. */
export default async function EditClientPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [clients, buildings, contacts, links] = await Promise.all([listClientCompanies(), listBuildings(), listContacts(), listBuildingContacts()]);
  const client = clients.find((c) => c.id === id);
  if (!client) notFound();

  const contactById = new Map(contacts.map((c) => [c.id, c]));
  const main = client.main_contact_id ? contactById.get(client.main_contact_id) : undefined;

  const initial: ClientFormInitial = {
    name: client.name,
    phone: client.phone ?? "",
    email: client.email ?? "",
    address: client.address ?? "",
    main_contact_id: main?.id,
    main_contact_name: main ? `${main.first_name} ${main.last_name}`.trim() : "",
    main_contact_title: main?.title ?? "",
    main_contact_phone: main?.phone ?? "",
    main_contact_email: main?.email ?? "",
    ap_contact_name: client.ap_contact_name ?? "",
    ap_contact_phone: client.ap_contact_phone ?? "",
    ap_contact_email: client.ap_contact_email ?? "",
    relationship_start_date: client.relationship_start_date ?? "",
    active: client.active !== false,
    billing_notes: client.billing_notes ?? "",
    notes: client.notes ?? "",
    buildings: buildings
      .filter((b) => b.client_company_id === id && b.active)
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((b) => {
        const rows = links
          .filter((l) => l.building_id === b.id)
          .sort((x, y) => (y.is_primary ? 1 : 0) - (x.is_primary ? 1 : 0));
        return {
          id: b.id,
          name: b.name,
          address: b.address,
          city: b.city,
          state: b.state,
          zip: b.zip,
          region: b.region,
          latitude: b.latitude ?? null,
          longitude: b.longitude ?? null,
          contacts: rows
            .map((l) => contactById.get(l.contact_id))
            .filter((c): c is NonNullable<typeof c> => Boolean(c))
            .map((c) => ({ id: c.id, name: `${c.first_name} ${c.last_name}`.trim(), title: c.title ?? "", phone: c.phone ?? "", email: c.email ?? "" })),
        };
      }),
  };

  return (
    <div className="max-w-3xl">
      <PageHeader title={`Edit ${client.name}`} subtitle="Everything already saved is filled in — change or add what you need, then save." />
      <Card className="p-4">
        <NewClientForm clientId={id} initial={initial} />
      </Card>
    </div>
  );
}
