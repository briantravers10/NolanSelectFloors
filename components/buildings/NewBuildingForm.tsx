"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui";
import { BUILDING_REGIONS } from "@/lib/types";
import type { ClientCompany, Contact } from "@/lib/types";
import { createBuildingAction } from "@/app/buildings/actions";
import { AddressAutocomplete } from "@/components/AddressAutocomplete";
import { PhoneInput } from "@/components/PhoneInput";

export function NewBuildingForm({ clients, contacts }: { clients: ClientCompany[]; contacts: Contact[] }) {
  const [clientId, setClientId] = useState(clients[0]?.id ?? "");
  const filteredContacts = useMemo(() => contacts.filter((c) => c.client_company_id === clientId), [contacts, clientId]);
  const [addr, setAddr] = useState({ address: "", city: "", state: "", zip: "", region: "Other", latitude: "", longitude: "" });

  return (
    <form action={createBuildingAction} className="space-y-5">
      <Section title="Basics">
        <Field label="Building Name">
          <input name="name" required className="input" />
        </Field>
        <Field label="Management Company">
          <select name="client_company_id" value={clientId} onChange={(e) => setClientId(e.target.value)} required className="input">
            {clients.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </Field>
        <Field label="Primary Property Manager (optional)">
          <select name="primary_contact_id" className="input" defaultValue="">
            <option value="">Select a contact…</option>
            {filteredContacts.map((c) => (
              <option key={c.id} value={c.id}>{c.first_name} {c.last_name} — {c.title}</option>
            ))}
          </select>
        </Field>
        <Field label="Region">
          <select name="region" className="input" value={addr.region} onChange={(e) => setAddr((a) => ({ ...a, region: e.target.value }))}>
            {BUILDING_REGIONS.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        </Field>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" name="active" defaultChecked className="rounded border-slate-300" />
          Active
        </label>
      </Section>

      <Section title="Address">
        <Field label="Street Address">
          <AddressAutocomplete
            name="address"
            required
            value={addr.address}
            onChange={(v) => setAddr((a) => ({ ...a, address: v }))}
            onResolved={(r) =>
              setAddr({ address: r.address, city: r.city, state: r.state, zip: r.zip, region: r.region, latitude: r.latitude?.toString() ?? "", longitude: r.longitude?.toString() ?? "" })
            }
          />
        </Field>
        <div className="grid grid-cols-3 gap-2">
          <Field label="City"><input name="city" required value={addr.city} onChange={(e) => setAddr((a) => ({ ...a, city: e.target.value }))} className="input" /></Field>
          <Field label="State"><input name="state" required maxLength={2} value={addr.state} onChange={(e) => setAddr((a) => ({ ...a, state: e.target.value }))} className="input" /></Field>
          <Field label="Zip"><input name="zip" required value={addr.zip} onChange={(e) => setAddr((a) => ({ ...a, zip: e.target.value }))} className="input" /></Field>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Latitude (filled from address)"><input name="latitude" type="number" step="0.000001" value={addr.latitude} onChange={(e) => setAddr((a) => ({ ...a, latitude: e.target.value }))} className="input" /></Field>
          <Field label="Longitude (filled from address)"><input name="longitude" type="number" step="0.000001" value={addr.longitude} onChange={(e) => setAddr((a) => ({ ...a, longitude: e.target.value }))} className="input" /></Field>
        </div>
        <p className="text-xs text-slate-500">Pick the address from the suggestions and city, state, zip, area and map location fill in automatically.</p>
      </Section>

      <Section title="Access & Operations">
        <div className="grid grid-cols-2 gap-2">
          <Field label="Superintendent Name"><input name="superintendent_name" className="input" /></Field>
          <Field label="Superintendent Phone"><PhoneInput name="superintendent_phone" /></Field>
        </div>
        <Field label="Access Instructions"><textarea name="access_instructions" rows={2} className="input" /></Field>
        <Field label="Working Hours"><input name="working_hours" className="input" /></Field>
        <Field label="COI Requirements"><textarea name="coi_requirements" rows={2} className="input" /></Field>
        <Field label="Parking / Loading"><textarea name="parking_loading" rows={2} className="input" /></Field>
        <Field label="Elevator Info"><textarea name="elevator_info" rows={2} className="input" /></Field>
        <Field label="Delivery Instructions"><textarea name="delivery_instructions" rows={2} className="input" /></Field>
        <Field label="Building Rules"><textarea name="building_rules" rows={2} className="input" /></Field>
        <Field label="Notes"><textarea name="notes" rows={2} className="input" /></Field>
      </Section>

      <Button type="submit">Create Building</Button>
    </form>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">{title}</h2>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-500 uppercase mb-1">{label}</label>
      {children}
    </div>
  );
}
