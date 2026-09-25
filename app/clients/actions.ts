"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import {
  createBuildingContact,
  createBuildingRecord,
  createClientCompanyRecord,
  createContact,
  deleteBuilding,
  deleteClientCompany,
  deleteBuildingContact,
  deleteContact,
  listBuildingContacts,
  listBuildings,
  listClientCompanies,
  listContacts,
  listJobRequests,
  listProjects,
  updateBuilding,
  updateClientCompany,
  updateContact,
} from "@/lib/db";
import { canEdit } from "@/lib/permissions";
import { getActingUser } from "@/lib/current-user";
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

interface ParsedContact { id?: string; name: string; title: string; phone: string; email: string }
interface ParsedBuilding { id?: string; name: string; address: string; city: string; state: string; zip: string; region: BuildingRegion; latitude: number | null; longitude: number | null; contacts: ParsedContact[] }

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
      b = { name: "", address: "", city: "", state: "", zip: "", region: "Other", latitude: null, longitude: null, contacts: [] };
      buildings.set(i, b);
    }
    return b;
  };
  const contactRows = new Map<string, ParsedContact>();
  for (const [key, raw] of formData.entries()) {
    const value = String(raw).trim();
    const c = /^b\[(\d+)\]\.c\[(\d+)\]\.(id|name|title|phone|email)$/.exec(key);
    if (c) {
      const id = `${c[1]}:${c[2]}`;
      const row = contactRows.get(id) ?? { name: "", title: "", phone: "", email: "" };
      if (c[3] === "id") row.id = value || undefined;
      else row[c[3] as "name" | "title" | "phone" | "email"] = value;
      contactRows.set(id, row);
      continue;
    }
    const b = /^b\[(\d+)\]\.(id|name|address|city|state|zip|region|latitude|longitude)$/.exec(key);
    if (b) {
      const row = get(Number(b[1]));
      if (b[2] === "id") row.id = value || undefined;
      else if (b[2] === "latitude" || b[2] === "longitude") row[b[2]] = value && Number.isFinite(Number(value)) ? Number(value) : null;
      else if (b[2] === "region") row.region = (BUILDING_REGIONS as readonly string[]).includes(value) ? (value as BuildingRegion) : "Other";
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
    active: formData.get("active") === "on",
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
      latitude: b.latitude,
      longitude: b.longitude,
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

function clientFields(formData: FormData) {
  return {
    phone: str(formData, "phone") || undefined,
    email: str(formData, "email") || undefined,
    address: str(formData, "address") || undefined,
    ap_contact_name: str(formData, "ap_contact_name") || undefined,
    ap_contact_phone: str(formData, "ap_contact_phone") || undefined,
    ap_contact_email: str(formData, "ap_contact_email") || undefined,
    relationship_start_date: str(formData, "relationship_start_date") || undefined,
    active: formData.get("active") === "on",
    billing_notes: str(formData, "billing_notes") || undefined,
    notes: str(formData, "notes") || undefined,
  };
}

/**
 * Edit an existing client from the same form, prefilled. Existing
 * buildings/contacts arrive with hidden ids and are updated in place; rows
 * without an id are created; existing ones missing from the submission
 * were removed in the form. A removed building that has projects or job
 * requests is marked inactive rather than deleted so history is kept.
 */
export async function updateClientAction(clientId: string, formData: FormData) {
  if (!(await canEdit("clients"))) return;
  const name = str(formData, "name");
  if (!name) return;
  const [clients, allBuildings, allContacts, allLinks, projects, jobRequests] = await Promise.all([
    listClientCompanies(),
    listBuildings(),
    listContacts(),
    listBuildingContacts(),
    listProjects(),
    listJobRequests(),
  ]);
  const client = clients.find((c) => c.id === clientId);
  if (!client) return;

  await updateClientCompany(clientId, { name, ...clientFields(formData) });

  // Main point of contact: update the linked contact, create it, or clear it.
  const mainName = str(formData, "main_contact_name");
  const mainPatch = {
    ...splitName(mainName || " "),
    title: str(formData, "main_contact_title") || "Main Point of Contact",
    phone: str(formData, "main_contact_phone") || undefined,
    email: str(formData, "main_contact_email") || undefined,
  };
  const touchedBuildingIds = new Set<string>();
  const touchedContactIds = new Set<string>();

  const existingMain = client.main_contact_id ? allContacts.find((c) => c.id === client.main_contact_id) : undefined;
  if (mainName && existingMain) {
    await updateContact(existingMain.id, mainPatch);
    touchedContactIds.add(existingMain.id);
  } else if (mainName) {
    const main = await createContact({ client_company_id: clientId, ...mainPatch });
    await updateClientCompany(clientId, { main_contact_id: main.id });
  } else if (existingMain) {
    await updateClientCompany(clientId, { main_contact_id: undefined });
    await deleteContact(existingMain.id);
  }

  const submitted = parseBuildings(formData);
  const clientBuildings = allBuildings.filter((b) => b.client_company_id === clientId);
  const keptBuildingIds = new Set(submitted.map((b) => b.id).filter(Boolean));
  const referenced = new Set([...projects.map((p) => p.building_id), ...jobRequests.map((j) => j.building_id)]);

  // Buildings removed in the form.
  for (const b of clientBuildings) {
    if (keptBuildingIds.has(b.id)) continue;
    if (referenced.has(b.id)) await updateBuilding(b.id, { active: false });
    else await deleteBuilding(b.id);
  }

  for (const b of submitted) {
    const fields = { name: b.name || b.address, address: b.address, city: b.city, state: b.state || "NY", zip: b.zip, region: b.region, latitude: b.latitude, longitude: b.longitude };
    let buildingId = b.id && clientBuildings.some((x) => x.id === b.id) ? b.id : undefined;
    if (buildingId) await updateBuilding(buildingId, { ...fields, active: true });
    else {
      const created = await createBuildingRecord({ client_company_id: clientId, ...fields, active: true });
      buildingId = created.id;
    }
    touchedBuildingIds.add(buildingId);

    const existingLinks = allLinks.filter((l) => l.building_id === buildingId);
    const keptContactIds = new Set(b.contacts.map((c) => c.id).filter(Boolean));
    for (const link of existingLinks) {
      if (keptContactIds.has(link.contact_id)) continue;
      // Contact removed from this building — drop the contact entirely if
      // it isn't linked anywhere else and isn't the main contact.
      const linkedElsewhere = allLinks.some((l) => l.contact_id === link.contact_id && l.building_id !== buildingId);
      if (!linkedElsewhere && link.contact_id !== client.main_contact_id) await deleteContact(link.contact_id);
      else await deleteBuildingContact(buildingId, link.contact_id);
    }

    let primaryContactId: string | undefined;
    for (const [i, c] of b.contacts.entries()) {
      const patch = { ...splitName(c.name), title: c.title || undefined, phone: c.phone || undefined, email: c.email || undefined };
      let contactId = c.id && allContacts.some((x) => x.id === c.id) ? c.id : undefined;
      if (contactId) {
        await updateContact(contactId, patch);
        touchedContactIds.add(contactId);
        const link = existingLinks.find((l) => l.contact_id === contactId);
        if (!link) await createBuildingContact({ building_id: buildingId, contact_id: contactId, role: roleFromTitle(c.title), is_primary: i === 0 });
      } else {
        const created = await createContact({ client_company_id: clientId, ...patch });
        contactId = created.id;
        await createBuildingContact({ building_id: buildingId, contact_id: contactId, role: roleFromTitle(c.title), is_primary: i === 0 });
      }
      if (i === 0) primaryContactId = contactId;
    }
    await updateBuilding(buildingId, { primary_contact_id: primaryContactId });
  }

  revalidatePath("/clients");
  revalidatePath(`/clients/${clientId}`);
  revalidatePath("/buildings");
  for (const buildingId of touchedBuildingIds) revalidatePath(`/buildings/${buildingId}`);
  for (const contactId of touchedContactIds) revalidatePath(`/contacts/${contactId}`);
  redirect(`/clients/${clientId}`);
}

/**
 * Permanent delete (for duplicates created by a double-tap). Refused when
 * the client has any projects or job requests, so real history can't be
 * wiped by accident — mark the client Inactive from Edit Client instead.
 */
export async function deleteClientAction(clientId: string) {
  if (!(await canEdit("clients"))) return;
  const [buildings, projects, jobRequests] = await Promise.all([listBuildings(), listProjects(), listJobRequests()]);
  const buildingIds = new Set(buildings.filter((b) => b.client_company_id === clientId).map((b) => b.id));
  const hasHistory = projects.some((p) => buildingIds.has(p.building_id)) || jobRequests.some((j) => buildingIds.has(j.building_id));
  if (hasHistory) redirect(`/clients/${clientId}?err=has-history`);
  const actingUser = await getActingUser();
  await deleteClientCompany(clientId, actingUser.fullName);
  revalidatePath("/clients");
  revalidatePath("/buildings");
  redirect("/clients");
}
