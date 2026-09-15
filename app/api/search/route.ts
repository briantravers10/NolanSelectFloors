import { NextRequest, NextResponse } from "next/server";
import { listBuildings, listClientCompanies, listContacts, listEmployees, listProjects } from "@/lib/db";

export interface SearchResult {
  type: string;
  label: string;
  sublabel?: string;
  href: string;
}

export async function GET(req: NextRequest) {
  const q = (req.nextUrl.searchParams.get("q") ?? "").trim().toLowerCase();
  if (q.length < 2) return NextResponse.json({ results: [] });

  const [buildings, clientCompanies, contacts, employees, projects] = await Promise.all([
    listBuildings(),
    listClientCompanies(),
    listContacts(),
    listEmployees(),
    listProjects(),
  ]);

  const results: SearchResult[] = [];
  const clientById = new Map(clientCompanies.map((c) => [c.id, c]));
  const buildingById = new Map(buildings.map((b) => [b.id, b]));

  for (const b of buildings) {
    const client = clientById.get(b.client_company_id);
    const haystack = `${b.name} ${b.address} ${b.city} ${client?.name ?? ""}`.toLowerCase();
    if (haystack.includes(q)) {
      results.push({ type: "Building", label: b.name, sublabel: `${b.address}, ${b.city} · ${client?.name ?? ""}`, href: `/buildings/${b.id}` });
    }
  }
  for (const c of clientCompanies) {
    if (`${c.name} ${c.email ?? ""} ${c.phone ?? ""}`.toLowerCase().includes(q)) {
      results.push({ type: "Management Company", label: c.name, sublabel: c.phone, href: `/clients/${c.id}` });
    }
  }
  for (const c of contacts) {
    const client = clientById.get(c.client_company_id ?? "");
    const haystack = `${c.first_name} ${c.last_name} ${c.email ?? ""} ${c.phone ?? ""} ${client?.name ?? ""}`.toLowerCase();
    if (haystack.includes(q)) {
      results.push({ type: "Contact", label: `${c.first_name} ${c.last_name}`, sublabel: `${c.title ?? ""} · ${client?.name ?? ""}`, href: `/clients/${client?.id ?? ""}` });
    }
  }
  for (const e of employees) {
    if (`${e.first_name} ${e.last_name} ${e.phone ?? ""} ${e.title}`.toLowerCase().includes(q)) {
      results.push({ type: "Employee", label: `${e.first_name} ${e.last_name}`, sublabel: e.title, href: `/staff/${e.id}` });
    }
  }
  for (const p of projects) {
    const building = buildingById.get(p.building_id);
    const haystack = `${p.name} ${p.unit_number ?? ""} ${building?.name ?? ""}`.toLowerCase();
    if (haystack.includes(q)) {
      results.push({ type: "Project", label: p.name, sublabel: building?.name, href: `/projects/${p.id}` });
    }
  }

  return NextResponse.json({ results: results.slice(0, 20) });
}
