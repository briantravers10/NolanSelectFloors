"use client";

// Dynamic-import wrapper — Leaflet touches `window` at import time, so the
// actual map component must never be part of server-side rendering.
import dynamic from "next/dynamic";
import type { MapPin } from "./BuildingMap";

const BuildingMap = dynamic(() => import("./BuildingMap").then((m) => m.BuildingMap), {
  ssr: false,
  loading: () => (
    <div className="rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-center text-sm text-slate-400" style={{ height: 420 }}>
      Loading map…
    </div>
  ),
});

export function BuildingMapLoader(props: { pins: MapPin[]; routeLine?: { lat: number; lng: number }[]; height?: number }) {
  return <BuildingMap {...props} />;
}
export type { MapPin };
