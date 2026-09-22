import type { Building, Project, InboundKind } from "./types";
import { isActiveProjectStage } from "./calculations";

const COI_WORDS = ["certificate of insurance", "certificate of liability", "insurance certificate", "coi ", " coi", "coi_", "coi-", "acord", "certificate holder", "additional insured"];
const PO_WORDS = ["purchase order", "p.o. ", "po #", "po#", "po number", "work order"];
const BID_WORDS = ["request for proposal", "rfp", "request a quote", "request for quote", "please quote", "bid request", "invitation to bid", "can you bid", "send a bid", "pricing for", "estimate request", "request an estimate"];
const INVOICE_WORDS = ["invoice", "receipt", "bill", "statement", "payment due", "amount due"];
const DRAWING_WORDS = ["drawing", "drawings", "plan", "plans", "floor plan", "layout", "blueprint", "spec", "elevation", "cad"];
const DRAWING_EXT = [".dwg", ".dxf", ".rvt", ".skp"];

/** Drawing or invoice? Address first (drawings@ / invoices@), then words
 * in the subject/body, then file types. */
export function classifyInbound(to: string | undefined, subject: string | undefined, text: string | undefined, filenames: string[]): InboundKind {
  const addr = (to ?? "").toLowerCase();
  if (addr.startsWith("invoice")) return "invoice";
  if (addr.startsWith("drawing")) return "drawing";
  const hay = ` ${subject ?? ""} ${text ?? ""} `.toLowerCase();
  const names = filenames.map((f) => f.toLowerCase());
  if (addr.startsWith("coi") || addr.startsWith("insurance")) return "coi";
  // COI first: an insurance certificate email often also says "invoice"
  // or "estimate" in passing.
  if (COI_WORDS.some((w) => hay.includes(w)) || names.some((n) => /(^|[^a-z])coi([^a-z]|$)/.test(n) || n.includes("certificate") || n.includes("acord"))) return "coi";
  if (PO_WORDS.some((w) => hay.includes(w)) || names.some((n) => /(^|[^a-z])po[-_ ]?\d/.test(n) || n.includes("purchase_order") || n.includes("purchase order"))) return "purchase_order";
  if (BID_WORDS.some((w) => hay.includes(w))) return "bid";
  if (names.some((n) => DRAWING_EXT.some((e) => n.endsWith(e)))) return "drawing";
  if (INVOICE_WORDS.some((w) => hay.includes(w)) || names.some((n) => n.includes("invoice") || n.includes("receipt"))) return "invoice";
  if (DRAWING_WORDS.some((w) => hay.includes(w)) || names.some((n) => n.includes("plan") || n.includes("drawing"))) return "drawing";
  return "unknown";
}

function norm(s: string): string {
  return s
    .toLowerCase()
    .replace(/\b(street|st\.?|avenue|ave\.?|road|rd\.?|boulevard|blvd\.?|place|pl\.?|drive|dr\.?)\b/g, " ")
    .replace(/\b(east|e\.?)\b/g, "e")
    .replace(/\b(west|w\.?)\b/g, "w")
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export interface InboundMatch {
  buildingId?: string;
  projectId?: string;
  confident: boolean;
}

/**
 * Finds the building (and, when there's exactly one open job on it, the
 * job) an email is about, from the building name / street address in the
 * subject or body. "Confident" only when exactly one building matches.
 */
export function matchInboundToJob(subject: string | undefined, text: string | undefined, buildings: Building[], projects: Project[]): InboundMatch {
  const hay = norm(`${subject ?? ""} ${(text ?? "").slice(0, 4000)}`);
  if (!hay) return { confident: false };
  const hits = buildings.filter((b) => {
    if (!b.active) return false;
    const name = norm(b.name);
    const addr = norm(b.address);
    return (name.length >= 5 && hay.includes(name)) || (addr.length >= 5 && hay.includes(addr));
  });
  if (hits.length !== 1) return { confident: false, buildingId: hits[0]?.id };
  const building = hits[0];
  const open = projects.filter((p) => p.building_id === building.id && isActiveProjectStage(p));
  // Prefer a unit number mentioned in the text.
  const unitHit = open.find((p) => p.unit_number && hay.includes(norm(`unit ${p.unit_number}`)) || (p.unit_number && new RegExp(`\\b${p.unit_number.toLowerCase()}\\b`).test(hay)));
  const project = unitHit ?? (open.length === 1 ? open[0] : undefined);
  return { buildingId: building.id, projectId: project?.id, confident: Boolean(project) };
}
