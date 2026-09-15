"use client";

import { useRef } from "react";
import { setActingUserAction } from "@/app/actions/acting-user";
import type { ActingUser } from "@/lib/current-user";

/**
 * Dev "acting as" selector — a placeholder for real per-user auth (see
 * README). Lets staff switch who they're "logged in as" so bid claiming,
 * locking and the manager-only reassign/release actions have someone
 * concrete to act as. Auto-submits on change via a hidden form.
 */
export function ActingUserSelector({ options, current }: { options: ActingUser[]; current: ActingUser }) {
  const formRef = useRef<HTMLFormElement>(null);
  return (
    <form ref={formRef} action={setActingUserAction} className="flex items-center gap-1.5 text-xs">
      <span className="text-slate-400 hidden lg:inline">Acting as</span>
      <select
        name="acting_user_id"
        defaultValue={current.id}
        onChange={() => formRef.current?.requestSubmit()}
        className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs font-medium text-slate-700"
      >
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.fullName}
            {o.role === "manager" ? " (Manager/Owner)" : " (Estimator)"}
          </option>
        ))}
      </select>
    </form>
  );
}
