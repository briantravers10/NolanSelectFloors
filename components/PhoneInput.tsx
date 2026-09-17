"use client";

import { useState } from "react";
import { formatUsPhone } from "@/lib/phone";

/**
 * Phone field that formats as you type — 5550000001 becomes
 * +1 (555) 000-0001 — and submits the formatted value under `name`.
 * Anything longer than 10 digits (international, extensions) is left as
 * typed so nothing is silently mangled.
 */
export function PhoneInput({
  name,
  defaultValue = "",
  value,
  onChange,
  className = "input",
  placeholder = "+1 (555) 000-0001",
  required,
}: {
  name: string;
  defaultValue?: string;
  value?: string;
  onChange?: (v: string) => void;
  className?: string;
  placeholder?: string;
  required?: boolean;
}) {
  const [inner, setInner] = useState(() => formatUsPhone(defaultValue));
  const controlled = value !== undefined;
  const shown = controlled ? value : inner;
  return (
    <input
      type="tel"
      name={name}
      value={shown}
      required={required}
      inputMode="tel"
      autoComplete="tel"
      placeholder={placeholder}
      onChange={(e) => {
        const next = formatUsPhone(e.target.value);
        if (!controlled) setInner(next);
        onChange?.(next);
      }}
      className={className}
    />
  );
}
