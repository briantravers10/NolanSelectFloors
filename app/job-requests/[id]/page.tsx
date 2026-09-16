import { notFound } from "next/navigation";
import Link from "next/link";
import {
  listBuildings,
  listClientCompanies,
  listContacts,
  listJobRequests,
  listMaterialRateItems,
  listOfficeUsers,
  listPricingFormulaComponents,
  listPricingFormulas,
  listProjects,
} from "@/lib/db";
import { Card, PageHeader, StatusBadge, PhoneLink, Button } from "@/components/ui";
import { BidOwnership } from "@/components/BidOwnership";
import { EstimateCalculator } from "@/components/EstimateCalculator";
import { getActingUser } from "@/lib/current-user";
import { formatDateLong } from "@/lib/dates";
import { formatCurrency } from "@/lib/calculations";
import { getLastWorkedWithClient } from "@/lib/last-worked";
import { JOB_REQUEST_STATUSES } from "@/lib/types";
import { convertToProjectAction, createBidAction, saveJobRequestEstimateAction, setJobRequestStatusAction } from "../actions";

const BIDDABLE_STATUSES = new Set(["New Request", "Site Visit Required", "Site Visit Scheduled", "Estimate Required"]);

export default async function JobRequestDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [jobRequests, buildings, clients, contacts, projects, officeUsers, actingUser, pricingFormulas, formulaComponents, materialRateItems] = await Promise.all([
    listJobRequests(),
    listBuildings(),
    listClientCompanies(),
    listContacts(),
    listProjects(),
    listOfficeUsers(),
    getActingUser(),
    listPricingFormulas(),
    listPricingFormulaComponents(),
    listMaterialRateItems(),
  ]);
  const activeFormulas = pricingFormulas.filter((f) => f.active);
  const jr = jobRequests.find((j) => j.id === id);
  if (!jr) notFound();
  const building = buildings.find((b) => b.id === jr.building_id);
  const client = building ? clients.find((c) => c.id === building.client_company_id) : undefined;
  const contact = contacts.find((c) => c.id === jr.contact_id);
  const linkedProject = jr.converted_project_id ? projects.find((p) => p.id === jr.converted_project_id) : undefined;
  const lastWorked = client ? await getLastWorkedWithClient(client.id, jr.converted_project_id) : undefined;

  return (
    <div className="max-w-3xl">
      <PageHeader
        title={`${building?.name ?? "Building"}${jr.unit_number ? " — " + jr.unit_number : ""}`}
        subtitle={client?.name}
        action={<StatusBadge status={jr.status} />}
      />

      {lastWorked && (
        <Card className={`p-3 mb-5 text-sm ${lastWorked.hasPrior ? "bg-sky-50 border-sky-200 text-sky-800" : "bg-slate-50 text-slate-500"}`}>
          {lastWorked.label}
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="md:col-span-2 space-y-5">
          <Card className="p-4">
            <h2 className="text-sm font-semibold text-slate-900 uppercase tracking-wide mb-2">Description</h2>
            <p className="text-sm text-slate-700">{jr.description}</p>
            <div className="grid grid-cols-2 gap-4 mt-4 text-sm">
              <div>
                <div className="text-xs text-slate-500 uppercase">Received</div>
                <div>{formatDateLong(jr.received_at.slice(0, 10))} via {jr.received_via}</div>
              </div>
              {jr.site_visit_date && (
                <div>
                  <div className="text-xs text-slate-500 uppercase">Site Visit</div>
                  <div>{formatDateLong(jr.site_visit_date)}</div>
                </div>
              )}
              {jr.estimate_amount != null && (
                <div>
                  <div className="text-xs text-slate-500 uppercase">Estimate</div>
                  <div>{formatCurrency(jr.estimate_amount)}</div>
                </div>
              )}
              {jr.approved_at && (
                <div>
                  <div className="text-xs text-slate-500 uppercase">Approved</div>
                  <div>{formatDateLong(jr.approved_at.slice(0, 10))}</div>
                </div>
              )}
            </div>
            {jr.notes && <p className="text-sm text-slate-600 mt-3 italic">{jr.notes}</p>}
          </Card>

          <Card className="p-4">
            <h2 className="text-sm font-semibold text-slate-900 uppercase tracking-wide mb-3">Estimate Calculator</h2>
            <EstimateCalculator
              formulas={activeFormulas}
              components={formulaComponents}
              materialRateItems={materialRateItems}
              onSave={saveJobRequestEstimateAction.bind(null, jr.id)}
              saveLabel="Save as Estimated Value"
              currentValue={jr.estimated_value}
              currentValueLabel="Saved calculator estimate"
            />
          </Card>

          <Card className="p-4">
            <h2 className="text-sm font-semibold text-slate-900 uppercase tracking-wide mb-3">Move to Status</h2>
            <div className="flex flex-wrap gap-2">
              {JOB_REQUEST_STATUSES.filter((s) => s !== jr.status && s !== "Converted to Project").map((s) => (
                <form key={s} action={setJobRequestStatusAction.bind(null, jr.id, s)}>
                  <button type="submit" className="text-xs rounded-full border border-slate-300 px-3 py-1 text-slate-600 hover:bg-slate-100">
                    {s}
                  </button>
                </form>
              ))}
            </div>
          </Card>

          {linkedProject ? (
            <BidOwnership project={linkedProject} officeUsers={officeUsers} actingUser={actingUser} />
          ) : (
            jr.status !== "Converted to Project" &&
            jr.status !== "Declined" &&
            jr.status !== "Cancelled" && (
              <Card className="p-4 space-y-4">
                {BIDDABLE_STATUSES.has(jr.status) && (
                  <div>
                    <h2 className="text-sm font-semibold text-slate-900 uppercase tracking-wide mb-2">Create Bid</h2>
                    <p className="text-sm text-slate-500 mb-3">
                      Starts a project row in the &quot;Project Bid&quot; pipeline stage, unclaimed, so an estimator can
                      claim it from the Bid Dashboard and work the estimate.
                    </p>
                    <form action={createBidAction.bind(null, jr.id)}>
                      <Button type="submit">Create Bid (Unclaimed)</Button>
                    </form>
                  </div>
                )}
                <div className={BIDDABLE_STATUSES.has(jr.status) ? "border-t border-slate-100 pt-4" : ""}>
                  <h2 className="text-sm font-semibold text-slate-900 uppercase tracking-wide mb-2">Convert to Project</h2>
                  <p className="text-sm text-slate-500 mb-3">
                    For a job that&apos;s already approved — creates the project starting at &quot;Bid Accepted&quot;, skipping the bid stage.
                  </p>
                  <form action={convertToProjectAction.bind(null, jr.id)}>
                    <Button type="submit">Convert to Project</Button>
                  </form>
                </div>
              </Card>
            )
          )}
        </div>

        <Card className="p-4 h-fit">
          <h2 className="text-sm font-semibold text-slate-900 uppercase tracking-wide mb-2">Contact</h2>
          {contact ? (
            <div>
              <div className="font-medium text-sm">{contact.first_name} {contact.last_name}</div>
              <div className="text-xs text-slate-500 mb-1">{contact.title}</div>
              <PhoneLink phone={contact.phone} className="text-xs" />
            </div>
          ) : (
            <div className="text-sm text-slate-400">No contact linked.</div>
          )}
          {building && (
            <Link href={`/buildings/${building.id}`} className="mt-4 block text-sm text-sky-600 hover:underline">
              View building profile →
            </Link>
          )}
        </Card>
      </div>
    </div>
  );
}
