"use client";
// components/rider/DemandHeatmap.tsx
// Heatmap of demand zones — PRD §3.9
// Requires: @vis.gl/react-google-maps (or @react-google-maps/api)
// Ensure NEXT_PUBLIC_GOOGLE_MAPS_API_KEY is set in your environment.

import { useEffect, useRef } from "react";
import { useRiderDashboardStore } from "@/store/riderDashboardStore";

declare global {
  interface Window {
    google: typeof google;
  }
}

// Default center: Nairobi CBD
const DEFAULT_CENTER = { lat: -1.2921, lng: 36.8219 };
const DEFAULT_ZOOM = 12;

export function DemandHeatmap() {
  const { heatmapPoints, riderStatus } = useRiderDashboardStore();
  const mapRef = useRef<HTMLDivElement>(null);
  const googleMapRef = useRef<any>(null);
  const heatmapLayerRef = useRef<any>(null);

  useEffect(() => {
    if (!mapRef.current) return;

    // Load Google Maps script lazily
    const initMap = () => {
      const map = new window.google.maps.Map(mapRef.current!, {
        center: DEFAULT_CENTER,
        zoom: DEFAULT_ZOOM,
        mapTypeId: "roadmap",
        disableDefaultUI: true,
        zoomControl: true,
        styles: DARK_MAP_STYLES,
      });

      googleMapRef.current = map;

      const heatmapData = heatmapPoints.map(
        (p) => ({
          location: new window.google.maps.LatLng(p.lat, p.lng),
          weight: p.weight,
        })
      );

      // @ts-expect-error Google maps types missing constructor args
      const heatmapLayer = new window.google.maps.visualization.HeatmapLayer({
        data: heatmapData,
        map,
        radius: 30,
        opacity: 0.75,
        gradient: [
          "rgba(16, 185, 129, 0)",   // transparent
          "rgba(16, 185, 129, 1)",   // emerald
          "rgba(251, 191, 36, 1)",   // amber
          "rgba(239, 68, 68, 1)",    // red (hottest)
        ],
      });

      heatmapLayerRef.current = heatmapLayer;
    };

    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      console.warn("[DemandHeatmap] NEXT_PUBLIC_GOOGLE_MAPS_API_KEY not set");
      return;
    }

    if (window.google?.maps) {
      initMap();
      return;
    }

    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=visualization`;
    script.async = true;
    script.onload = initMap;
    document.head.appendChild(script);

    return () => {
      // Clean up heatmap layer on unmount
      heatmapLayerRef.current?.setMap(null);
    };
  }, []); // mount once

  // Update heatmap data when points change
  useEffect(() => {
    if (!heatmapLayerRef.current || !window.google?.maps) return;
    const data = heatmapPoints.map(
      (p) => ({
        location: new window.google.maps.LatLng(p.lat, p.lng),
        weight: p.weight,
      })
    );
    heatmapLayerRef.current.setData(data);
  }, [heatmapPoints]);

  return (
    <div className="flex flex-col gap-3">
      {/* Legend */}
      <div className="flex items-center gap-4 text-xs text-gray-500">
        <span className="font-medium text-gray-700">Demand Zones (last 24 hrs)</span>
        <div className="flex items-center gap-1.5 ml-auto">
          <span className="h-2 w-2 rounded-full bg-emerald-500" />
          Low
          <span className="h-2 w-2 rounded-full bg-amber-400" />
          Medium
          <span className="h-2 w-2 rounded-full bg-red-500" />
          High
        </div>
      </div>

      {/* Map container */}
      <div
        ref={mapRef}
        className="w-full h-72 rounded-2xl overflow-hidden border border-gray-100"
      >
        <div className="w-full h-full bg-gray-100 flex items-center justify-center text-sm text-gray-400">
          Loading map…
        </div>
      </div>

      {riderStatus === "OFFLINE" && (
        <p className="text-xs text-center text-amber-600 bg-amber-50 rounded-xl py-2">
          Go online and position yourself in a high-demand area to get more trips
        </p>
      )}
    </div>
  );
}

// Subtle dark-ish map style for better heatmap contrast
const DARK_MAP_STYLES: any[] = [
  { elementType: "geometry", stylers: [{ color: "#f5f5f5" }] },
  { elementType: "labels.icon", stylers: [{ visibility: "off" }] },
  {
    elementType: "labels.text.fill",
    stylers: [{ color: "#616161" }],
  },
  {
    featureType: "road",
    elementType: "geometry",
    stylers: [{ color: "#ffffff" }],
  },
  {
    featureType: "road.arterial",
    elementType: "geometry",
    stylers: [{ color: "#eeeeee" }],
  },
  {
    featureType: "water",
    elementType: "geometry",
    stylers: [{ color: "#c9d6de" }],
  },
];
