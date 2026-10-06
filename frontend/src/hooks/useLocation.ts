import { useCallback, useEffect, useState } from "react";
import { UserLocation } from "../types";

export type LocationStatus = "idle" | "asking" | "granted" | "denied" | "unsupported" | "error";

/** Gets the device location (browser permission prompt) and resolves it to a city name. */
export function useLocation(enabled: boolean) {
  const [location, setLocation] = useState<UserLocation | null>(null);
  const [status, setStatus] = useState<LocationStatus>("idle");

  const resolve = useCallback(async (lat: number, lng: number, source: "gps" | "manual", cityHint?: string) => {
    let city = cityHint || "";
    let display = "";
    try {
      const r = await fetch(`/api/geo/reverse?lat=${lat}&lng=${lng}`);
      const j = await r.json();
      city = city || j.city || "";
      display = j.display || "";
    } catch {
      /* marker still works without a name */
    }
    setLocation({ lat, lng, city, display, source });
  }, []);

  const request = useCallback(() => {
    if (!("geolocation" in navigator)) {
      setStatus("unsupported");
      return;
    }
    setStatus("asking");
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        await resolve(pos.coords.latitude, pos.coords.longitude, "gps");
        setStatus("granted");
      },
      (err) => setStatus(err.code === err.PERMISSION_DENIED ? "denied" : "error"),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 }
    );
  }, [resolve]);

  const setManual = useCallback(async (lat: number, lng: number, city: string) => {
    await resolve(lat, lng, "manual", city);
    setStatus("granted");
  }, [resolve]);

  useEffect(() => {
    if (enabled && status === "idle") request();
  }, [enabled, status, request]);

  return { location, status, request, setManual };
}
