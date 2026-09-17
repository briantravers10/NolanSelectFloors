"use client";

import { useState } from "react";
import { Button } from "@/components/ui";
import { PhoneInput } from "@/components/PhoneInput";
import { AddressAutocomplete } from "@/components/AddressAutocomplete";
import { createQuickJobAction } from "@/app/schedule/actions";

/**
 * "Quick Job" — for the one-day turnarounds that don't need a job request,
 * a bid, or a full project write-up. Building, management company and
 * point of contact can each be picked from what's already on file OR
 * typed fresh; anything new is created and shows up under Clients /
 * Buildings / Contacts like it was entered there. The job lands in
 * "Scheduled" and loads straight into the schedule form for crew/color.
 */
export function QuickJobForm({
  date,
  buildings,
  clients,
  contacts,
  error,
  prefill,
}: {
  date: string;
  buildings: { name: string; clientName?: string }[];
  clients: { name: string }[];
  contacts: { name: string; clientName?: string }[];
  error?: string;
  prefill?: { building?: string; unit?: string; contact?: string; phone?: string; desc?: string };
}) {
  const [open, setOpen] = useState(Boolean(error));
  const [buildingName, setBuildingName] = useState(prefill?.building ?? "");
  const [addr, setAddr] = useState({ address: "", city: "", state: "NY", zip: "", region: "Other", latitude: "", longitude: "" });
  const known = buildings.find((b) => b.name.toLowerCase() === buildingName.trim().toLowerCase());

  if (!open) {
    return (
      <Button type="button" onClick={() => setOpen(true)} className="whitespace-nowrap">
        + Quick Job
      </Button>
    );
  }

  return (
    <form action={createQuickJobAction} className="rounded-xl border border-sky-200 bg-sky-50 p-3 w-full space-y-2">
      <input type="hidden" name="schedule_date" value={date} />
      <div className="grid grid-cols-1 sm:grid-cols-[2fr_2fr_1fr] gap-2">
        <div>
          <label className="block text-[11px] font-semibold text-slate-600 uppercase mb-1">Building</label>
          <input
            name="building_name"
            list="qj-buildings"
            required
            autoComplete="off"
            value={buildingName}
            onChange={(e) => setBuildingName(e.target.value)}
            placeholder="Pick one or type a new building"
            className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-sm"
          />
          <datalist id="qj-buildings">
            {buildings.map((b) => (
              <option key={b.name + (b.clientName ?? "")} value={b.name}>{b.clientName}</option>
            ))}
          </datalist>
        </div>
        <div>
          <label className="block text-[11px] font-semibold text-slate-600 uppercase mb-1">
            Management Company{" "}
            {known?.clientName ? (
              <span className="normal-case text-slate-400">— {known.clientName}</span>
            ) : buildingName.trim() ? (
              <span className="normal-case text-slate-400">— optional, can be added later</span>
            ) : null}
          </label>
          <input
            name="client_name"
            list="qj-clients"
            autoComplete="off"
            placeholder={known ? "Already on file" : "Pick one, type a new one, or leave blank"}
            className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-sm"
          />
          <datalist id="qj-clients">
            {clients.map((c) => (
              <option key={c.name} value={c.name} />
            ))}
          </datalist>
        </div>
        <div>
          <label className="block text-[11px] font-semibold text-slate-600 uppercase mb-1">Unit</label>
          <input name="unit_number" placeholder="e.g. 4B" defaultValue={prefill?.unit ?? ""} className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-sm" />
        </div>
      </div>

      {!known && buildingName.trim() && (
        <div className="grid grid-cols-1 sm:grid-cols-[3fr_1fr_1fr] gap-2">
          <div>
            <label className="block text-[11px] font-semibold text-slate-600 uppercase mb-1">Street Address (new building)</label>
            <AddressAutocomplete
              name="address"
              value={addr.address}
              onChange={(v) => setAddr((a) => ({ ...a, address: v }))}
              onResolved={(r) => setAddr({ address: r.address, city: r.city, state: r.state || "NY", zip: r.zip, region: r.region, latitude: r.latitude?.toString() ?? "", longitude: r.longitude?.toString() ?? "" })}
              className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-slate-600 uppercase mb-1">City</label>
            <input name="city" value={addr.city} onChange={(e) => setAddr((a) => ({ ...a, city: e.target.value }))} className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-slate-600 uppercase mb-1">Zip</label>
            <input name="zip" value={addr.zip} onChange={(e) => setAddr((a) => ({ ...a, zip: e.target.value }))} className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-sm" />
          </div>
          <input type="hidden" name="state" value={addr.state} />
          <input type="hidden" name="region" value={addr.region} />
          <input type="hidden" name="latitude" value={addr.latitude} />
          <input type="hidden" name="longitude" value={addr.longitude} />
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-[2fr_2fr_3fr] gap-2">
        <div>
          <label className="block text-[11px] font-semibold text-slate-600 uppercase mb-1">Point of Contact</label>
          <input
            name="contact_name"
            list="qj-contacts"
            autoComplete="off"
            defaultValue={prefill?.contact ?? ""}
            placeholder="Pick one or type a name"
            className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-sm"
          />
          <datalist id="qj-contacts">
            {contacts.map((c) => (
              <option key={c.name + (c.clientName ?? "")} value={c.name}>{c.clientName}</option>
            ))}
          </datalist>
        </div>
        <div>
          <label className="block text-[11px] font-semibold text-slate-600 uppercase mb-1">Contact Phone</label>
          <PhoneInput name="contact_phone" defaultValue={prefill?.phone ?? ""} className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-sm" />
        </div>
        <div>
          <label className="block text-[11px] font-semibold text-slate-600 uppercase mb-1">What&apos;s the job?</label>
          <input name="description" required defaultValue={prefill?.desc ?? ""} placeholder="e.g. Sand & refinish living room" className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-sm" />
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Button type="submit">Create &amp; Schedule</Button>
        <button type="button" onClick={() => setOpen(false)} className="text-sm text-slate-500 hover:text-slate-800">
          Cancel
        </button>
        <span className="text-[11px] text-slate-500">New buildings, companies and contacts are saved to Clients / Buildings automatically. A building with no company goes under &quot;Unassigned&quot; until you move it.</span>
      </div>
    </form>
  );
}
