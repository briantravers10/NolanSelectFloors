/**
 * US phone formatting: any string of digits → "+1 (555) 000-0001". Used by
 * the PhoneInput while typing and by PhoneLink for numbers saved before
 * formatting existed. Non-US / unrecognisable input is returned as typed.
 */
export function formatUsPhone(raw: string): string {
  // Strip our own "+1" prefix first so re-formatting a partially typed
  // value (backspacing through "+1 (555") doesn't count the 1 as a digit.
  const body = raw.trim().startsWith("+1") ? raw.trim().slice(2) : raw;
  let digits = body.replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("1") && body === raw) digits = digits.slice(1);
  if (digits.length > 10) return raw.trim(); // international / extension — leave alone
  if (digits.length === 0) return "";
  const a = digits.slice(0, 3);
  const b = digits.slice(3, 6);
  const c = digits.slice(6, 10);
  let out = "+1 (" + a;
  if (digits.length > 3) out += ")";
  if (b) out += " " + b;
  if (c) out += "-" + c;
  return out;
}

/** "+1 (555) 000-0001" → "+15550000001" for tel: links. */
export function phoneHref(raw: string): string {
  const digits = raw.replace(/[^\d+]/g, "");
  if (/^\d{10}$/.test(digits)) return `tel:+1${digits}`;
  return `tel:${digits}`;
}
