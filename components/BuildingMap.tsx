"use client";

// Leaflet + OpenStreetMap tiles map (free, no API key). Loaded as a client
// component with all Leaflet imports isolated here — the page importing
// this must use `next/dynamic` with `ssr: false`, since Leaflet touches
// `window` at import time and will crash during server rendering otherwise.
import { useMemo } from "react";
import { MapContainer, TileLayer, CircleMarker, Popup, Polyline } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import Link from "next/link";
import type { BuildingRegion } from "@/lib/types";

export interface MapPin {
  id: string;
  lat: number;
  lng: number;
  label: string;
  sublabel?: string;
  region: BuildingRegion;
  href?: string;
  order?: number; // route stop number, for the haul-away run map
}

const REGION_COLORS: Record<BuildingRegion, string> = {
  Manhattan: "#0284c7",
  Brooklyn: "#dc2626",
  Queens: "#16a34a",
  Bronx: "#d97706",
  "Staten Island": "#9333ea",
  "New Jersey": "#0891b2",
  "Long Island": "#db2777",
  Other: "#64748b",
};

export function BuildingMap({
  pins,
  routeLine,
  height = 420,
}: {
  pins: MapPin[];
  routeLine?: { lat: number; lng: number }[];
  height?: number;
}) {
  const center = useMemo<[number, number]>(() => {
    if (pins.length === 0) return [40.73, -73.99];
    const lat = pins.reduce((s, p) => s + p.lat, 0) / pins.length;
    const lng = pins.reduce((s, p) => s + p.lng, 0) / pins.length;
    return [lat, lng];
  }, [pins]);

  return (
    <div style={{ height }} className="rounded-xl overflow-hidden border border-slate-200">
      <MapContainer center={center} zoom={10} style={{ height: "100%", width: "100%" }} scrollWheelZoom={true}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {routeLine && routeLine.length > 1 && (
          <Polyline positions={routeLine.map((p) => [p.lat, p.lng])} pathOptions={{ color: "#0f172a", weight: 3, dashArray: "6 6" }} />
        )}
        {pins.map((p) => (
          <CircleMarker
            key={p.id}
            center={[p.lat, p.lng]}
            radius={9}
            pathOptions={{ color: "#fff", weight: 2, fillColor: REGION_COLORS[p.region], fillOpacity: 0.95 }}
          >
            <Popup>
              <div className="text-sm">
                {p.order !== undefined && <div className="font-semibold">Stop {p.order}</div>}
                <div className="font-medium">{p.label}</div>
                {p.sublabel && <div className="text-slate-500">{p.sublabel}</div>}
                <div className="text-xs text-slate-500 mt-1">{p.region}</div>
                {p.href && (
                  <Link href={p.href} className="text-sky-600 hover:underline text-xs">
                    Open →
                  </Link>
                )}
              </div>
            </Popup>
          </CircleMarker>
        ))}
      </MapContainer>
    </div>
  );
}

export { REGION_COLORS };
