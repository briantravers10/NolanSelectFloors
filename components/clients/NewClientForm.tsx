"use client";

import { useState } from "react";
import { Button } from "@/components/ui";
import { BUILDING_REGIONS, CONTACT_ROLES } from "@/lib/types";
import { createClientAction } from "@/app/clients/actions";

/**
 * One-screen client intake: the management company + its main point of
 * contact, then as many buildings as they manage, each with as many
 * contacts as needed. Rows are plain inputs with indexed names
 * (b[0].name, b[0].c[1].phone …) that the server action parses back into
 * client → buildings → contacts, so no client-side state has to be
 * serialised — add/remove just changes which rows exist.
 */
type ContactRow = { key: number };
type BuildingRow = { key: number; contacts: ContactRow[] };

let nextKey = 1;

export function NewClientForm() {
  const [buildings, setBuildings] = useState<BuildingRow[]>([{ key: nextKey++, contacts: [{ key: nextKey++ }] }]);

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
    <form action={createClientAction} className="space-y-6">
      {/* ---- Management company ---- */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-slate-900 uppercase tracking-wide">Management Company</h2>
        <div>
          <label className="block text-xs font-medium text-slate-500 uppercase mb-1">Company Name</label>
          <input name="name" required className="input" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-500 uppercase mb-1">Main Office Phone</label>
            <input name="phone" className="input" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 uppercase mb-1">Main Office Email</label>
            <input name="email" type="email" className="input" />
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500 uppercase mb-1">Office / Billing Address</label>
          <input name="address" className="input" />
        </div>
      </section>

      {/* ---- Main point of contact ---- */}
      <section className="border-t border-slate-200 pt-4 space-y-2">
        <h2 className="text-sm font-semibold text-slate-900 uppercase tracking-wide">Main Point of Contact</h2>
        <p className="text-xs text-slate-500">The person you deal with at the management company.</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <input name="main_contact_name" placeholder="Full name" className="input" />
          <input name="main_contact_title" placeholder="Title (e.g. Property Manager)" className="input" list="contact-titles" />
          <input name="main_contact_phone" placeholder="Phone" className="input" />
          <input name="main_contact_email" placeholder="Email" type="email" className="input" />
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

        {buildings.map((b, bi) => (
          <div key={b.key} className="rounded-lg border border-slate-200 bg-slate-50/60 p-3 space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-xs font-semibold text-slate-600 uppercase">Building {bi + 1}</div>
              <button type="button" onClick={() => removeBuilding(b.key)} className="text-xs text-slate-400 hover:text-rose-600">
                Remove building
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-medium text-slate-500 uppercase mb-1">Building Name</label>
                <input name={`b[${bi}].name`} placeholder="e.g. 220 East 72nd" className="input bg-white" />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-slate-500 uppercase mb-1">Street Address</label>
                <input name={`b[${bi}].address`} className="input bg-white" />
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <label className="block text-[11px] font-medium text-slate-500 uppercase mb-1">City</label>
                <input name={`b[${bi}].city`} className="input bg-white" />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-slate-500 uppercase mb-1">State</label>
                <input name={`b[${bi}].state`} defaultValue="NY" className="input bg-white" />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-slate-500 uppercase mb-1">Zip</label>
                <input name={`b[${bi}].zip`} className="input bg-white" />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-slate-500 uppercase mb-1">Area</label>
                <select name={`b[${bi}].region`} defaultValue="Manhattan" className="input bg-white">
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
                {b.contacts.map((c, ci) => (
                  <div key={c.key} className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_1fr_1fr_auto] gap-2 items-center">
                    <input name={`b[${bi}].c[${ci}].name`} placeholder="Full name" className="input bg-white" />
                    <input name={`b[${bi}].c[${ci}].title`} placeholder="Title (e.g. Super)" className="input bg-white" list="contact-titles" />
                    <input name={`b[${bi}].c[${ci}].phone`} placeholder="Phone" className="input bg-white" />
                    <input name={`b[${bi}].c[${ci}].email`} placeholder="Email (optional)" type="email" className="input bg-white" />
                    <button type="button" onClick={() => removeContact(b.key, c.key)} className="text-xs text-slate-400 hover:text-rose-600 sm:px-1" aria-label="Remove contact">
                      ✕
                    </button>
                  </div>
                ))}
                {b.contacts.length === 0 && <p className="text-xs text-slate-400">No contacts for this building yet.</p>}
              </div>
            </div>
          </div>
        ))}
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
          <input name="ap_contact_name" placeholder="Name" className="input" />
          <input name="ap_contact_phone" placeholder="Phone" className="input" />
          <input name="ap_contact_email" placeholder="Email" type="email" className="input" />
        </div>
      </section>

      {/* ---- Relationship / notes ---- */}
      <section className="border-t border-slate-200 pt-4 space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-500 uppercase mb-1">Relationship Start Date</label>
            <input name="relationship_start_date" type="date" className="input" />
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-700 pt-6">
            <input type="checkbox" name="active" defaultChecked className="rounded border-slate-300" /> Active
          </label>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500 uppercase mb-1">Billing Notes</label>
          <textarea name="billing_notes" rows={2} className="input" />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500 uppercase mb-1">Notes</label>
          <textarea name="notes" rows={3} className="input" />
        </div>
      </section>

      <Button type="submit">Create Client</Button>
    </form>
  );
}
