import { redirect } from "next/navigation";
import { listProjects } from "@/lib/db";
import { signedFileUrl } from "@/lib/storage";
import { requireSectionAccess } from "@/lib/permissions";

/** Opens the job's certificate of insurance (a short-lived signed link). */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  if ((await requireSectionAccess("schedule")) === "none" && (await requireSectionAccess("projects")) === "none") {
    return new Response("Not allowed", { status: 403 });
  }
  const { id } = await params;
  const project = (await listProjects()).find((p) => p.id === id);
  if (!project?.coi_file_reference) return new Response("No COI on file for this job", { status: 404 });
  const url = await signedFileUrl(project.coi_file_reference, "inbound-email");
  if (!url) return new Response("File storage isn't configured", { status: 503 });
  redirect(url);
}
