// Debris/haul-away run routing.
//
// Two layers, deliberately separated:
//   1. A haversine + nearest-neighbor ESTIMATE — pure math, no external
//      calls, works today with zero configuration.
//   2. A real turn-by-turn driving route behind `getDrivingRoute()`, which
//      calls Google Maps Directions or Mapbox Directions when an API key
//      is configured (see README for exactly which env vars + where to get
//      keys), and returns null when it isn't — callers must fall back to
//      the estimate and clearly label it as such. This never throws and
//      never crashes the page when no key is present; it just returns null.

export interface LatLng {
  lat: number;
  lng: number;
}

export interface Stop extends LatLng {
  id: string;
  label: string;
}

const EARTH_RADIUS_MILES = 3958.8;

/** Great-circle distance between two points, in miles. */
export function haversineMiles(a: LatLng, b: LatLng): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_MILES * Math.asin(Math.min(1, Math.sqrt(h)));
}

export interface RouteLeg {
  from: Stop;
  to: Stop;
  distanceMiles: number;
}

export interface NearestNeighborRoute {
  order: Stop[];
  legs: RouteLeg[];
  totalMiles: number;
}

/**
 * Naive nearest-neighbor route: start at the first stop given, then
 * repeatedly jump to whichever remaining stop is closest in a straight
 * line. Not optimal (that's the traveling-salesman problem), but a
 * reasonable, instant, zero-dependency ordering for a same-day debris run.
 */
export function nearestNeighborRoute(stops: Stop[]): NearestNeighborRoute {
  if (stops.length === 0) return { order: [], legs: [], totalMiles: 0 };
  const remaining = stops.slice(1);
  const order: Stop[] = [stops[0]];
  let current = stops[0];
  while (remaining.length > 0) {
    let bestIdx = 0;
    let bestDist = Infinity;
    for (let i = 0; i < remaining.length; i++) {
      const d = haversineMiles(current, remaining[i]);
      if (d < bestDist) {
        bestDist = d;
        bestIdx = i;
      }
    }
    const [next] = remaining.splice(bestIdx, 1);
    order.push(next);
    current = next;
  }
  const legs: RouteLeg[] = [];
  for (let i = 0; i < order.length - 1; i++) {
    legs.push({ from: order[i], to: order[i + 1], distanceMiles: haversineMiles(order[i], order[i + 1]) });
  }
  return { order, legs, totalMiles: legs.reduce((s, l) => s + l.distanceMiles, 0) };
}

/** Rough time estimate for the fallback estimate — clearly labeled as such
 * wherever it's shown. Assumes a modest average speed to account for city
 * driving, stops, and load/unload time between addresses. */
const ASSUMED_AVG_SPEED_MPH = 18;
export function estimateMinutes(miles: number): number {
  return Math.round((miles / ASSUMED_AVG_SPEED_MPH) * 60);
}

export interface DrivingRouteResult {
  provider: "google" | "mapbox";
  order: Stop[];
  totalMiles: number;
  totalMinutes: number;
  estimated: false;
}

export type RouteResult =
  | (DrivingRouteResult & { estimated: false })
  | (NearestNeighborRoute & { estimated: true; totalMinutes: number; provider: "estimate" });

/**
 * Real turn-by-turn driving route + ETA, via whichever provider is
 * configured. Reads `ROUTING_PROVIDER` ("google" | "mapbox") plus the
 * matching API key/token from the environment. Returns null — never
 * throws — when no provider is configured or the call fails, so callers
 * can cleanly fall back to `nearestNeighborRoute()` and label it as an
 * estimate. See README for where to obtain each provider's key.
 */
export async function getDrivingRoute(stops: Stop[]): Promise<DrivingRouteResult | null> {
  if (stops.length < 2) return null;
  const provider = process.env.ROUTING_PROVIDER;
  try {
    if (provider === "google" && process.env.GOOGLE_MAPS_API_KEY) {
      return await routeViaGoogle(stops, process.env.GOOGLE_MAPS_API_KEY);
    }
    if (provider === "mapbox" && process.env.MAPBOX_ACCESS_TOKEN) {
      return await routeViaMapbox(stops, process.env.MAPBOX_ACCESS_TOKEN);
    }
  } catch {
    // Any provider/network failure falls back to the estimate — never
    // crash the haul-away run page for a missing/misbehaving routing call.
    return null;
  }
  return null;
}

async function routeViaGoogle(stops: Stop[], apiKey: string): Promise<DrivingRouteResult | null> {
  const origin = stops[0];
  const destination = stops[stops.length - 1];
  const waypoints = stops.slice(1, -1).map((s) => `${s.lat},${s.lng}`).join("|");
  const params = new URLSearchParams({
    origin: `${origin.lat},${origin.lng}`,
    destination: `${destination.lat},${destination.lng}`,
    key: apiKey,
  });
  if (waypoints) params.set("waypoints", `optimize:true|${waypoints}`);
  const res = await fetch(`https://maps.googleapis.com/maps/api/directions/json?${params.toString()}`);
  if (!res.ok) return null;
  const data = await res.json();
  if (data.status !== "OK" || !data.routes?.[0]) return null;
  const legs = data.routes[0].legs as { distance: { value: number }; duration: { value: number } }[];
  const totalMiles = legs.reduce((s, l) => s + l.distance.value, 0) / 1609.34;
  const totalMinutes = Math.round(legs.reduce((s, l) => s + l.duration.value, 0) / 60);
  return { provider: "google", order: stops, totalMiles, totalMinutes, estimated: false };
}

async function routeViaMapbox(stops: Stop[], token: string): Promise<DrivingRouteResult | null> {
  const coords = stops.map((s) => `${s.lng},${s.lat}`).join(";");
  const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${coords}?access_token=${token}&overview=false`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const data = await res.json();
  const route = data.routes?.[0];
  if (!route) return null;
  return {
    provider: "mapbox",
    order: stops,
    totalMiles: route.distance / 1609.34,
    totalMinutes: Math.round(route.duration / 60),
    estimated: false,
  };
}

export function isLiveRoutingConfigured(): boolean {
  const provider = process.env.ROUTING_PROVIDER;
  if (provider === "google") return !!process.env.GOOGLE_MAPS_API_KEY;
  if (provider === "mapbox") return !!process.env.MAPBOX_ACCESS_TOKEN;
  return false;
}
