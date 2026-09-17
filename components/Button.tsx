"use client";

import type { ReactNode } from "react";
import { useFormStatus } from "react-dom";

/**
 * App-wide button. A type="submit" button inside a <form action={…}>
 * disables itself while that action is running, so a slow save can't be
 * double-tapped into two records (the "double client" problem).
 */
export function Button({
  children,
  variant = "primary",
  type = "button",
  onClick,
  className = "",
  disabled,
}: {
  children: ReactNode;
  variant?: "primary" | "secondary" | "danger";
  type?: "button" | "submit";
  onClick?: () => void;
  className?: string;
  disabled?: boolean;
}) {
  const { pending } = useFormStatus();
  const busy = type === "submit" && pending;
  const cls =
    variant === "primary"
      ? "bg-sky-600 text-white hover:bg-sky-700 disabled:bg-sky-300"
      : variant === "danger"
      ? "bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100"
      : "bg-white text-slate-700 border border-slate-300 hover:bg-slate-50";
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || busy}
      aria-busy={busy || undefined}
      className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-70 ${cls} ${className}`}
    >
      {busy ? "Saving…" : children}
    </button>
  );
}
