"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createBuildingContact, createBuildingRecord, createClientCompanyRecord, createContact, updateBuilding, updateClientCompany } from "@/lib/db";
import { canEdit } from "@/lib/permissions";
import { BUILDING_REGIONS, CONTACT_ROLES } from "@/lib/types";
import type { BuildingRegion, ContactRole } from "@/lib/types";

function str(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

function splitName(full: string): { first_name: string; last_name: string } {
  const parts = full.trim().split(/\s+/);
  if (parts.length === 1) return { first_name: parts[0], last_name: "" };
  return { first_name: parts.slice(0, -1).join(" "), last_name: parts[parts.length - 1] };
}

/** Free-text title → building_contacts.role enum ("Other" if it doesn't match). */
function roleFromTitle(title: string): ContactRole {
  const match = CONTACT_ROLES.find((r) => r.toLowerCase() === title.toLowerCase());
  return match ?? "Other";
}

interface ParsedContact { name: string; title: string; phone: string; email: string }
interface ParsedBuilding { name: string; address: string; city: string; state: string; zip: string; region: BuildingRegion; contacts: ParsedContact[] }

/**
 * Reads the indexed rows the NewClientForm posts (b[0].name, b[0].c[1].phone
 * …) back into buildings with nested contacts. Rows with no name are
 * ignored, so an untouched blank row never creates an empty record.
 */
function parseBuildings(formData: FormData): ParsedBuilding[] {
  const buildings = new Map<number, ParsedBuilding>();
  const get = (i: number) => {
    let b = buildings.get(i);
    if (!b) {
      b = { name: "", address: "", city: "", state: "", zip: "", region: "Other", contacts: [] };
      buildings.set(i, b);
    }
    return b;
  };
  const contactRows = new Map<string, ParsedContact>();
  for (const [key, raw] of formData.entries()) {
    const value = String(raw).trim();
    const c = /^b\[(\d+)\]\.c\[(\d+)\]\.(name|title|phone|email)$/.exec(key);
    if (c) {
      const id = `${c[1]}:${c[2]}`;
      const row = contactRows.get(id) ?? { name: "", title: "", phone: "", email: "" };
      row[c[3] as keyof ParsedContact] = value;
      contactRows.set(id, row);
      continue;
    }
    const b = /^b\[(\d+)\]\.(name|address|city|state|zip|region)$/.exec(key);
    if (b) {
      const row = get(Number(b[1]));
      if (b[2] === "region") row.region = (BUILDING_REGIONS as readonly string[]).includes(value) ? (value as BuildingRegion) : "Other";
      else row[b[2] as "name" | "address" | "city" | "state" | "zip"] = value;
    }
  }
  for (const [id, row] of contactRows) {
    if (!row.name) continue;
    get(Number(id.split(":")[0])).contacts.push(row);
  }
  return [...buildings.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([, b]) => b)
    .filter((b) => b.name || b.address);
}

export async function createClientAction(formData: FormData) {
  // Server-action gate (build 11) — the real security boundary, since a
  // view-only user could otherwise bypass a hidden "New Client" button.
  // See README "Enforcement".
  if (!(await canEdit("clients"))) return;
  const name = str(formData, "name");
  if (!name) return;

  const client = await createClientCompanyRecord({
    name,
    type: str(formData, "type") || "Property Management",
    phone: str(formData, "phone") || undefined,
    email: str(formData, "email") || undefined,
    address: str(formData, "address") || undefined,
    website: str(formData, "website") || undefined,
    ap_contact_name: str(formData, "ap_contact_name") || undefined,
    ap_contact_phone: str(formData, "ap_contact_phone") || undefined,
    ap_contact_email: str(formData, "ap_contact_email") || undefined,
    relationship_start_date: str(formData, "relationship_start_date") || undefined,
    active: formData.get("active") !== "off",
    billing_notes: str(formData, "billing_notes") || undefined,
    notes: str(formData, "notes") || undefined,
  });

  // Main point of contact → a contacts row on this client, linked back.
  const mainName = str(formData, "main_contact_name");
  if (mainName) {
    const main = await createContact({
      client_company_id: client.id,
      ...splitName(mainName),
      title: str(formData, "main_contact_title") || "Main Point of Contact",
      phone: str(formData, "main_contact_phone") || undefined,
      email: str(formData, "main_contact_email") || undefined,
    });
    await updateClientCompany(client.id, { main_contact_id: main.id });
  }

  // Buildings, each with its own contacts (first one becomes the POC).
  for (const b of parseBuildings(formData)) {
    const building = await createBuildingRecord({
      client_company_id: client.id,
      name: b.name || b.address,
      address: b.address,
      city: b.city,
      state: b.state || "NY",
      zip: b.zip,
      region: b.region,
      latitude: null,
      longitude: null,
      active: true,
    });
    let primaryContactId: string | undefined;
    for (const [i, c] of b.contacts.entries()) {
      const contact = await createContact({
        client_company_id: client.id,
        ...splitName(c.name),
        title: c.title || undefined,
        phone: c.phone || undefined,
        email: c.email || undefined,
      });
      await createBuildingContact({ building_id: building.id, contact_id: contact.id, role: roleFromTitle(c.title), is_primary: i === 0 });
      if (i === 0) primaryContactId = contact.id;
    }
    if (primaryContactId) await updateBuilding(building.id, { primary_contact_id: primaryContactId });
  }

  revalidatePath("/clients");
  revalidatePath("/buildings");
  redirect(`/clients/${client.id}`);
}
