"use client";

import { useState } from "react";
import { Button } from "@/components/ui";
import { createJobFromInboxAction } from "@/app/inbox/actions";

/**
 * "New job from this email" — same as Quick Job on the schedule: building
 * (existing or new), management company, unit, contact, and one line of
 * what the work is. The job is created in Scheduled, put on the chosen
 * date, and this email is pointed at it so it can be filed straight away.
 */
export function NewJobFromEmailForm({
  emailId,
  buildings,
  clients,
  defaultDate,
  defaultBuilding,
  defaultDescription,
}: {
  emailId: string;
  buildings: { name: string; clientName?: string }[];
  clients: { name: string }[];
  defaultDate: string;
  defaultBuilding?: string;
  defaultDescription?: string;
}) {
  const [open, setOpen] = useState(false);
  const [buildingName, setBuildingName] = useState(defaultBuilding ?? "");
  const known = buildings.find((b) => b.name.toLowerCase() === buildingName.trim().toLowerCase());
  const input = "rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm w-full";
  const listId = `inbox-buildings-${emailId}`;
  const clientListId = `inbox-clients-${emailId}`;

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="text-xs text-sky-700 hover:underline text-left">
        + New job from this email (job not in the list yet)
      </button>
    );
  }
  return (
    <form action={createJobFromInboxAction.bind(null, emailId)} className="rounded-lg border border-sky-200 bg-sky-50 p-3 flex flex-col gap-2">
      <div className="text-xs font-semibold text-sky-900 uppercase tracking-wide">New job from this email</div>
      <div>
        <label className="block text-[11px] text-slate-500 uppercase mb-0.5">Building</label>
        <input name="building_name" required list={listId} autoComplete="off" value={buildingName} onChange={(e) => setBuildingName(e.target.value)} placeholder="Pick one on file or type a new one" className={input} />
        <datalist id={listId}>
          {buildings.map((b) => (
            <option key={b.name} value={b.name}>{b.clientName ?? ""}</option>
          ))}
        </datalist>
        {known?.clientName && <div className="text-[11px] text-slate-500 mt-0.5">On file under {known.clientName}</div>}
      </div>
      {!known && (
        <div>
          <label className="block text-[11px] text-slate-500 uppercase mb-0.5">Management company / property manager</label>
          <input name="client_name" list={clientListId} autoComplete="off" placeholder="Pick or type — blank files it under Unassigned" className={input} />
          <datalist id={clientListId}>
            {clients.map((c) => (
              <option key={c.name} value={c.name} />
            ))}
          </datalist>
        </div>
      )}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-[11px] text-slate-500 uppercase mb-0.5">Unit / Apt</label>
          <input name="unit_number" placeholder="e.g. 4B" className={input} />
        </div>
        <div>
          <label className="block text-[11px] text-slate-500 uppercase mb-0.5">Start date</label>
          <input name="schedule_date" type="date" required defaultValue={defaultDate} className={input} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-[11px] text-slate-500 uppercase mb-0.5">Contact</label>
          <input name="contact_name" placeholder="optional" className={input} />
        </div>
        <div>
          <label className="block text-[11px] text-slate-500 uppercase mb-0.5">Contact phone</label>
          <input name="contact_phone" placeholder="optional" className={input} />
        </div>
      </div>
      <div>
        <label className="block text-[11px] text-slate-500 uppercase mb-0.5">What&apos;s the work?</label>
        <input name="description" required defaultValue={defaultDescription ?? ""} placeholder="e.g. Sand & refinish 2 bedrooms" className={input} />
      </div>
      <div className="flex items-center justify-between gap-2">
        <button type="button" onClick={() => setOpen(false)} className="text-xs text-slate-500 hover:underline">Cancel</button>
        <Button type="submit">Create job</Button>
      </div>
    </form>
  );
}
