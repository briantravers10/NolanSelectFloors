import { NextRequest, NextResponse } from "next/server";
import { searchDirectory } from "@/lib/db";

export interface SearchResult {
  type: string;
  label: string;
  sublabel?: string;
  href: string;
}

const RESULT_LIMIT = 20;

export async function GET(req: NextRequest) {
  const q = (req.nextUrl.searchParams.get("q") ?? "").trim();
  if (q.length < 2) return NextResponse.json({ results: [] });

  // Performance pass (see the audit report): the matching itself now
  // happens in Postgres (searchDirectory — per-column .ilike(), capped,
  // parallel) instead of fetching buildings/client_companies/contacts/
  // employees/projects in full on every keystroke. The result SHAPE and
  // ordering below are unchanged.
  const { buildings, clientCompanies, contacts, employees, projects } = await searchDirectory(q, RESULT_LIMIT);

  const results: SearchResult[] = [];
  const clientById = new Map(clientCompanies.map((c) => [c.id, c]));
  const buildingById = new Map(buildings.map((b) => [b.id, b]));

  for (const b of buildings) {
    const client = clientById.get(b.client_company_id);
    results.push({ type: "Building", label: b.name, sublabel: `${b.address}, ${b.city} · ${client?.name ?? ""}`, href: `/buildings/${b.id}` });
  }
  for (const c of clientCompanies) {
    results.push({ type: "Management Company", label: c.name, sublabel: c.phone, href: `/clients/${c.id}` });
  }
  for (const c of contacts) {
    const client = clientById.get(c.client_company_id ?? "");
    results.push({ type: "Contact", label: `${c.first_name} ${c.last_name}`, sublabel: `${c.title ?? ""} · ${client?.name ?? ""}`, href: `/clients/${client?.id ?? ""}` });
  }
  for (const e of employees) {
    results.push({ type: "Employee", label: `${e.first_name} ${e.last_name}`, sublabel: e.title, href: `/staff/${e.id}` });
  }
  for (const p of projects) {
    const building = buildingById.get(p.building_id);
    results.push({ type: "Project", label: p.name, sublabel: building?.name, href: `/projects/${p.id}` });
  }

  return NextResponse.json({ results: results.slice(0, RESULT_LIMIT) });
}
