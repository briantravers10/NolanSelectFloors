"use client";

import { setAgendaCompletedAction } from "@/app/agenda/actions";

/** Tick box that marks an agenda item done / not done straight away. */
export function AgendaDoneToggle({ id, done }: { id: string; done: boolean }) {
  return (
    <form action={setAgendaCompletedAction.bind(null, id, !done)} className="pt-0.5">
      <input
        type="checkbox"
        checked={done}
        onChange={(ev) => ev.currentTarget.form?.requestSubmit()}
        className="rounded border-slate-400 w-4 h-4 cursor-pointer"
        title={done ? "Mark not done" : "Mark done"}
      />
    </form>
  );
}
