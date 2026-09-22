import "server-only";
import {
  createBuildingContact,
  createBuildingRecord,
  createClientCompanyRecord,
  createContact,
  getOrCreateUnassignedClient,
  listBuildingContacts,
  listBuildings,
  listClientCompanies,
  listContacts,
  updateBuilding,
  updateContact,
} from "./db";
import { BUILDING_REGIONS, type Building, type BuildingRegion } from "./types";

/**
 * Shared by "Quick Job" on the schedule and "New job" in Email Inbox:
 * finds (or creates) the building, management company and point of
 * contact from what was typed. Building is matched by name or address —
 * preferring one under the named company — so a job never lands on a
 * building of the wrong company when the company was given.
 *
 * Form fields read: building_name, client_name, contact_name,
 * contact_phone, address, city, state, zip, region, latitude, longitude.
 */
export async function resolveQuickJobBuilding(formData: FormData): Promise<Building | null> {
  const buildingName = String(formData.get("building_name") ?? "").trim();
  const clientName = String(formData.get("client_name") ?? "").trim();
  const contactName = String(formData.get("contact_name") ?? "").trim();
  const contactPhone = String(formData.get("contact_phone") ?? "").trim();
  if (!buildingName) return null;

  const norm = (x: string) => x.trim().toLowerCase();
  const [buildings, clients, contacts, links] = await Promise.all([listBuildings(), listClientCompanies(), listContacts(), listBuildingContacts()]);

  // Management company: pick the existing one by name, or create it.
  let client = clientName ? clients.find((c) => norm(c.name) === norm(clientName)) : undefined;

  // Building: existing by name (preferring one under the named company),
  // otherwise created under the company — which then must be known.
  const nameMatches = buildings.filter((b) => norm(b.name) === norm(buildingName) || norm(b.address) === norm(buildingName));
  let building = client ? nameMatches.find((b) => b.client_company_id === client!.id) ?? nameMatches[0] : nameMatches[0];
  if (building && !client) client = clients.find((c) => c.id === building!.client_company_id);
  if (!building) {
    if (!client) {
      // No company given: file the building under the "Unassigned"
      // placeholder so the job can go ahead; it can be moved to the real
      // company from the building page later.
      client = clientName
        ? await createClientCompanyRecord({ name: clientName, type: "Property Management", active: true })
        : await getOrCreateUnassignedClient();
    }
    const latRaw = String(formData.get("latitude") ?? "");
    const lngRaw = String(formData.get("longitude") ?? "");
    const regionRaw = String(formData.get("region") ?? "");
    building = await createBuildingRecord({
      client_company_id: client.id,
      name: buildingName,
      address: String(formData.get("address") ?? "").trim() || buildingName,
      city: String(formData.get("city") ?? "").trim(),
      state: String(formData.get("state") ?? "").trim() || "NY",
      zip: String(formData.get("zip") ?? "").trim(),
      region: (BUILDING_REGIONS as readonly string[]).includes(regionRaw) ? (regionRaw as BuildingRegion) : "Other",
      latitude: latRaw ? Number(latRaw) : null,
      longitude: lngRaw ? Number(lngRaw) : null,
      active: true,
    });
  }

  // Point of contact: existing contact on this company by name, or a new
  // one; linked to the building (as its POC if it has none yet).
  if (contactName && client) {
    const clientId = client.id;
    let contact = contacts.find((c) => c.client_company_id === clientId && norm(`${c.first_name} ${c.last_name}`) === norm(contactName));
    if (!contact) {
      const parts = contactName.split(/\s+/);
      contact = await createContact({
        client_company_id: clientId,
        first_name: parts.length > 1 ? parts.slice(0, -1).join(" ") : parts[0],
        last_name: parts.length > 1 ? parts[parts.length - 1] : "",
        phone: contactPhone || undefined,
      });
    } else if (contactPhone && !contact.phone) {
      await updateContact(contact.id, { phone: contactPhone });
    }
    const buildingLinks = links.filter((l) => l.building_id === building!.id);
    if (!buildingLinks.some((l) => l.contact_id === contact!.id)) {
      const isPrimary = !buildingLinks.some((l) => l.is_primary);
      await createBuildingContact({ building_id: building.id, contact_id: contact.id, role: "Other", is_primary: isPrimary });
      if (!building.primary_contact_id) await updateBuilding(building.id, { primary_contact_id: contact.id });
    }
  }
  return building;
}
