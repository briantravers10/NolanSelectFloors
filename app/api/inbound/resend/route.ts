import { createHmac, timingSafeEqual } from "crypto";
import PostalMime from "postal-mime";
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

interface IncomingFile {
  id: string;
  filename: string;
  content_type?: string;
  size?: number;
  bytes: ArrayBuffer | null;
}

interface Incoming {
  providerId: string;
  from?: string;
  to?: string;
  subject?: string;
  text: string;
  receivedAt: string;
  files: IncomingFile[];
}

const EML = /\.eml$/i;

/**
 * One email → one inbound_emails row (+ auto-file when the job is certain).
 * Used for the email Resend delivered AND for each original email found
 * inside a Gmail "Forward as attachment" bundle (.eml files), so a batch
 * of old drawings/invoices lands as separate, individually filed items.
 */
async function intake(inc: Incoming, buildings: Awaited<ReturnType<typeof listBuildings>>, projects: Awaited<ReturnType<typeof listProjects>>) {
  const attachments: InboundAttachment[] = [];
  for (const f of inc.files) {
    let storage_path: string | undefined;
    if (f.bytes) {
      try {
        const up = await uploadInboundAttachment(f.bytes, f.filename, f.content_type, inc.providerId.replace(/[^a-zA-Z0-9_-]+/g, "_"));
        if (!up.unavailable) storage_path = up.storage_path;
      } catch {
        // leave unsaved; the tray still shows the filename
      }
    }
    attachments.push({ id: f.id, filename: f.filename, content_type: f.content_type, size: f.size, storage_path });
  }

  const { email: fromEmail, name: fromName } = parseFrom(inc.from);
  const kind = classifyInbound(inc.to, inc.subject, inc.text, attachments.map((a) => a.filename));
  const match = matchInboundToJob(inc.subject, inc.text, buildings, projects);

  const record = await createInboundEmail({
    provider_email_id: inc.providerId,
    from_email: fromEmail ?? null,
    from_name: fromName ?? null,
    to_email: inc.to ?? null,
    subject: inc.subject ?? null,
    text_preview: inc.text.slice(0, 600) || null,
    received_at: inc.receivedAt,
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
    return { filed: true, project: match.projectId };
  }
  return { filed: false };
}

/** Parse a .eml (an original email Gmail bundled with "Forward as attachment"). */
async function unpackEml(bytes: ArrayBuffer, providerId: string, index: number, fallbackReceivedAt: string): Promise<Incoming | null> {
  try {
    const parsed = await PostalMime.parse(bytes);
    const from = parsed.from ? (parsed.from.name ? `${parsed.from.name} <${parsed.from.address ?? ""}>` : parsed.from.address ?? undefined) : undefined;
    const to = parsed.to?.[0]?.address;
    const text = parsed.text ?? (parsed.html ? parsed.html.replace(/<[^>]+>/g, " ") : "");
    const files: IncomingFile[] = (parsed.attachments ?? [])
      .filter((a) => a.content && !(a.filename ?? "").match(EML))
      .map((a, i) => {
        const content = a.content;
        const bytesOut = typeof content === "string" ? new TextEncoder().encode(content).buffer : content instanceof Uint8Array ? content.buffer.slice(content.byteOffset, content.byteOffset + content.byteLength) : content;
        return { id: `${providerId}:${index}:${i}`, filename: a.filename || `attachment-${i + 1}`, content_type: a.mimeType, size: bytesOut.byteLength, bytes: bytesOut as ArrayBuffer };
      });
    return {
      providerId: `${providerId}:eml:${index}`,
      from,
      to,
      subject: parsed.subject ?? undefined,
      text,
      receivedAt: parsed.date ? new Date(parsed.date).toISOString() : fallbackReceivedAt,
      files,
    };
  } catch {
    return null;
  }
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
  if ((await listInboundEmails()).some((e) => e.provider_email_id === emailId || e.provider_email_id.startsWith(`${emailId}:eml:`))) {
    return Response.json({ ok: true, duplicate: true });
  }

  const email = await resend<ReceivedEmail>(`/emails/receiving/${emailId}`);
  if (!email) return new Response("Could not fetch email (check RESEND_API_KEY)", { status: 502 });
  const listed = await resend<{ data?: ReceivedAttachment[] }>(`/emails/receiving/${emailId}/attachments`);
  const metas = listed?.data ?? email.attachments ?? [];

  const receivedAt = email.created_at ?? new Date().toISOString();
  const [buildings, projects] = await Promise.all([listBuildings(), listProjects()]);

  // Download every attachment once; .eml bundles get unpacked into their
  // own intake items, everything else stays with this email.
  const own: IncomingFile[] = [];
  const bundled: Incoming[] = [];
  for (const a of metas) {
    const filename = a.filename ?? "attachment";
    let bytes: ArrayBuffer | null = null;
    const url = (a as ReceivedAttachment).download_url;
    if (url) {
      try {
        const res = await fetch(url);
        if (res.ok) bytes = await res.arrayBuffer();
      } catch {
        bytes = null;
      }
    }
    const isEml = EML.test(filename) || a.content_type === "message/rfc822";
    if (isEml && bytes) {
      const inner = await unpackEml(bytes, emailId, bundled.length + 1, receivedAt);
      if (inner) {
        bundled.push(inner);
        continue;
      }
    }
    own.push({ id: a.id, filename, content_type: a.content_type, size: a.size, bytes });
  }

  const results: { filed: boolean; project?: string }[] = [];
  for (const inner of bundled) {
    if (inner.files.length === 0) continue; // an original with no attachment — nothing to file
    results.push(await intake(inner, buildings, projects));
  }

  // The wrapper email itself: only worth keeping when it carried files of
  // its own (a plain "forward as attachment" wrapper has nothing else).
  const to = Array.isArray(email.to) ? email.to[0] : email.to;
  const text = email.text ?? (email.html ? email.html.replace(/<[^>]+>/g, " ") : "");
  if (own.length > 0 || bundled.length === 0) {
    results.push(await intake({ providerId: emailId, from: email.from, to, subject: email.subject, text, receivedAt, files: own }, buildings, projects));
  }

  return Response.json({ ok: true, items: results.length, filed: results.filter((r) => r.filed).length, unpacked: bundled.length });
}
