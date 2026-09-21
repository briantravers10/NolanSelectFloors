import "server-only";

/**
 * Outbound email through Resend's REST API, from the verified
 * trellis-app.com domain. Used for password-reset codes. Returns false
 * (never throws) when RESEND_API_KEY isn't set or the send fails, so
 * callers can fall back gracefully.
 */
const FROM = process.env.APP_EMAIL_FROM || "Nolan Select Floors <noreply@trellis-app.com>";

export function isEmailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY);
}

export async function sendEmail(to: string, subject: string, text: string): Promise<boolean> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return false;
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: FROM, to: [to], subject, text }),
    });
    return res.ok;
  } catch {
    return false;
  }
}
