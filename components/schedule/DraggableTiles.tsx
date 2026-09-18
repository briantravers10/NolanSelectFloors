"use client";

import { useState, useTransition, type ReactNode } from "react";
import { reorderScheduleAction } from "@/app/schedule/actions";

interface Item {
  projectId: string;
  color: string;
  node: ReactNode;
}

/**
 * Drag a tile to rearrange the day. Tiles can only move within their own
 * colour group — Yellow stays above Blue above Gray above Pink — so the
 * colour rule still wins; this just orders the jobs inside each band.
 * The new order is saved as soon as you drop.
 */
export function DraggableTiles({ date, items }: { date: string; items: Item[] }) {
  const [order, setOrder] = useState(items.map((i) => i.projectId));
  const [dragging, setDragging] = useState<string | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const byId = new Map(items.map((i) => [i.projectId, i]));
  const ids = order.filter((id) => byId.has(id)).concat(items.map((i) => i.projectId).filter((id) => !order.includes(id)));

  function drop(targetId: string) {
    if (!dragging || dragging === targetId) return;
    const from = byId.get(dragging);
    const to = byId.get(targetId);
    if (!from || !to || from.color !== to.color) return; // stay in your colour band
    const next = ids.filter((id) => id !== dragging);
    next.splice(next.indexOf(targetId), 0, dragging);
    setOrder(next);
    start(() => reorderScheduleAction(date, next));
  }

  return (
    <div className="flex flex-col gap-2">
      {ids.map((id) => {
        const item = byId.get(id)!;
        const isOver = over === id && dragging && dragging !== id && byId.get(dragging)?.color === item.color;
        return (
          <div
            key={id}
            draggable
            onDragStart={() => setDragging(id)}
            onDragEnd={() => { setDragging(null); setOver(null); }}
            onDragOver={(e) => { e.preventDefault(); setOver(id); }}
            onDragLeave={() => setOver((o) => (o === id ? null : o))}
            onDrop={(e) => { e.preventDefault(); drop(id); setOver(null); }}
            className={`relative rounded-xl transition-shadow ${dragging === id ? "opacity-50" : ""} ${isOver ? "ring-2 ring-sky-500 ring-offset-2" : ""}`}
          >
            <div className="absolute left-1 top-1/2 -translate-y-1/2 text-slate-400 cursor-grab select-none text-lg leading-none" title="Drag to rearrange (within its colour)">⋮⋮</div>
            <div className="pl-4">{item.node}</div>
          </div>
        );
      })}
      {pending && <div className="text-[11px] text-slate-500">Saving order…</div>}
    </div>
  );
}
