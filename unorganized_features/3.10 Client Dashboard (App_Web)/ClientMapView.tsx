"use client";

import { useEffect, useRef } from "react";
import type { Address, ActiveRiderLocation } from "@/types/client-dashboard";

interface Props {
  pickup: Address | null;
  destination: Address | null;
  riderLocation: ActiveRiderLocation | null;
  showRider: boolean;
}

/**
 * Google Maps embed wrapper.
 *
 * Replace the stub implementation below with the @googlemaps/js-api-loader
 * or @vis.gl/react-google-maps package for production.
 * The component expects NEXT_PUBLIC_GOOGLE_MAPS_KEY in env.
 */
export function ClientMapView({ pickup, destination, riderLocation, showRider }: Props) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<google.maps.Marker[]>([]);

  // Init map on mount
  useEffect(() => {
    if (!mapRef.current || typeof window === "undefined") return;

    const loader = async () => {
      const { Loader } = await import("@googlemaps/js-api-loader");
      const loader_ = new Loader({
        apiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY ?? "",
        version: "weekly",
        libraries: ["places"],
      });
      const google = await loader_.load();
      mapInstanceRef.current = new google.maps.Map(mapRef.current!, {
        center: { lat: -1.286389, lng: 36.817223 }, // Nairobi default
        zoom: 14,
        disableDefaultUI: true,
        zoomControl: true,
        styles: [
          { featureType: "poi", stylers: [{ visibility: "off" }] },
          { featureType: "transit", stylers: [{ visibility: "off" }] },
        ],
      });
    };

    loader().catch(console.error);

    return () => {
      markersRef.current.forEach((m) => m.setMap(null));
      markersRef.current = [];
    };
  }, []);

  // Update markers when props change
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || typeof google === "undefined") return;

    // Clear existing markers
    markersRef.current.forEach((m) => m.setMap(null));
    markersRef.current = [];

    const bounds = new google.maps.LatLngBounds();

    if (pickup) {
      const m = new google.maps.Marker({
        position: pickup.latLng,
        map,
        title: "Pickup",
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 8,
          fillColor: "#f97316",
          fillOpacity: 1,
          strokeColor: "#fff",
          strokeWeight: 2,
        },
      });
      markersRef.current.push(m);
      bounds.extend(pickup.latLng);
    }

    if (destination) {
      const m = new google.maps.Marker({
        position: destination.latLng,
        map,
        title: "Destination",
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 8,
          fillColor: "#374151",
          fillOpacity: 1,
          strokeColor: "#fff",
          strokeWeight: 2,
        },
      });
      markersRef.current.push(m);
      bounds.extend(destination.latLng);
    }

    if (showRider && riderLocation) {
      const m = new google.maps.Marker({
        position: riderLocation.latLng,
        map,
        title: "Rider",
        icon: {
          url: "/icons/boda-marker.png",
          scaledSize: new google.maps.Size(36, 36),
          rotation: riderLocation.heading,
        },
      });
      markersRef.current.push(m);
      bounds.extend(riderLocation.latLng);
    }

    if (!bounds.isEmpty()) {
      map.fitBounds(bounds, { top: 60, right: 20, bottom: 320, left: 20 });
    }
  }, [pickup, destination, riderLocation, showRider]);

  return (
    <div
      ref={mapRef}
      className="h-full w-full bg-gray-200"
      aria-label="Trip map"
    />
  );
}
