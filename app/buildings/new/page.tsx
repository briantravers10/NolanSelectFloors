import { listClientCompanies, listContacts } from "@/lib/db";
import { Card, PageHeader } from "@/components/ui";
import { NewBuildingForm } from "@/components/buildings/NewBuildingForm";

export default async function NewBuildingPage() {
  const [clients, contacts] = await Promise.all([listClientCompanies(), listContacts()]);
  return (
    <div className="max-w-2xl">
      <PageHeader title="New Building" subtitle="Add a building/property to a management company's portfolio." />
      <Card className="p-4">
        <NewBuildingForm clients={clients} contacts={contacts} />
      </Card>
    </div>
  );
}
