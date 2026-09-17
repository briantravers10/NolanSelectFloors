import { notFound } from "next/navigation";
import { PhoneInput } from "@/components/PhoneInput";
import Link from "next/link";
import { listBuildingContacts, listBuildings, listClientCompanies, listContacts } from "@/lib/db";
import { Card, PageHeader, Button, EmptyState } from "@/components/ui";
import { saveContactAction } from "./actions";

export default async function ContactDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [contacts, clients, buildingContacts, buildings] = await Promise.all([
    listContacts(),
    listClientCompanies(),
    listBuildingContacts(),
    listBuildings(),
  ]);
  const contact = contacts.find((c) => c.id === id);
  if (!contact) notFound();
  const client = clients.find((c) => c.id === contact.client_company_id);
  const managedBuildingIds = buildingContacts.filter((bc) => bc.contact_id === id).map((bc) => bc.building_id);
  const managedBuildings = buildings.filter((b) => managedBuildingIds.includes(b.id));
  const action = saveContactAction.bind(null, id);

  return (
    <div className="max-w-2xl">
      <PageHeader title={`${contact.first_name} ${contact.last_name}`} subtitle={client ? `${contact.title} at ${client.name}` : contact.title} />

      <Card className="p-4 mb-5">
        <form action={action} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="First Name" name="first_name" defaultValue={contact.first_name} />
          <Field label="Last Name" name="last_name" defaultValue={contact.last_name} />
          <Field label="Title / Role" name="title" defaultValue={contact.title} />
          <div>
            <label className="block text-xs font-medium text-slate-500 uppercase mb-1">Phone</label>
            <PhoneInput name="phone" defaultValue={contact.phone} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 uppercase mb-1">Mobile</label>
            <PhoneInput name="mobile_phone" defaultValue={contact.mobile_phone} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          </div>
          <Field label="Email" name="email" defaultValue={contact.email} />
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-slate-500 uppercase mb-1">Notes</label>
            <textarea name="notes" defaultValue={contact.notes} rows={3} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          </div>
          <div className="sm:col-span-2">
            <Button type="submit">Save Contact</Button>
          </div>
        </form>
      </Card>

      <Card className="p-4">
        <h2 className="text-sm font-semibold text-slate-900 uppercase tracking-wide mb-3">Buildings Managed</h2>
        {managedBuildings.length === 0 ? (
          <EmptyState message="No buildings linked to this contact yet." />
        ) : (
          <div className="space-y-1.5">
            {managedBuildings.map((b) => (
              <Link key={b.id} href={`/buildings/${b.id}`} className="block text-sm text-sky-700 hover:underline">
                {b.name} — {b.address}, {b.city}
              </Link>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

function Field({ label, name, defaultValue }: { label: string; name: string; defaultValue?: string }) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-500 uppercase mb-1">{label}</label>
      <input name={name} defaultValue={defaultValue} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
    </div>
  );
}
