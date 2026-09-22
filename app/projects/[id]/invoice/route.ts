import { redirect } from "next/navigation";
import { listProjectOutboundInvoices } from "@/lib/db";
import { signedFileUrl } from "@/lib/storage";
import { requireSectionAccess } from "@/lib/permissions";

/** Opens the job's CURRENT outbound invoice (a short-lived signed link). */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  if ((await requireSectionAccess("schedule")) === "none" && (await requireSectionAccess("projects")) === "none") {
    return new Response("Not allowed", { status: 403 });
  }
  const { id } = await params;
  const current = (await listProjectOutboundInvoices()).find((i) => i.project_id === id && i.is_current);
  if (!current) return new Response("No outbound invoice on file for this job", { status: 404 });
  if (!current.file_reference) return new Response("This invoice was filed without a file", { status: 404 });
  const url = await signedFileUrl(current.file_reference, "inbound-email");
  if (!url) return new Response("File storage isn't configured", { status: 503 });
  redirect(url);
}
