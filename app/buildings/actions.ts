"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createBuildingRecord, updateBuilding } from "@/lib/db";
import type { BuildingRegion } from "@/lib/types";
import { canEdit } from "@/lib/permissions";

export async function createBuildingAction(formData: FormData) {
  if (!(await canEdit("buildings"))) return;
  const name = String(formData.get("name") ?? "").trim();
  const client_company_id = String(formData.get("client_company_id") ?? "");
  const address = String(formData.get("address") ?? "").trim();
  const city = String(formData.get("city") ?? "").trim();
  const state = String(formData.get("state") ?? "").trim();
  const zip = String(formData.get("zip") ?? "").trim();
  const region = String(formData.get("region") ?? "Other") as BuildingRegion;
  if (!name || !client_company_id || !address || !city || !state || !zip) return;

  const latRaw = String(formData.get("latitude") ?? "").trim();
  const lngRaw = String(formData.get("longitude") ?? "").trim();

  const building = await createBuildingRecord({
    name,
    client_company_id,
    address,
    city,
    state,
    zip,
    region,
    latitude: latRaw ? Number(latRaw) : null,
    longitude: lngRaw ? Number(lngRaw) : null,
    primary_contact_id: String(formData.get("primary_contact_id") ?? "") || undefined,
    superintendent_name: String(formData.get("superintendent_name") ?? "") || undefined,
    superintendent_phone: String(formData.get("superintendent_phone") ?? "") || undefined,
    access_instructions: String(formData.get("access_instructions") ?? "") || undefined,
    working_hours: String(formData.get("working_hours") ?? "") || undefined,
    coi_requirements: String(formData.get("coi_requirements") ?? "") || undefined,
    parking_loading: String(formData.get("parking_loading") ?? "") || undefined,
    elevator_info: String(formData.get("elevator_info") ?? "") || undefined,
    delivery_instructions: String(formData.get("delivery_instructions") ?? "") || undefined,
    building_rules: String(formData.get("building_rules") ?? "") || undefined,
    notes: String(formData.get("notes") ?? "") || undefined,
    active: formData.get("active") !== "off",
  });
  revalidatePath("/buildings");
  redirect(`/buildings/${building.id}`);
}

/** Move a building to a (different) management company — used to file
 * Quick Job buildings that started under the "Unassigned" placeholder. */
export async function setBuildingClientAction(buildingId: string, formData: FormData) {
  if (!(await canEdit("buildings"))) return;
  const client_company_id = String(formData.get("client_company_id") ?? "");
  if (!client_company_id) return;
  await updateBuilding(buildingId, { client_company_id });
  revalidatePath(`/buildings/${buildingId}`);
  revalidatePath("/buildings");
  revalidatePath("/clients");
  revalidatePath("/schedule");
}
