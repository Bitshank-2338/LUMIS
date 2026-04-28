"use client";

import { useEffect, useRef, useState } from "react";
import { MapPin, AlertTriangle } from "lucide-react";

declare global {
  interface Window {
    google: any;
    initLumisMap?: () => void;
  }
}

const SEVERITY_COLOR: Record<string, string> = {
  CRITICAL: "#EF4444",
  HIGH: "#F97316",
  MEDIUM: "#F59E0B",
  LOW: "#10B981",
};

type Venue = {
  name: string;
  address: string;
  coordinates?: { lat: number; lng: number };
};

type Event = {
  event_id: string;
  crisis_type: string;
  severity: string;
  location?: { zone?: string; floor?: number };
  status: string;
};

export function VenueMap({
  venue,
  events,
}: {
  venue: Venue | null;
  events: Event[];
}) {
  const mapEl = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

  useEffect(() => {
    if (!apiKey) {
      setError("Google Maps API key not configured");
      return;
    }

    const checkAndReady = async () => {
      if (window.google?.maps?.Map) {
        setReady(true);
        return;
      }
      // wait for Map class to be importable
      if (window.google?.maps?.importLibrary) {
        try {
          await window.google.maps.importLibrary("maps");
          await window.google.maps.importLibrary("marker");
          setReady(true);
        } catch (e) {
          setError("Failed to import maps library");
        }
        return;
      }
    };

    if (window.google?.maps) {
      checkAndReady();
      return;
    }

    const existing = document.querySelector(
      'script[data-lumis-maps="1"]'
    ) as HTMLScriptElement | null;
    if (existing) {
      existing.addEventListener("load", () => checkAndReady());
      return;
    }
    const script = document.createElement("script");
    // NO loading=async — keeps Map constructor immediately available
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&v=weekly`;
    script.async = true;
    script.defer = true;
    script.dataset.lumisMaps = "1";
    script.onload = () => checkAndReady();
    script.onerror = () => setError("Failed to load Google Maps");
    document.head.appendChild(script);
  }, [apiKey]);

  useEffect(() => {
    if (!ready || !venue?.coordinates || !mapEl.current) return;
    if (mapRef.current) return;
    if (!window.google?.maps?.Map) {
      setError("Google Maps not yet ready");
      return;
    }

    try {
      mapRef.current = new window.google.maps.Map(mapEl.current, {
      center: venue.coordinates,
      zoom: 17,
      mapTypeId: "hybrid",
      disableDefaultUI: true,
      zoomControl: true,
      styles: [
        {
          featureType: "all",
          elementType: "labels.text.fill",
          stylers: [{ color: "#cbd5e1" }],
        },
      ],
    });

      new window.google.maps.Marker({
        position: venue.coordinates,
        map: mapRef.current,
        title: venue.name,
        icon: {
          path: window.google.maps.SymbolPath.CIRCLE,
          scale: 9,
          fillColor: "#06B6D4",
          fillOpacity: 0.95,
          strokeColor: "#FFFFFF",
          strokeWeight: 2,
        },
      });
    } catch (e: any) {
      setError(`Map init failed: ${e?.message || e}`);
    }
  }, [ready, venue]);

  useEffect(() => {
    if (!mapRef.current || !venue?.coordinates) return;
    markersRef.current.forEach((m) => m.setMap(null));
    markersRef.current = [];

    const active = events.filter(
      (e) => e.status === "ACTIVE" || e.status === "RESPONDING"
    );
    active.forEach((e, i) => {
      const angle = (i / Math.max(1, active.length)) * Math.PI * 2;
      const offset = 0.0003;
      const pos = {
        lat: venue.coordinates!.lat + Math.cos(angle) * offset,
        lng: venue.coordinates!.lng + Math.sin(angle) * offset,
      };
      const color = SEVERITY_COLOR[e.severity] || "#F59E0B";
      const marker = new window.google.maps.Marker({
        position: pos,
        map: mapRef.current,
        animation: window.google.maps.Animation.BOUNCE,
        icon: {
          path: window.google.maps.SymbolPath.CIRCLE,
          scale: 12,
          fillColor: color,
          fillOpacity: 0.85,
          strokeColor: "#FFFFFF",
          strokeWeight: 2,
        },
        title: `${e.crisis_type} · ${e.severity} · ${
          e.location?.zone || ""
        }`,
      });
      markersRef.current.push(marker);
    });
  }, [events, venue]);

  if (error) {
    return (
      <FallbackMap venue={venue} events={events} note={error} />
    );
  }

  if (!apiKey) {
    return (
      <FallbackMap
        venue={venue}
        events={events}
        note="Set NEXT_PUBLIC_GOOGLE_MAPS_API_KEY for live map"
      />
    );
  }

  return (
    <div className="relative rounded-xl overflow-hidden border border-border h-72">
      <div ref={mapEl} className="w-full h-full" />
      <div className="absolute top-2 left-2 px-2.5 py-1 rounded-md bg-background/80 backdrop-blur text-[11px] flex items-center gap-1.5 border border-border">
        <MapPin className="w-3 h-3 text-accent-glow" />
        <span className="font-medium">{venue?.name}</span>
      </div>
      {events.length > 0 && (
        <div className="absolute bottom-2 right-2 px-2.5 py-1 rounded-md bg-background/80 backdrop-blur text-[11px] flex items-center gap-1.5 border border-severity-critical/40">
          <AlertTriangle className="w-3 h-3 text-severity-critical" />
          <span>
            {events.filter((e) => e.status !== "RESOLVED").length} on map
          </span>
        </div>
      )}
    </div>
  );
}

function FallbackMap({
  venue,
  events,
  note,
}: {
  venue: Venue | null;
  events: Event[];
  note: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-gradient-to-br from-background to-elevated/40 p-4 h-72 relative overflow-hidden">
      <div className="absolute inset-0 opacity-10">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,.08) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.08) 1px, transparent 1px)",
            backgroundSize: "40px 40px",
          }}
        />
      </div>
      <div className="relative">
        <div className="flex items-center gap-2 text-sm font-semibold mb-1">
          <MapPin className="w-4 h-4 text-accent-glow" />
          {venue?.name || "Venue"}
        </div>
        <div className="text-xs text-slate-500">
          {venue?.address || "—"}
        </div>
        <div className="text-[11px] text-slate-600 mt-1">{note}</div>

        <div className="mt-4 grid grid-cols-3 gap-2">
          {events
            .filter((e) => e.status !== "RESOLVED")
            .slice(0, 6)
            .map((e) => (
              <div
                key={e.event_id}
                className="p-2 rounded-lg border text-[11px]"
                style={{
                  borderColor: SEVERITY_COLOR[e.severity] + "55",
                  background: SEVERITY_COLOR[e.severity] + "12",
                }}
              >
                <div className="font-medium">{e.crisis_type}</div>
                <div className="text-slate-400">
                  {e.location?.zone || "?"} · {e.severity}
                </div>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}
