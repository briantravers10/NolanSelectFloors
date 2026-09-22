import Link from "next/link";
import { notFound } from "next/navigation";
import { getProject } from "@/lib/db";
import { getActingUser, canManageQuickBooksDocuments } from "@/lib/current-user";
import { Card, PageHeader, Button, EmptyState } from "@/components/ui";
import { formatJobNumber } from "@/lib/calculations";
import { linkExistingQuickBooksDocumentAction } from "../actions";

/** "Link Existing QuickBooks Estimate/Invoice" — structurally builds the
 * search/select UI; the service layer call it submits to
 * (fetchDocumentById) returns a clear "not connected" result until a real
 * QuickBooks connection exists. Duplicate-mapping protection is enforced
 * in lib/db.ts#createQuickBooksDocument before this succeeds. */
export default async function LinkQuickBooksDocumentPage({
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
    return <EmptyState message="You don't have permission to link QuickBooks documents." />;
  }
  const project = await getProject(id);
  if (!project) notFound();

  return (
    <div className="max-w-lg">
      <PageHeader title="Link Existing QuickBooks Document" subtitle={`Job ${formatJobNumber(project.job_number)}: ${project.name}`} />
      <div className="mb-4"><Link href={`/projects/${id}`} className="text-sm text-sky-600 hover:underline">← Back to job</Link></div>

      <Card className="p-4">
        {error && <p className="text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2 mb-3">{error}</p>}
        <form action={linkExistingQuickBooksDocumentAction.bind(null, id)} className="space-y-3">
          <div>
            <label className="block text-xs text-slate-500 uppercase mb-1">Document Type</label>
            <select name="entity_type" className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm">
              <option value="Estimate">Estimate</option>
              <option value="Invoice">Invoice</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-slate-500 uppercase mb-1">QuickBooks Estimate/Invoice ID</label>
            <input name="qb_entity_id" required placeholder="e.g. 142" className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm" />
            <p className="text-xs text-slate-400 mt-1">
              The internal QuickBooks record ID (not the document number shown to customers) — found in the QuickBooks Online transaction&apos;s own
              detail page/URL once connected.
            </p>
          </div>
          <Button type="submit">Look Up &amp; Link</Button>
        </form>
      </Card>
    </div>
  );
}
