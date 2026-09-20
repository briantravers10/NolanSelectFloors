import { createHmac, timingSafeEqual } from "crypto";
import { createInboundEmail, fileInboundEmail, listBuildings, listInboundEmails, listProjects } from "@/lib/db";
import { uploadInboundAttachment } from "@/lib/storage";
import { classifyInbound, matchInboundToJob } from "@/lib/inbound";
import type { InboundAttachment } from "@/lib/types";

/**
 * Resend "email.received" webhook. Gmail forwards drawing/invoice emails
 * to the app's intake address; Resend calls this with the email id; we
 * fetch the email + attachments, copy the files to Supabase Storage,
 * work out which job it's about, and either file it straight away (when
 * the match is certain) or leave it in the Unfiled tray (/inbox).
 *
 * Env: RESEND_API_KEY (to read the email), RESEND_WEBHOOK_SECRET (to
 * verify the call really came from Resend — Svix-style signature).
 */
export const runtime = "nodejs";

function verify(body: string, headers: Headers): boolean {
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  if (!secret) return false;
  const id = headers.get("svix-id");
  const ts = headers.get("svix-timestamp");
  const sigHeader = headers.get("svix-signature");
  if (!id || !ts || !sigHeader) return false;
  // Reject anything older than 5 minutes (replay protection).
  if (Math.abs(Date.now() / 1000 - Number(ts)) > 300) return false;
  const key = Buffer.from(secret.replace(/^whsec_/, ""), "base64");
  const expected = createHmac("sha256", key).update(`${id}.${ts}.${body}`).digest("base64");
  return sigHeader.split(" ").some((part) => {
    const [, sig] = part.split(",");
    if (!sig) return false;
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    return a.length === b.length && timingSafeEqual(a, b);
  });
}

async function resend<T>(path: string): Promise<T | null> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  const res = await fetch(`https://api.resend.com${path}`, { headers: { Authorization: `Bearer ${key}` }, cache: "no-store" });
  if (!res.ok) return null;
  return (await res.json()) as T;
}

interface ReceivedEmail {
  id: string;
  from?: string;
  to?: string[] | string;
  subject?: string;
  text?: string;
  html?: string;
  created_at?: string;
  attachments?: { id: string; filename?: string; content_type?: string; size?: number }[];
}
interface ReceivedAttachment {
  id: string;
  filename?: string;
  content_type?: string;
  size?: number;
  download_url?: string;
}

function parseFrom(from: string | undefined): { email?: string; name?: string } {
  if (!from) return {};
  const m = /^(.*?)<([^>]+)>\s*$/.exec(from.trim());
  if (m) return { name: m[1].replace(/^"|"$/g, "").trim() || undefined, email: m[2].trim().toLowerCase() };
  return { email: from.trim().toLowerCase() };
}

export async function POST(request: Request) {
  const body = await request.text();
  if (!verify(body, request.headers)) return new Response("Bad signature", { status: 401 });

  let payload: { type?: string; data?: { email_id?: string; id?: string } };
  try {
    payload = JSON.parse(body);
  } catch {
    return new Response("Bad JSON", { status: 400 });
  }
  if (payload.type !== "email.received") return Response.json({ ok: true, skipped: payload.type });
  const emailId = payload.data?.email_id ?? payload.data?.id;
  if (!emailId) return new Response("No email id", { status: 400 });

  // Idempotent: Resend may retry.
  if ((await listInboundEmails()).some((e) => e.provider_email_id === emailId)) return Response.json({ ok: true, duplicate: true });

  const email = await resend<ReceivedEmail>(`/emails/receiving/${emailId}`);
  if (!email) return new Response("Could not fetch email (check RESEND_API_KEY)", { status: 502 });
  const listed = await resend<{ data?: ReceivedAttachment[] }>(`/emails/receiving/${emailId}/attachments`);
  const metas = listed?.data ?? email.attachments ?? [];

  const attachments: InboundAttachment[] = [];
  for (const a of metas) {
    const filename = a.filename ?? "attachment";
    let storage_path: string | undefined;
    const url = (a as ReceivedAttachment).download_url;
    if (url) {
      try {
        const res = await fetch(url);
        if (res.ok) {
          const up = await uploadInboundAttachment(await res.arrayBuffer(), filename, a.content_type, emailId);
          if (!up.unavailable) storage_path = up.storage_path;
        }
      } catch {
        // leave unsaved; the tray still shows the filename
      }
    }
    attachments.push({ id: a.id, filename, content_type: a.content_type, size: a.size, storage_path });
  }

  const { email: fromEmail, name: fromName } = parseFrom(email.from);
  const to = Array.isArray(email.to) ? email.to[0] : email.to;
  const text = email.text ?? (email.html ? email.html.replace(/<[^>]+>/g, " ") : "");
  const kind = classifyInbound(to, email.subject, text, attachments.map((a) => a.filename));
  const [buildings, projects] = await Promise.all([listBuildings(), listProjects()]);
  const match = matchInboundToJob(email.subject, text, buildings, projects);

  const record = await createInboundEmail({
    provider_email_id: emailId,
    from_email: fromEmail ?? null,
    from_name: fromName ?? null,
    to_email: to ?? null,
    subject: email.subject ?? null,
    text_preview: text.slice(0, 600) || null,
    received_at: email.created_at ?? new Date().toISOString(),
    kind,
    status: "unfiled",
    suggested_building_id: match.buildingId ?? null,
    suggested_project_id: match.projectId ?? null,
    attachments,
  });

  // File automatically only when we know the job AND the kind, and at
  // least one file was actually stored.
  if (match.confident && match.projectId && kind !== "unknown" && attachments.some((a) => a.storage_path)) {
    await fileInboundEmail(record.id, { kind, projectId: match.projectId, supplier: fromName ?? undefined }, "Email intake (auto)");
    return Response.json({ ok: true, filed: true, project: match.projectId });
  }
  return Response.json({ ok: true, filed: false });
}
