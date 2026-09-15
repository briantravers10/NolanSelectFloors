"use client";

// Generic "select that saves itself on change" control used for every
// quick inline dropdown on the schedule (color / COI / materials / job
// status / work type). Auto-submits via a hidden form — same pattern as
// components/ActingUserSelector.tsx.
import { useRef, useTransition } from "react";

export function InlineSelect({
  name,
  defaultValue,
  options,
  action,
  className = "",
}: {
  name: string;
  defaultValue: string;
  options: readonly string[] | { value: string; label: string }[];
  action: (formData: FormData) => void | Promise<void>;
  className?: string;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [isPending, startTransition] = useTransition();
  const opts = options.map((o) => (typeof o === "string" ? { value: o, label: o } : o));
  return (
    <form
      ref={formRef}
      action={(fd) => startTransition(() => action(fd))}
      onClick={(e) => e.stopPropagation()}
      className="inline-block"
    >
      <select
        name={name}
        defaultValue={defaultValue}
        disabled={isPending}
        onChange={(e) => {
          e.stopPropagation();
          formRef.current?.requestSubmit();
        }}
        onClick={(e) => e.stopPropagation()}
        className={`rounded-md border px-2 py-1 text-xs font-medium disabled:opacity-60 ${className}`}
      >
        {opts.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </form>
  );
}
