import { Card, PageHeader } from "@/components/ui";
import { NewClientForm } from "@/components/clients/NewClientForm";

export default function NewClientPage() {
  return (
    <div className="max-w-3xl">
      <PageHeader title="New Client" subtitle="Add a property management company, its main contact, and the buildings it manages." />
      <Card className="p-4">
        <NewClientForm />
      </Card>
    </div>
  );
}
