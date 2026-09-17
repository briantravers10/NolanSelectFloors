"use client";

import { useState } from "react";
import { Button } from "@/components/ui";
import { BUILDING_REGIONS, CONTACT_ROLES } from "@/lib/types";
import { createClientAction, updateClientAction } from "@/app/clients/actions";

/**
 * One-screen client intake: the management company + its main point of
 * contact, then as many buildings as they manage, each with as many
 * contacts as needed. Rows are plain inputs with indexed names
 * (b[0].name, b[0].c[1].phone …) that the server action parses back into
 * client → buildings → contacts, so no client-side state has to be
 * serialised — add/remove just changes which rows exist.
 */
export interface ClientFormContact { id?: string; name: string; title: string; phone: string; email: string }
export interface ClientFormBuilding {
  id?: string;
  name: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  region: string;
  contacts: ClientFormContact[];
}
export interface ClientFormInitial {
  name: string;
  phone: string;
  email: string;
  address: string;
  main_contact_id?: string;
  main_contact_name: string;
  main_contact_title: string;
  main_contact_phone: string;
  main_contact_email: string;
  ap_contact_name: string;
  ap_contact_phone: string;
  ap_contact_email: string;
  relationship_start_date: string;
  active: boolean;
  billing_notes: string;
  notes: string;
  buildings: ClientFormBuilding[];
}

type ContactRow = { key: number; data?: ClientFormContact };
type BuildingRow = { key: number; data?: ClientFormBuilding; contacts: ContactRow[] };

let nextKey = 1;

const EMPTY_CONTACT: ClientFormContact = { name: "", title: "", phone: "", email: "" };
const EMPTY_BUILDING: ClientFormBuilding = { name: "", address: "", city: "", state: "NY", zip: "", region: "Manhattan", contacts: [] };

/**
 * `clientId` + `initial` switch the same form into edit mode: every field
 * is prefilled from what's saved, existing buildings/contacts carry hidden
 * ids so the update action edits them in place, and anything removed here
 * is removed (or, for a building with job history, marked inactive).
 */
export function NewClientForm({ clientId, initial }: { clientId?: string; initial?: ClientFormInitial } = {}) {
  const [buildings, setBuildings] = useState<BuildingRow[]>(() =>
    initial
      ? initial.buildings.map((b) => ({ key: nextKey++, data: b, contacts: b.contacts.map((c) => ({ key: nextKey++, data: c })) }))
      : [{ key: nextKey++, contacts: [{ key: nextKey++ }] }]
  );
  const v = initial ?? { ...EMPTY_BUILDING, name: "", phone: "", email: "", address: "", main_contact_name: "", main_contact_title: "", main_contact_phone: "", main_contact_email: "", ap_contact_name: "", ap_contact_phone: "", ap_contact_email: "", relationship_start_date: "", active: true, billing_notes: "", notes: "", buildings: [] };
  const action = clientId ? updateClientAction.bind(null, clientId) : createClientAction;

  function addBuilding() {
    setBuildings((prev) => [...prev, { key: nextKey++, contacts: [{ key: nextKey++ }] }]);
  }
  function removeBuilding(key: number) {
    setBuildings((prev) => prev.filter((b) => b.key !== key));
  }
  function addContact(buildingKey: number) {
    setBuildings((prev) => prev.map((b) => (b.key === buildingKey ? { ...b, contacts: [...b.contacts, { key: nextKey++ }] } : b)));
  }
  function removeContact(buildingKey: number, contactKey: number) {
    setBuildings((prev) => prev.map((b) => (b.key === buildingKey ? { ...b, contacts: b.contacts.filter((c) => c.key !== contactKey) } : b)));
  }

  return (
    <form action={action} className="space-y-6">
      {initial?.main_contact_id && <input type="hidden" name="main_contact_id" value={initial.main_contact_id} />}
      {/* ---- Management company ---- */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-slate-900 uppercase tracking-wide">Management Company</h2>
        <div>
          <label className="block text-xs font-medium text-slate-500 uppercase mb-1">Company Name</label>
          <input name="name" required defaultValue={v.name} className="input" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-500 uppercase mb-1">Main Office Phone</label>
            <input name="phone" defaultValue={v.phone} className="input" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 uppercase mb-1">Main Office Email</label>
            <input name="email" type="email" defaultValue={v.email} className="input" />
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500 uppercase mb-1">Office / Billing Address</label>
          <input name="address" defaultValue={v.address} className="input" />
        </div>
      </section>

      {/* ---- Main point of contact ---- */}
      <section className="border-t border-slate-200 pt-4 space-y-2">
        <h2 className="text-sm font-semibold text-slate-900 uppercase tracking-wide">Main Point of Contact</h2>
        <p className="text-xs text-slate-500">The person you deal with at the management company.</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <input name="main_contact_name" placeholder="Full name" defaultValue={v.main_contact_name} className="input" />
          <input name="main_contact_title" placeholder="Title (e.g. Property Manager)" defaultValue={v.main_contact_title} className="input" list="contact-titles" />
          <input name="main_contact_phone" placeholder="Phone" defaultValue={v.main_contact_phone} className="input" />
          <input name="main_contact_email" placeholder="Email" type="email" defaultValue={v.main_contact_email} className="input" />
        </div>
      </section>

      {/* ---- Buildings ---- */}
      <section className="border-t border-slate-200 pt-4 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-900 uppercase tracking-wide">Buildings</h2>
          <button type="button" onClick={addBuilding} className="text-sm text-sky-600 hover:text-sky-800 font-medium">
            + Add another building
          </button>
        </div>
        <p className="text-xs text-slate-500">Every building this company manages that you work in. Add each building&apos;s own contacts underneath it.</p>

        {buildings.length === 0 && <p className="text-sm text-slate-400">No buildings yet — you can add them later from the Buildings page.</p>}

        {buildings.map((b, bi) => {
          const bd = b.data ?? EMPTY_BUILDING;
          return (
          <div key={b.key} className="rounded-lg border border-slate-200 bg-slate-50/60 p-3 space-y-3">
            {bd.id && <input type="hidden" name={`b[${bi}].id`} value={bd.id} />}
            <div className="flex items-center justify-between">
              <div className="text-xs font-semibold text-slate-600 uppercase">Building {bi + 1}</div>
              <button type="button" onClick={() => removeBuilding(b.key)} className="text-xs text-slate-400 hover:text-rose-600">
                Remove building
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-medium text-slate-500 uppercase mb-1">Building Name</label>
                <input name={`b[${bi}].name`} placeholder="e.g. 220 East 72nd" defaultValue={bd.name} className="input bg-white" />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-slate-500 uppercase mb-1">Street Address</label>
                <input name={`b[${bi}].address`} defaultValue={bd.address} className="input bg-white" />
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <label className="block text-[11px] font-medium text-slate-500 uppercase mb-1">City</label>
                <input name={`b[${bi}].city`} defaultValue={bd.city} className="input bg-white" />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-slate-500 uppercase mb-1">State</label>
                <input name={`b[${bi}].state`} defaultValue={bd.state} className="input bg-white" />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-slate-500 uppercase mb-1">Zip</label>
                <input name={`b[${bi}].zip`} defaultValue={bd.zip} className="input bg-white" />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-slate-500 uppercase mb-1">Area</label>
                <select name={`b[${bi}].region`} defaultValue={bd.region} className="input bg-white">
                  {BUILDING_REGIONS.map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="pt-1">
              <div className="flex items-center justify-between mb-1.5">
                <div className="text-[11px] font-semibold text-slate-500 uppercase">Building Contacts</div>
                <button type="button" onClick={() => addContact(b.key)} className="text-xs text-sky-600 hover:text-sky-800 font-medium">
                  + Add contact
                </button>
              </div>
              <div className="space-y-2">
                {b.contacts.map((c, ci) => {
                  const cd = c.data ?? EMPTY_CONTACT;
                  return (
                  <div key={c.key} className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_1fr_1fr_auto] gap-2 items-center">
                    {cd.id && <input type="hidden" name={`b[${bi}].c[${ci}].id`} value={cd.id} />}
                    <input name={`b[${bi}].c[${ci}].name`} placeholder="Full name" defaultValue={cd.name} className="input bg-white" />
                    <input name={`b[${bi}].c[${ci}].title`} placeholder="Title (e.g. Super)" defaultValue={cd.title} className="input bg-white" list="contact-titles" />
                    <input name={`b[${bi}].c[${ci}].phone`} placeholder="Phone" defaultValue={cd.phone} className="input bg-white" />
                    <input name={`b[${bi}].c[${ci}].email`} placeholder="Email (optional)" type="email" defaultValue={cd.email} className="input bg-white" />
                    <button type="button" onClick={() => removeContact(b.key, c.key)} className="text-xs text-slate-400 hover:text-rose-600 sm:px-1" aria-label="Remove contact">
                      ✕
                    </button>
                  </div>
                  );
                })}
                {b.contacts.length === 0 && <p className="text-xs text-slate-400">No contacts for this building yet.</p>}
              </div>
            </div>
          </div>
          );
        })}
      </section>

      <datalist id="contact-titles">
        {CONTACT_ROLES.map((r) => (
          <option key={r} value={r} />
        ))}
      </datalist>

      {/* ---- Accounts payable ---- */}
      <section className="border-t border-slate-200 pt-4 space-y-2">
        <h2 className="text-sm font-semibold text-slate-900 uppercase tracking-wide">Accounts Payable Contact</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <input name="ap_contact_name" placeholder="Name" defaultValue={v.ap_contact_name} className="input" />
          <input name="ap_contact_phone" placeholder="Phone" defaultValue={v.ap_contact_phone} className="input" />
          <input name="ap_contact_email" placeholder="Email" type="email" defaultValue={v.ap_contact_email} className="input" />
        </div>
      </section>

      {/* ---- Relationship / notes ---- */}
      <section className="border-t border-slate-200 pt-4 space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-500 uppercase mb-1">Relationship Start Date</label>
            <input name="relationship_start_date" type="date" defaultValue={v.relationship_start_date} className="input" />
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-700 pt-6">
            <input type="checkbox" name="active" defaultChecked={v.active} className="rounded border-slate-300" /> Active
          </label>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500 uppercase mb-1">Billing Notes</label>
          <textarea name="billing_notes" rows={2} defaultValue={v.billing_notes} className="input" />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500 uppercase mb-1">Notes</label>
          <textarea name="notes" rows={3} defaultValue={v.notes} className="input" />
        </div>
      </section>

      <Button type="submit">{clientId ? "Save Changes" : "Create Client"}</Button>
    </form>
  );
}
