"use client";

import { useState } from "react";
import { FileInboundForm, type FileKind, type InboxJobOption } from "./FileInboundForm";
import { NewJobFromEmailForm } from "./NewJobFromEmailForm";

/**
 * Owns the filing "kind" so the page can react to it: specifically, an
 * Inbound Invoice (a supplier billing us) never offers "New job from this
 * email" — a bill isn't scheduled work with a start date, it just links to
 * an existing job or stays supplier-only (the Job field above already
 * covers that). Every other kind keeps that option.
 */
export function InboxFilingBlock({
  emailId,
  initialKind,
  jobs,
  defaultProjectId,
  suppliers,
  defaultSupplier,
  defaultDate,
  submitLabel,
  showNewJob = false,
  quickBuildings = [],
  quickClients = [],
  defaultQuickDate = "",
  defaultQuickBuilding,
  defaultQuickDescription,
}: {
  emailId: string;
  initialKind: FileKind;
  jobs: InboxJobOption[];
  defaultProjectId: string;
  suppliers: string[];
  defaultSupplier: string;
  defaultDate: string;
  submitLabel?: string;
  /** Whether "New job from this email" is offered at all for this row (the
   * "Matched automatically" section never offers it — those already have
   * a job). */
  showNewJob?: boolean;
  quickBuildings?: { name: string; clientName?: string }[];
  quickClients?: { name: string }[];
  defaultQuickDate?: string;
  defaultQuickBuilding?: string;
  defaultQuickDescription?: string;
}) {
  const [kind, setKind] = useState<FileKind>(initialKind);

  return (
    <>
      <FileInboundForm
        emailId={emailId}
        kind={kind}
        onKindChange={setKind}
        jobs={jobs}
        defaultProjectId={defaultProjectId}
        suppliers={suppliers}
        defaultSupplier={defaultSupplier}
        defaultDate={defaultDate}
        submitLabel={submitLabel}
      />
      {showNewJob && kind !== "invoice" && (
        <NewJobFromEmailForm
          emailId={emailId}
          buildings={quickBuildings}
          clients={quickClients}
          defaultDate={defaultQuickDate}
          defaultBuilding={defaultQuickBuilding}
          defaultDescription={defaultQuickDescription}
        />
      )}
    </>
  );
}
