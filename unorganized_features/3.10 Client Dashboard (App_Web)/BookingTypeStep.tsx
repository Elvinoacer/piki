"use client";

import { useTripStore } from "@/stores/trip.store";
import type { TripType } from "@/types/client-dashboard";
import { ChevronLeft, Bike, Package, ShoppingBag } from "lucide-react";
import { cn } from "@/lib/utils";

const TRIP_TYPES: { type: TripType; label: string; description: string; icon: React.ElementType }[] = [
  {
    type: "RIDE",
    label: "Boda Ride",
    description: "Passenger point-to-point",
    icon: Bike,
  },
  {
    type: "PARCEL",
    label: "Parcel Delivery",
    description: "Send packages & documents",
    icon: Package,
  },
  {
    type: "ERRAND",
    label: "Errand",
    description: "Shopping, pick-up & more",
    icon: ShoppingBag,
  },
];

export function BookingTypeStep() {
  const { bookingRequest, updateBookingRequest, setStep, setIsEstimating, setFareEstimate } =
    useTripStore();

  const selectType = async (type: TripType) => {
    updateBookingRequest({ type });
    setStep("estimating");
    setIsEstimating(true);

    try {
      const res = await fetch("/api/fare-estimate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pickup: bookingRequest.pickup,
          destination: bookingRequest.destination,
          type,
        }),
      });
      const estimate = await res.json();
      setFareEstimate(estimate);
    } catch {
      // handle error
    } finally {
      setIsEstimating(false);
    }
  };

  return (
    <div className="rounded-2xl bg-white shadow-xl ring-1 ring-black/5">
      <div className="p-4 space-y-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setStep("idle")}
            className="rounded-full p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
          >
            <ChevronLeft size={18} />
          </button>
          <h2 className="text-base font-semibold text-gray-900">Choose ride type</h2>
        </div>

        <div className="space-y-2">
          {TRIP_TYPES.map(({ type, label, description, icon: Icon }) => (
            <button
              key={type}
              onClick={() => selectType(type)}
              className={cn(
                "flex w-full items-center gap-3 rounded-xl border p-3.5 text-left transition-all hover:border-orange-300 hover:bg-orange-50",
                bookingRequest.type === type
                  ? "border-orange-400 bg-orange-50 ring-2 ring-orange-100"
                  : "border-gray-200 bg-white"
              )}
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-orange-100">
                <Icon size={20} className="text-orange-600" />
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900">{label}</p>
                <p className="text-xs text-gray-500">{description}</p>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
