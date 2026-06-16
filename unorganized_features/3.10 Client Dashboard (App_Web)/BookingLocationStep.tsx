"use client";

import { useState } from "react";
import { MapPin, Navigation, Search, ChevronRight } from "lucide-react";
import { useTripStore } from "@/stores/trip.store";
import type { Address, SavedPlace } from "@/types/client-dashboard";
import { cn } from "@/lib/utils";

interface Props {
  savedPlaces: SavedPlace[];
}

// In production: replace with Google Places Autocomplete or Mapbox Search
function useAddressSearch() {
  const [results, setResults] = useState<Address[]>([]);
  const [query, setQuery] = useState("");

  const search = async (q: string) => {
    setQuery(q);
    if (q.length < 3) {
      setResults([]);
      return;
    }
    // Stub — wire to /api/places/autocomplete
    setResults([
      {
        formattedAddress: `${q}, Nairobi`,
        latLng: { lat: -1.286389, lng: 36.817223 },
        placeId: `stub-${q}`,
      },
    ]);
  };

  return { query, results, search };
}

export function BookingLocationStep({ savedPlaces }: Props) {
  const { bookingRequest, updateBookingRequest, setStep } = useTripStore();
  const pickupSearch = useAddressSearch();
  const destSearch = useAddressSearch();
  const [activeField, setActiveField] = useState<"pickup" | "destination" | null>(null);

  const homePlace = savedPlaces.find((p) => p.type === "HOME");
  const workPlace = savedPlaces.find((p) => p.type === "WORK");

  const selectAddress = (field: "pickup" | "destination", address: Address) => {
    updateBookingRequest({ [field]: address });
    setActiveField(null);
  };

  const canProceed = bookingRequest.pickup && bookingRequest.destination;

  return (
    <div className="rounded-2xl bg-white shadow-xl ring-1 ring-black/5">
      <div className="p-4 space-y-3">
        <h2 className="text-base font-semibold text-gray-900">Where to?</h2>

        {/* Pickup */}
        <div
          className={cn(
            "flex items-center gap-3 rounded-xl border px-3 py-2.5 transition-colors",
            activeField === "pickup"
              ? "border-orange-400 ring-2 ring-orange-100"
              : "border-gray-200"
          )}
          onClick={() => setActiveField("pickup")}
        >
          <Navigation size={16} className="shrink-0 text-orange-500" />
          {activeField === "pickup" ? (
            <input
              autoFocus
              placeholder="Pickup location"
              className="flex-1 bg-transparent text-sm text-gray-900 outline-none placeholder:text-gray-400"
              value={pickupSearch.query || bookingRequest.pickup?.formattedAddress || ""}
              onChange={(e) => pickupSearch.search(e.target.value)}
            />
          ) : (
            <span className={cn("flex-1 text-sm", bookingRequest.pickup ? "text-gray-900" : "text-gray-400")}>
              {bookingRequest.pickup?.formattedAddress ?? "Pickup location"}
            </span>
          )}
        </div>

        {/* Destination */}
        <div
          className={cn(
            "flex items-center gap-3 rounded-xl border px-3 py-2.5 transition-colors",
            activeField === "destination"
              ? "border-orange-400 ring-2 ring-orange-100"
              : "border-gray-200"
          )}
          onClick={() => setActiveField("destination")}
        >
          <MapPin size={16} className="shrink-0 text-gray-400" />
          {activeField === "destination" ? (
            <input
              autoFocus
              placeholder="Where are you going?"
              className="flex-1 bg-transparent text-sm text-gray-900 outline-none placeholder:text-gray-400"
              value={destSearch.query || bookingRequest.destination?.formattedAddress || ""}
              onChange={(e) => destSearch.search(e.target.value)}
            />
          ) : (
            <span className={cn("flex-1 text-sm", bookingRequest.destination ? "text-gray-900" : "text-gray-400")}>
              {bookingRequest.destination?.formattedAddress ?? "Where are you going?"}
            </span>
          )}
        </div>

        {/* Autocomplete results */}
        {activeField && (
          <div className="divide-y divide-gray-100 rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
            {activeField === "pickup" && pickupSearch.results.map((addr) => (
              <button
                key={addr.placeId}
                className="flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm hover:bg-gray-50"
                onClick={() => selectAddress("pickup", addr)}
              >
                <Search size={14} className="text-gray-400" />
                <span>{addr.formattedAddress}</span>
              </button>
            ))}
            {activeField === "destination" && destSearch.results.map((addr) => (
              <button
                key={addr.placeId}
                className="flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm hover:bg-gray-50"
                onClick={() => selectAddress("destination", addr)}
              >
                <Search size={14} className="text-gray-400" />
                <span>{addr.formattedAddress}</span>
              </button>
            ))}
          </div>
        )}

        {/* Saved place quick picks */}
        {!activeField && (homePlace || workPlace) && (
          <div className="flex gap-2 pt-1">
            {homePlace && (
              <button
                className="flex items-center gap-1.5 rounded-full border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
                onClick={() => selectAddress("destination", homePlace.address)}
              >
                🏠 Home
              </button>
            )}
            {workPlace && (
              <button
                className="flex items-center gap-1.5 rounded-full border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
                onClick={() => selectAddress("destination", workPlace.address)}
              >
                💼 Work
              </button>
            )}
          </div>
        )}

        {/* Continue CTA */}
        <button
          disabled={!canProceed}
          onClick={() => setStep("selecting")}
          className={cn(
            "flex w-full items-center justify-between rounded-xl px-4 py-3 text-sm font-semibold transition-colors",
            canProceed
              ? "bg-orange-500 text-white hover:bg-orange-600"
              : "cursor-not-allowed bg-gray-100 text-gray-400"
          )}
        >
          Choose ride type
          <ChevronRight size={18} />
        </button>
      </div>
    </div>
  );
}
