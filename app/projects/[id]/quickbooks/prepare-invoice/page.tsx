import Link from "next/link";
import { notFound } from "next/navigation";
import { getProject, listBuildings, listClientCompanies } from "@/lib/db";
import { getActingUser, canManageQuickBooksDocuments } from "@/lib/current-user";
import { Card, PageHeader, EmptyState } from "@/components/ui";
import { DocumentReviewForm } from "@/components/quickbooks/DocumentReviewForm";
import { createQuickBooksDocumentAction, getResolvedQBCustomerId } from "../actions";

export default async function PrepareInvoicePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const { error } = await searchParams;
  const actingUser = await getActingUser();
  if (!canManageQuickBooksDocuments(actingUser)) {
    return <EmptyState message="You don't have permission to prepare QuickBooks invoices." />;
  }

  const [project, buildings, clients, qbCustomerId] = await Promise.all([
    getProject(id),
    listBuildings(),
    listClientCompanies(),
    getResolvedQBCustomerId(id),
  ]);
  if (!project) notFound();
  const building = buildings.find((b) => b.id === project.building_id);
  const client = building ? clients.find((c) => c.id === building.client_company_id) : undefined;

  return (
    <div className="max-w-2xl">
      <PageHeader title="Prepare QuickBooks Invoice" subtitle="Review before anything is created — sending the invoice happens inside QuickBooks itself, never from here." />
      <div className="mb-4"><Link href={`/projects/${id}`} className="text-sm text-sky-600 hover:underline">← Back to job</Link></div>

      {!qbCustomerId && (
        <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-4">
          {client?.name ?? "This job's management company"} isn&apos;t linked to a QuickBooks customer yet — link it from{" "}
          <Link href="/company-setup/quickbooks" className="underline">Settings → Integrations → QuickBooks</Link> first, or continue and the create
          step will show a clear error.
        </p>
      )}

      <Card className="p-4">
        <DocumentReviewForm
          entityType="Invoice"
          customerName={client?.name ?? "—"}
          jobName={project.name}
          initialLineItems={[{ description: project.name, quantity: 1, rate: project.project_value, amount: project.project_value }]}
          action={createQuickBooksDocumentAction.bind(null, id, "Invoice")}
          errorMessage={error}
        />
      </Card>
    </div>
  );
}
