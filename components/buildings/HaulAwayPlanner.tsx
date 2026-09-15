"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { Card, Button, EmptyState } from "@/components/ui";
import { BuildingMapLoader, type MapPin } from "@/components/BuildingMapLoader";
import { nearestNeighborRoute, estimateMinutes, type Stop } from "@/lib/routing";
import type { BuildingRegion } from "@/lib/types";
import { computeLiveRouteAction } from "@/app/buildings/haul-away/actions";

export interface HaulCandidate {
  projectId: string;
  projectName: string;
  unitNumber?: string;
  buildingName: string;
  buildingHref: string;
  clientName?: string;
  region: BuildingRegion;
  lat: number;
  lng: number;
}

export function HaulAwayPlanner({ candidates, liveRoutingConfigured }: { candidates: HaulCandidate[]; liveRoutingConfigured: boolean }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [liveResult, setLiveResult] = useState<Awaited<ReturnType<typeof computeLiveRouteAction>> | null>(null);
  const [pending, startTransition] = useTransition();

  const chosen = candidates.filter((c) => selected.has(c.projectId));
  const stops: Stop[] = useMemo(
    () => chosen.map((c) => ({ id: c.projectId, label: `${c.buildingName}${c.unitNumber ? ` — ${c.unitNumber}` : ""}`, lat: c.lat, lng: c.lng })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [selected, candidates]
  );
  const route = useMemo(() => nearestNeighborRoute(stops), [stops]);
  const roughMinutes = estimateMinutes(route.totalMiles);

  function toggle(id: string) {
    setLiveResult(null);
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function fetchLiveRoute() {
    startTransition(async () => {
      const result = await computeLiveRouteAction(stops);
      setLiveResult(result);
    });
  }

  const pins: MapPin[] = route.order.map((s, i) => {
    const c = chosen.find((x) => x.projectId === s.id)!;
    return { id: s.id, lat: s.lat, lng: s.lng, label: s.label, sublabel: c.clientName, region: c.region, href: c.buildingHref, order: i + 1 };
  });

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
      <Card className="p-4 lg:col-span-1 h-fit">
        <h2 className="text-sm font-semibold text-slate-900 uppercase tracking-wide mb-3">Select Stops</h2>
        {candidates.length === 0 ? (
          <EmptyState message="No active projects with map coordinates found." />
        ) : (
          <div className="space-y-1.5 max-h-[28rem] overflow-y-auto">
            {candidates.map((c) => (
              <label key={c.projectId} className="flex items-start gap-2 text-sm border border-slate-100 rounded-lg p-2 hover:border-sky-200 cursor-pointer">
                <input type="checkbox" checked={selected.has(c.projectId)} onChange={() => toggle(c.projectId)} className="mt-0.5 rounded border-slate-300" />
                <span>
                  <span className="block font-medium text-slate-800">{c.buildingName}{c.unitNumber ? ` — ${c.unitNumber}` : ""}</span>
                  <span className="block text-xs text-slate-500">{c.clientName} · {c.region}</span>
                </span>
              </label>
            ))}
          </div>
        )}
      </Card>

      <div className="lg:col-span-2 space-y-4">
        <BuildingMapLoader pins={pins} routeLine={route.order.map((s) => ({ lat: s.lat, lng: s.lng }))} />

        <Card className="p-4">
          <h2 className="text-sm font-semibold text-slate-900 uppercase tracking-wide mb-3">Route Summary</h2>
          {stops.length < 2 ? (
            <EmptyState message="Select at least 2 stops to compute a route." />
          ) : (
            <>
              <div className="mb-3">
                <div className="text-xs font-semibold text-slate-500 uppercase mb-1">Stop Order (nearest-neighbor)</div>
                <ol className="text-sm text-slate-700 space-y-1">
                  {route.order.map((s, i) => (
                    <li key={s.id}>{i + 1}. {s.label}</li>
                  ))}
                </ol>
              </div>

              {liveResult?.route ? (
                <div className="rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-2 text-sm text-emerald-800 mb-3">
                  <strong>Live route ({liveResult.route.provider}):</strong> {liveResult.route.totalMiles.toFixed(1)} miles · ~{liveResult.route.totalMinutes} min driving
                </div>
              ) : (
                <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-sm text-amber-800 mb-3">
                  <strong>Estimated (no live routing configured yet):</strong> {route.totalMiles.toFixed(1)} straight-line miles · ~{roughMinutes} min at an assumed 18 mph average city driving speed.
                  This is a rough estimate — not a real turn-by-turn route.
                </div>
              )}

              <div className="flex items-center gap-2">
                <Button onClick={fetchLiveRoute} disabled={pending || stops.length < 2} variant="secondary">
                  {pending ? "Checking…" : "Get Live Driving Route"}
                </Button>
                {!liveRoutingConfigured && (
                  <span className="text-xs text-slate-500">
                    No ROUTING_PROVIDER configured — this will just confirm the estimate above. See README to add a Google Maps or Mapbox key.
                  </span>
                )}
              </div>
            </>
          )}
        </Card>

        <p className="text-xs text-slate-500">
          Building addresses that have map coordinates saved show up here. Add or edit a building&apos;s latitude/longitude on{" "}
          <Link href="/buildings/new" className="text-sky-600 hover:underline">New Building</Link> (or its detail page) to include it in future runs.
        </p>
      </div>
    </div>
  );
}
