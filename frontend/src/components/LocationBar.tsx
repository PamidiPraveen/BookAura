import React, { useEffect, useState } from "react";
import { MapPin, Crosshair, Search, ChevronDown, ChevronUp } from "lucide-react";
import { UserLocation } from "../types";
import { LocationStatus } from "../hooks/useLocation";

interface Props {
  location: UserLocation | null;
  status: LocationStatus;
  onRetry: () => void;
  onManual: (lat: number, lng: number, city: string) => void;
}

export default function LocationBar({ location, status, onRetry, onManual }: Props) {
  const [showMap, setShowMap] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [q, setQ] = useState("");
  const [options, setOptions] = useState<{ name: string; state: string; lat: number; lng: number }[]>([]);

  // Debounced real-city autocomplete (OpenStreetMap, via backend)
  useEffect(() => {
    if (q.trim().length < 2) { setOptions([]); return; }
    const t = setTimeout(async () => {
      try {
        const r = await fetch(`/api/geo/cities?q=${encodeURIComponent(q)}`);
        setOptions((await r.json()).cities || []);
      } catch { setOptions([]); }
    }, 350);
    return () => clearTimeout(t);
  }, [q]);

  const label =
    status === "asking" ? "Detecting your location…"
    : location ? (location.city || `${location.lat.toFixed(3)}, ${location.lng.toFixed(3)}`)
    : status === "denied" ? "Location blocked — choose a city"
    : status === "unsupported" ? "Location not supported — choose a city"
    : "Location unavailable";

  const d = 0.02;
  const mapSrc = location
    ? `https://www.openstreetmap.org/export/embed.html?bbox=${location.lng - d},${location.lat - d * 0.6},${location.lng + d},${location.lat + d * 0.6}&layer=mapnik&marker=${location.lat},${location.lng}`
    : "";

  return (
    <div className="bg-white border-b border-slate-100 px-4 py-2 text-xs">
      <div className="flex items-center gap-2 flex-wrap">
        <MapPin size={14} className={location ? "text-orange-600" : "text-slate-400"} />
        <span className="font-bold text-slate-700">{label}</span>
        {location?.source === "gps" && (
          <span className="text-[9px] bg-green-50 text-green-700 font-bold px-1.5 py-0.5 rounded">LIVE GPS</span>
        )}
        <div className="ml-auto flex gap-1.5">
          <button onClick={onRetry} className="px-2 py-1 rounded border border-slate-200 hover:bg-orange-50 hover:text-orange-700 font-bold flex items-center gap-1 cursor-pointer">
            <Crosshair size={11} /> Use my location
          </button>
          <button onClick={() => setShowSearch(!showSearch)} className="px-2 py-1 rounded border border-slate-200 hover:bg-orange-50 hover:text-orange-700 font-bold flex items-center gap-1 cursor-pointer">
            <Search size={11} /> Change city
          </button>
          {location && (
            <button onClick={() => setShowMap(!showMap)} className="px-2 py-1 rounded border border-slate-200 hover:bg-orange-50 hover:text-orange-700 font-bold flex items-center gap-1 cursor-pointer">
              Map {showMap ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
            </button>
          )}
        </div>
      </div>

      {showSearch && (
        <div className="mt-2 relative">
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Type a city, e.g. Vijayawada"
            className="w-full border border-slate-200 rounded-lg px-3 py-1.5 outline-none focus:border-orange-400"
          />
          {options.length > 0 && (
            <ul className="absolute z-20 left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-48 overflow-auto">
              {options.map((c, i) => (
                <li key={i}>
                  <button
                    className="w-full text-left px-3 py-2 hover:bg-orange-50 cursor-pointer"
                    onClick={() => { onManual(c.lat, c.lng, c.name); setShowSearch(false); setQ(""); setOptions([]); }}
                  >
                    <strong>{c.name}</strong> <span className="text-slate-400">{c.state}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {showMap && location && (
        <iframe title="Your location" src={mapSrc} className="mt-2 w-full h-44 rounded-lg border border-slate-200" loading="lazy" />
      )}
    </div>
  );
}
