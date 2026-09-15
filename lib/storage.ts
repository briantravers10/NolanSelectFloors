// Photo storage abstraction. Attempts a real upload to Supabase Storage
// when a Supabase project is configured; when it isn't (the default in
// this environment — no live credentials), it fails soft: the caller gets
// back `{ unavailable: true }` and should save the progress entry anyway,
// showing an inline "Photo storage isn't configured yet" notice rather
// than crashing or pretending the image was saved. Never fabricates a
// persisted image.
import { randomUUID } from "crypto";
import { getSupabaseClient } from "./supabaseClient";

const BUCKET = process.env.SUPABASE_PHOTOS_BUCKET || "project-photos";

export interface PhotoUploadResult {
  storage_path?: string;
  unavailable: boolean;
  error?: string;
}

/**
 * Uploads a single photo file to Supabase Storage under
 * `<relatedType>/<relatedId>/<uuid>-<filename>`. Returns `unavailable: true`
 * (never throws) when Supabase isn't configured or the bucket doesn't
 * exist — both entirely expected in this environment.
 */
export async function uploadProjectPhoto(
  file: File,
  relatedType: string,
  relatedId: string
): Promise<PhotoUploadResult> {
  const client = getSupabaseClient();
  if (!client) {
    return { unavailable: true, error: "Supabase Storage is not configured (no NEXT_PUBLIC_SUPABASE_URL / key set)." };
  }
  try {
    const path = `${relatedType}/${relatedId}/${randomUUID()}-${file.name}`;
    const arrayBuffer = await file.arrayBuffer();
    const { error } = await client.storage.from(BUCKET).upload(path, arrayBuffer, {
      contentType: file.type || "application/octet-stream",
      upsert: false,
    });
    if (error) {
      return { unavailable: true, error: error.message };
    }
    return { storage_path: path, unavailable: false };
  } catch (err) {
    return { unavailable: true, error: err instanceof Error ? err.message : "Unknown storage error" };
  }
}

export function isPhotoStorageConfigured(): boolean {
  return getSupabaseClient() !== null;
}

const INVOICE_BUCKET = process.env.SUPABASE_INVOICES_BUCKET || "invoice-files";

/**
 * Same soft-fail pattern as uploadProjectPhoto above, for the Invoices
 * feature's "+ New Invoice" file field — `file_reference` is a placeholder
 * for a future Supabase Storage path. Returns `unavailable: true` (never
 * throws) when Supabase isn't configured or the bucket doesn't exist.
 */
export async function uploadInvoiceFile(file: File, invoiceId: string): Promise<PhotoUploadResult> {
  const client = getSupabaseClient();
  if (!client) {
    return { unavailable: true, error: "File storage is not configured (no NEXT_PUBLIC_SUPABASE_URL / key set)." };
  }
  try {
    const path = `invoices/${invoiceId}/${randomUUID()}-${file.name}`;
    const arrayBuffer = await file.arrayBuffer();
    const { error } = await client.storage.from(INVOICE_BUCKET).upload(path, arrayBuffer, {
      contentType: file.type || "application/octet-stream",
      upsert: false,
    });
    if (error) return { unavailable: true, error: error.message };
    return { storage_path: path, unavailable: false };
  } catch (err) {
    return { unavailable: true, error: err instanceof Error ? err.message : "Unknown storage error" };
  }
}

/** Generic "is Supabase Storage configured at all" check — same underlying
 * condition as isPhotoStorageConfigured, named for use outside the Photos
 * feature (e.g. the Invoices "+ New Invoice" file field). */
export function isFileStorageConfigured(): boolean {
  return getSupabaseClient() !== null;
}
