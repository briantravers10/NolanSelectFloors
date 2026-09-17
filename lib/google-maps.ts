/**
 * Loads the Google Maps JavaScript API (Places library) once, in the
 * browser, from NEXT_PUBLIC_GOOGLE_MAPS_API_KEY. Resolves to false when no
 * key is configured so address fields quietly stay plain text inputs.
 */
let loader: Promise<boolean> | null = null;

export function isGoogleMapsConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY);
}

export function loadGoogleMaps(): Promise<boolean> {
  if (typeof window === "undefined") return Promise.resolve(false);
  const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  if (!key) return Promise.resolve(false);
  if (loader) return loader;
  loader = new Promise<boolean>((resolve) => {
    if (typeof window.google !== "undefined" && window.google.maps) {
      resolve(true);
      return;
    }
    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&v=weekly&loading=async&libraries=places`;
    script.async = true;
    script.onload = () => resolve(typeof window.google !== "undefined" && Boolean(window.google.maps));
    script.onerror = () => resolve(false);
    document.head.appendChild(script);
  });
  return loader;
}

export interface ResolvedAddress {
  address: string; // "220 East 72nd Street"
  city: string;
  state: string; // "NY"
  zip: string;
  region: string; // one of BUILDING_REGIONS
  latitude: number | null;
  longitude: number | null;
  formatted: string;
}

const COUNTY_TO_REGION: Record<string, string> = {
  "new york county": "Manhattan",
  "kings county": "Brooklyn",
  "queens county": "Queens",
  "bronx county": "Bronx",
  "richmond county": "Staten Island",
  "nassau county": "Long Island",
  "suffolk county": "Long Island",
};
const BOROUGHS = ["Manhattan", "Brooklyn", "Queens", "Bronx", "Staten Island"];

/** Turns Google's address components into our Building fields, including
 * the area (borough / NJ / Long Island) used for the map and haul-away
 * routing. */
export function resolveAddressComponents(
  components: ReadonlyArray<{ longText: string | null; shortText: string | null; types: string[] }>,
  location: { lat: () => number; lng: () => number } | null | undefined,
  formatted: string
): ResolvedAddress {
  const get = (type: string, short = false) => {
    const c = components.find((x) => x.types.includes(type));
    return (short ? c?.shortText : c?.longText) ?? "";
  };
  const streetNumber = get("street_number");
  const route = get("route");
  const sublocality = get("sublocality_level_1") || get("sublocality");
  const locality = get("locality") || get("postal_town");
  const county = get("administrative_area_level_2").toLowerCase();
  const state = get("administrative_area_level_1", true);
  const zip = get("postal_code");

  let region = "Other";
  if (state === "NJ") region = "New Jersey";
  else if (BOROUGHS.includes(sublocality)) region = sublocality;
  else if (BOROUGHS.includes(locality)) region = locality;
  else if (COUNTY_TO_REGION[county]) region = COUNTY_TO_REGION[county];

  // NYC addresses: Google puts the borough in sublocality and "New York" in
  // locality (or vice versa) — prefer the borough as the city, the way the
  // office writes addresses.
  const city = BOROUGHS.includes(sublocality) ? (sublocality === "Manhattan" ? "New York" : sublocality) : locality || sublocality;

  return {
    address: [streetNumber, route].filter(Boolean).join(" ") || formatted.split(",")[0] || "",
    city,
    state,
    zip,
    region,
    latitude: location ? location.lat() : null,
    longitude: location ? location.lng() : null,
    formatted,
  };
}
