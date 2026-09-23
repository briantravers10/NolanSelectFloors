"use client";

import { Button } from "@/components/ui";
import { fileInboundAction } from "@/app/inbox/actions";

export interface InboxJobOption {
  id: string;
  buildingId: string;
  label: string;
}

/** "Estimate Sent" isn't a stored kind — the server files it as a
 * Potential Bid already marked "Quoted — waiting" against the chosen job. */
export type FileKind = "drawing" | "invoice" | "outbound_invoice" | "change_order_outbound" | "purchase_order" | "bid" | "estimate_sent" | "coi";

/**
 * Filing form on an email. What it becomes:
 *  - Drawing → the job's Drawings
 *  - Inbound Invoice (a supplier billing us) → ONE materials line under
 *    the supplier, linked to a job only if one is picked. No "start date"
 *    here — a bill isn't scheduled work, just an invoiced date.
 *  - Outbound Invoice (one we sent the customer) → the job's current
 *    invoice; the previous one moves to history
 *  - Change Order (Outbound) → the job's Change Orders history — kept
 *    separate from Outbound Invoice so it never becomes "the" invoice the
 *    schedule's Invoice quick link opens
 *  - Purchase Order → the Purchase Orders section, linked to the job
 *  - Potential Bid → the Bids section
 *  - Estimate Sent → the Bids section too, already marked "Quoted —
 *    waiting" against the job whose details it carries
 *  - COI → the job's certificate; its COI badge turns Approved
 *
 * `kind` / `onKindChange` are controlled by the parent (InboxFilingBlock)
 * so it can decide whether to also offer "New job from this email".
 */
export function FileInboundForm({
  emailId,
  kind,
  onKindChange,
  jobs,
  defaultProjectId,
  suppliers,
  defaultSupplier,
  defaultDate,
  submitLabel = "File",
}: {
  emailId: string;
  kind: FileKind;
  onKindChange: (k: FileKind) => void;
  jobs: InboxJobOption[];
  defaultProjectId: string;
  suppliers: string[];
  defaultSupplier: string;
  defaultDate: string;
  submitLabel?: string;
}) {
  const input = "rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm w-full";
  const needsJob = kind === "drawing" || kind === "coi" || kind === "outbound_invoice" || kind === "change_order_outbound" || kind === "purchase_order" || kind === "estimate_sent";
  const jobOptional = kind === "invoice" || kind === "bid";

  return (
    <form action={fileInboundAction.bind(null, emailId)} className="flex flex-col gap-2 min-w-[300px]">
      <select name="kind" value={kind} onChange={(e) => onKindChange(e.target.value as FileKind)} className={input}>
        <option value="drawing">File as Drawing</option>
        <option value="invoice">File as Inbound Invoice (a supplier billing us)</option>
        <option value="outbound_invoice">File as Outbound Invoice (sent to the customer)</option>
        <option value="change_order_outbound">File as Change Order (Outbound, sent to the customer)</option>
        <option value="purchase_order">File as Purchase Order</option>
        <option value="bid">File as Potential Bid</option>
        <option value="estimate_sent">File as Estimate Sent — marks a bid Quoted</option>
        <option value="coi">File as COI — marks the job&apos;s COI Approved</option>
      </select>

      {kind === "invoice" && (
        <>
          <div>
            <label className="block text-[11px] text-slate-500 uppercase mb-0.5">Supplier</label>
            <input name="supplier" required list={`suppliers-${emailId}`} autoComplete="off" defaultValue={defaultSupplier} placeholder="Pick or type" className={input} />
            <datalist id={`suppliers-${emailId}`}>
              {suppliers.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[11px] text-slate-500 uppercase mb-0.5">Amount</label>
              <input name="amount" type="number" step="0.01" min="0" placeholder="0.00" className={input} />
            </div>
            <div>
              <label className="block text-[11px] text-slate-500 uppercase mb-0.5">Invoiced date</label>
              <input name="invoice_date" type="date" defaultValue={defaultDate} className={input} />
            </div>
          </div>
        </>
      )}

      {kind === "outbound_invoice" && (
        <div className="grid grid-cols-3 gap-2">
          <div>
            <label className="block text-[11px] text-slate-500 uppercase mb-0.5">Invoice #</label>
            <input name="invoice_number" placeholder="optional" className={input} />
          </div>
          <div>
            <label className="block text-[11px] text-slate-500 uppercase mb-0.5">Amount</label>
            <input name="amount" type="number" step="0.01" min="0" placeholder="0.00" className={input} />
          </div>
          <div>
            <label className="block text-[11px] text-slate-500 uppercase mb-0.5">Invoiced date</label>
            <input name="invoice_date" type="date" defaultValue={defaultDate} className={input} />
          </div>
        </div>
      )}

      {kind === "change_order_outbound" && (
        <div className="grid grid-cols-3 gap-2">
          <div>
            <label className="block text-[11px] text-slate-500 uppercase mb-0.5">CO #</label>
            <input name="invoice_number" placeholder="optional" className={input} />
          </div>
          <div>
            <label className="block text-[11px] text-slate-500 uppercase mb-0.5">Amount</label>
            <input name="amount" type="number" step="0.01" min="0" placeholder="0.00" className={input} />
          </div>
          <div>
            <label className="block text-[11px] text-slate-500 uppercase mb-0.5">Sent date</label>
            <input name="invoice_date" type="date" defaultValue={defaultDate} className={input} />
          </div>
        </div>
      )}

      {kind === "estimate_sent" && (
        <div>
          <label className="block text-[11px] text-slate-500 uppercase mb-0.5">Estimate amount <span className="normal-case text-slate-400">(optional)</span></label>
          <input name="amount" type="number" step="0.01" min="0" placeholder="0.00" className={input} />
        </div>
      )}

      <div>
        <label className="block text-[11px] text-slate-500 uppercase mb-0.5">
          Job {jobOptional && <span className="normal-case text-slate-400">(optional)</span>}
        </label>
        <select name="project_id" required={needsJob} defaultValue={defaultProjectId} className={input}>
          <option value="" disabled={needsJob}>{needsJob ? "— Which job? —" : kind === "invoice" ? "No job — supplier only" : "No job yet"}</option>
          {jobs.map((j) => (
            <option key={j.id} value={j.id}>{j.label}</option>
          ))}
        </select>
        {kind === "coi" && (
          <div className="text-[11px] text-slate-500 mt-1">The certificate is attached to the job and the schedule&apos;s COI badge turns Approved and links to it. Confirming here is the approval.</div>
        )}
        {kind === "invoice" && (
          <div className="text-[11px] text-slate-500 mt-1">Counted once: under the supplier always, and under the job only if you pick one. You can link it later from Suppliers.</div>
        )}
        {kind === "outbound_invoice" && (
          <div className="text-[11px] text-slate-500 mt-1">Becomes the job&apos;s current invoice, with an “Invoice” quick link on its schedule tile. Any earlier one stays in the job&apos;s history.</div>
        )}
        {kind === "change_order_outbound" && (
          <div className="text-[11px] text-slate-500 mt-1">Filed under the job&apos;s Change Orders history — separate from Outbound Invoice, so it never becomes the invoice the schedule&apos;s quick link opens.</div>
        )}
        {kind === "purchase_order" && (
          <div className="text-[11px] text-slate-500 mt-1">Listed under Purchase Orders with a link to the job. Don&apos;t see the job? Create it with “New job from this email” below first.</div>
        )}
        {kind === "bid" && (
          <div className="text-[11px] text-slate-500 mt-1">Goes to the Bids section to be priced. Mark it won or lost from there.</div>
        )}
        {kind === "estimate_sent" && (
          <div className="text-[11px] text-slate-500 mt-1">Goes to Bids already marked “Quoted — waiting”, with this job&apos;s details attached.</div>
        )}
      </div>
      <Button type="submit">{submitLabel}</Button>
    </form>
  );
}
