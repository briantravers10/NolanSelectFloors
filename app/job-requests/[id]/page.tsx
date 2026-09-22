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
import { EstimateCalculator } from "@/components/EstimateCalculator";
import { getActingUser } from "@/lib/current-user";
import { formatDateLong } from "@/lib/dates";
import { formatCurrency, formatJobNumber } from "@/lib/calculations";
import { getLastWorkedWithClient } from "@/lib/last-worked";
import { archiveJobRequestAction, convertToProjectAction, deleteJobRequestAction, saveJobRequestEstimateAction, startJobRequestAction, unarchiveJobRequestAction } from "../actions";
import { ConfirmDeleteButton } from "@/components/ConfirmDeleteButton";
import { canEdit } from "@/lib/permissions";

export default async function JobRequestDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [jobRequests, buildings, clients, contacts, projects, , , pricingFormulas, formulaComponents, materialRateItems] = await Promise.all([
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
  const canEditRequests = await canEdit("job_requests");
  const isCreated = jr.status === "Converted to Project" || Boolean(linkedProject);
  const isArchived = jr.status === "Archived";
  const isStarted = jr.status === "In Progress" || Boolean(jr.started_by_name);
  const displayStatus = isCreated ? "Job Created" : jr.status;

  return (
    <div className="max-w-3xl">
      <PageHeader
        title={`${building?.name ?? "Building"}${jr.unit_number ? " — " + jr.unit_number : ""}`}
        subtitle={client?.name}
        action={<StatusBadge status={displayStatus} />}
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

          <Card className="p-4 space-y-3">
            <h2 className="text-sm font-semibold text-slate-900 uppercase tracking-wide">Next Step</h2>
            {isCreated ? (
              <div className="text-sm text-slate-700">
                Job created{jr.started_by_name ? ` by ${jr.started_by_name}` : ""}.{" "}
                {linkedProject && (
                  <Link href={`/projects/${linkedProject.id}`} className="text-sky-700 font-medium hover:underline">
                    Open {formatJobNumber(linkedProject.job_number)} →
                  </Link>
                )}
                <p className="text-xs text-slate-500 mt-1">Add it to the schedule from Create / Edit Schedule; from there it runs like any other job.</p>
              </div>
            ) : isArchived ? (
              <div className="flex flex-wrap items-center gap-3 text-sm text-slate-700">
                Archived — kept for the record, hidden from the open list.
                {canEditRequests && (
                  <form action={unarchiveJobRequestAction.bind(null, jr.id)}>
                    <Button type="submit" variant="secondary">Reopen request</Button>
                  </form>
                )}
              </div>
            ) : !isStarted ? (
              <div>
                <p className="text-sm text-slate-600 mb-3">Nobody has picked this up yet. Start it to put it under your name while you fill in the details.</p>
                {canEditRequests && (
                  <form action={startJobRequestAction.bind(null, jr.id)}>
                    <Button type="submit">Start job</Button>
                  </form>
                )}
              </div>
            ) : (
              <div>
                <p className="text-sm text-slate-700 mb-1">
                  In progress — <span className="font-medium">{jr.started_by_name ?? "someone"}</span> started this
                  {jr.started_at ? ` on ${formatDateLong(jr.started_at.slice(0, 10))}` : ""}.
                </p>
                <p className="text-sm text-slate-600 mb-3">When the details are in, create the job. Everything logged here carries over to it.</p>
                {canEditRequests && (
                  <form action={convertToProjectAction.bind(null, jr.id)}>
                    <Button type="submit">Create job</Button>
                  </form>
                )}
              </div>
            )}
            {canEditRequests && !isCreated && (
              <div className="flex flex-wrap items-center gap-4 pt-3 border-t border-slate-100">
                {!isArchived && (
                  <form action={archiveJobRequestAction.bind(null, jr.id)}>
                    <button type="submit" className="text-xs text-slate-600 hover:text-slate-900 underline">Archive request</button>
                  </form>
                )}
                <ConfirmDeleteButton
                  action={deleteJobRequestAction.bind(null, jr.id)}
                  label="Delete request"
                  title="Delete this job request?"
                  warning="Permanently removes the request. If you might need it later, archive it instead."
                />
              </div>
            )}
          </Card>
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
