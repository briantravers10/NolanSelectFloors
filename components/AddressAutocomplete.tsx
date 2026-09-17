"use client";

import { useEffect, useRef, useState } from "react";
import { isGoogleMapsConfigured, loadGoogleMaps, resolveAddressComponents } from "@/lib/google-maps";
import type { ResolvedAddress } from "@/lib/google-maps";

/**
 * Street-address input with Google Places suggestions. Type a few
 * characters, pick a result, and `onResolved` gets the split-out street /
 * city / state / zip / area / lat-lng to fill sibling fields. With no
 * NEXT_PUBLIC_GOOGLE_MAPS_API_KEY it's just a normal text input — the
 * form still works, you just type the whole address yourself.
 *
 * Uses the current Places API (AutocompleteSuggestion + Place.fetchFields),
 * which is what new Google Maps keys are allowed to call; the legacy
 * Autocomplete widget is closed to new customers.
 */
export function AddressAutocomplete({
  name,
  defaultValue = "",
  value,
  onChange,
  onResolved,
  className = "input",
  placeholder = "Start typing the street address…",
  required,
}: {
  name: string;
  defaultValue?: string;
  value?: string;
  onChange?: (v: string) => void;
  onResolved: (a: ResolvedAddress) => void;
  className?: string;
  placeholder?: string;
  required?: boolean;
}) {
  const controlled = value !== undefined;
  const [inner, setInner] = useState(defaultValue);
  const text = controlled ? value : inner;
  const setText = (v: string) => {
    if (!controlled) setInner(v);
    onChange?.(v);
  };

  const [ready, setReady] = useState(false);
  const [open, setOpen] = useState(false);
  const [suggestions, setSuggestions] = useState<google.maps.places.AutocompleteSuggestion[]>([]);
  const [active, setActive] = useState(0);
  const tokenRef = useRef<google.maps.places.AutocompleteSessionToken | null>(null);
  const timerRef = useRef<number | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const skipNextFetch = useRef(false);

  useEffect(() => {
    if (!isGoogleMapsConfigured()) return;
    loadGoogleMaps().then(setReady);
  }, []);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  async function fetchSuggestions(q: string) {
    if (!ready || q.trim().length < 3) {
      setSuggestions([]);
      return;
    }
    try {
      const { AutocompleteSuggestion, AutocompleteSessionToken } = (await google.maps.importLibrary("places")) as google.maps.PlacesLibrary;
      if (!tokenRef.current) tokenRef.current = new AutocompleteSessionToken();
      const { suggestions: results } = await AutocompleteSuggestion.fetchAutocompleteSuggestions({
        input: q,
        sessionToken: tokenRef.current,
        includedRegionCodes: ["us"],
        // Bias toward the NYC metro so "220 East 72" finds Manhattan first.
        locationBias: { north: 41.2, south: 40.4, east: -73.4, west: -74.5 },
      });
      setSuggestions(results.filter((s) => s.placePrediction));
      setActive(0);
      setOpen(results.length > 0);
    } catch {
      setSuggestions([]);
    }
  }

  function handleInput(v: string) {
    setText(v);
    if (skipNextFetch.current) {
      skipNextFetch.current = false;
      return;
    }
    if (timerRef.current) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => fetchSuggestions(v), 250);
  }

  async function pick(s: google.maps.places.AutocompleteSuggestion) {
    const prediction = s.placePrediction;
    if (!prediction) return;
    setOpen(false);
    try {
      const place = prediction.toPlace();
      await place.fetchFields({ fields: ["addressComponents", "location", "formattedAddress"] });
      const resolved = resolveAddressComponents(place.addressComponents ?? [], place.location, place.formattedAddress ?? prediction.text.text);
      skipNextFetch.current = true;
      setText(resolved.address || prediction.text.text);
      onResolved(resolved);
    } catch {
      skipNextFetch.current = true;
      setText(prediction.text.text);
    } finally {
      tokenRef.current = null; // a session ends when a place is fetched
      setSuggestions([]);
    }
  }

  return (
    <div ref={wrapRef} className="relative">
      <input
        name={name}
        value={text}
        required={required}
        autoComplete="off"
        placeholder={ready ? placeholder : undefined}
        onChange={(e) => handleInput(e.target.value)}
        onFocus={() => suggestions.length > 0 && setOpen(true)}
        onKeyDown={(e) => {
          if (!open || suggestions.length === 0) return;
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setActive((a) => Math.min(a + 1, suggestions.length - 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((a) => Math.max(a - 1, 0));
          } else if (e.key === "Enter") {
            e.preventDefault();
            pick(suggestions[active]);
          } else if (e.key === "Escape") {
            setOpen(false);
          }
        }}
        className={className}
      />
      {open && suggestions.length > 0 && (
        <ul className="absolute z-30 left-0 right-0 mt-1 max-h-64 overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-lg text-sm">
          {suggestions.map((s, i) => {
            const p = s.placePrediction!;
            return (
              <li
                key={p.placeId}
                onMouseDown={(e) => {
                  e.preventDefault();
                  pick(s);
                }}
                onMouseEnter={() => setActive(i)}
                className={`px-3 py-2 cursor-pointer ${i === active ? "bg-sky-50 text-sky-900" : "text-slate-800"}`}
              >
                <div className="font-medium">{p.mainText?.text ?? p.text.text}</div>
                {p.secondaryText?.text && <div className="text-xs text-slate-500">{p.secondaryText.text}</div>}
              </li>
            );
          })}
          <li className="px-3 py-1 text-[10px] text-slate-400 text-right">Powered by Google</li>
        </ul>
      )}
    </div>
  );
}
