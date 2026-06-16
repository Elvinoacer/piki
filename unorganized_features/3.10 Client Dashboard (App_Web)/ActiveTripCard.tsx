"use client";

import { useEffect, useTransition } from "react";
import { Share2, Phone, ShieldAlert, X, Star } from "lucide-react";
import { useTripStore } from "@/stores/trip.store";
import { useTripSocket } from "@/hooks/useTripSocket";
import type { ActiveTrip } from "@/types/client-dashboard";
import { cancelTrip } from "@/app/(client)/dashboard/actions";
import { ClientMapView } from "./ClientMapView";
import { RatingModal } from "./RatingModal";
import { cn } from "@/lib/utils";

const STATUS_LABELS: Record<ActiveTrip["status"], string> = {
  REQUESTED: "Finding your rider…",
  ACCEPTED: "Rider accepted your trip",
  ARRIVING: "Rider on the way",
  ARRIVED: "Rider has arrived",
  IN_PROGRESS: "On your way",
  COMPLETED: "Trip complete",
  CANCELLED: "Trip cancelled",
};

interface Props {
  trip: ActiveTrip;
}

export function ActiveTripCard({ trip }: Props) {
  const { setActiveTrip, activeTrip, updateTripStatus, step, riderLocation } = useTripStore();
  const [isCancelling, startCancel] = useTransition();

  // Hydrate store on mount
  useEffect(() => {
    setActiveTrip(trip);
  }, [trip, setActiveTrip]);

  // Connect WebSocket for live updates
  useTripSocket(activeTrip?.id ?? null);

  const currentTrip = activeTrip ?? trip;
  const isInProgress = ["IN_PROGRESS", "ARRIVING", "ARRIVED"].includes(currentTrip.status);
  const canCancel = ["REQUESTED", "ACCEPTED", "ARRIVING"].includes(currentTrip.status);

  const handleCancel = () => {
    startCancel(async () => {
      await cancelTrip(currentTrip.id);
      updateTripStatus("CANCELLED");
    });
  };

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({ title: "Track my Pikii ride", url: currentTrip.shareLink });
    } else {
      navigator.clipboard.writeText(currentTrip.shareLink);
    }
  };

  if (step === "rating") {
    return (
      <div className="relative h-full w-full">
        <RatingModal />
      </div>
    );
  }

  return (
    <div className="relative h-full w-full">
      {/* Live map */}
      <ClientMapView
        pickup={currentTrip.pickup}
        destination={currentTrip.destination}
        riderLocation={riderLocation ?? currentTrip.riderLocation}
        showRider={isInProgress}
      />

      {/* Bottom panel */}
      <div className="absolute inset-x-0 bottom-16 z-10 mx-auto max-w-lg px-4 lg:bottom-0 lg:left-4 lg:right-auto lg:w-96">
        <div className="rounded-2xl bg-white shadow-xl ring-1 ring-black/5 overflow-hidden">
          {/* Status bar */}
          <div
            className={cn(
              "px-4 py-2.5 text-center text-sm font-semibold",
              currentTrip.status === "IN_PROGRESS"
                ? "bg-green-500 text-white"
                : currentTrip.status === "ARRIVED"
                ? "bg-blue-500 text-white"
                : "bg-orange-500 text-white"
            )}
          >
            {STATUS_LABELS[currentTrip.status]}
          </div>

          <div className="p-4 space-y-4">
            {/* Rider details */}
            <div className="flex items-center gap-3">
              <div className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={currentTrip.rider.photoUrl}
                  alt={currentTrip.rider.name}
                  className="h-14 w-14 rounded-full object-cover ring-2 ring-orange-200"
                />
                {currentTrip.rider.badges.some((b) => b.type === "VERIFIED") && (
                  <span className="absolute -bottom-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-green-500 text-[10px] text-white">
                    ✓
                  </span>
                )}
              </div>
              <div className="flex-1">
                <p className="font-semibold text-gray-900">{currentTrip.rider.name}</p>
                <p className="text-xs text-gray-500">{currentTrip.rider.plateNumber}</p>
                <div className="mt-0.5 flex items-center gap-1 text-xs text-gray-600">
                  <Star size={11} className="fill-amber-400 text-amber-400" />
                  <span>{currentTrip.rider.rating.toFixed(1)}</span>
                  <span className="text-gray-400">· {currentTrip.rider.totalTrips} trips</span>
                </div>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-orange-600">{currentTrip.etaMinutes}</p>
                <p className="text-xs text-gray-500">min away</p>
              </div>
            </div>

            {/* Route */}
            <div className="rounded-xl bg-gray-50 px-3 py-2.5 space-y-1.5 text-xs text-gray-600">
              <div className="flex gap-2 items-start">
                <span className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-orange-500" />
                <span className="flex-1 leading-snug">{currentTrip.pickup.formattedAddress}</span>
              </div>
              <div className="flex gap-2 items-start">
                <span className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-gray-400" />
                <span className="flex-1 leading-snug">{currentTrip.destination.formattedAddress}</span>
              </div>
            </div>

            {/* Fare */}
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">Estimated fare</span>
              <span className="font-bold text-gray-900">
                KES {currentTrip.fareEstimate.totalFare.toFixed(0)}
              </span>
            </div>

            {/* Action row */}
            <div className="flex gap-2">
              {/* Call (masked) */}
              <button
                className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-gray-200 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
                onClick={() => window.open(`tel:${currentTrip.rider.phoneLastFour ?? ""}`)}
              >
                <Phone size={15} />
                Call
              </button>

              {/* Share trip */}
              <button
                onClick={handleShare}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-gray-200 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                <Share2 size={15} />
                Share
              </button>

              {/* SOS */}
              <button
                className="flex items-center justify-center gap-1.5 rounded-xl bg-red-500 px-3.5 py-2.5 text-sm font-bold text-white hover:bg-red-600"
                onClick={() => alert("SOS sent to your emergency contacts and Pikii safety team.")}
              >
                <ShieldAlert size={15} />
                SOS
              </button>
            </div>

            {/* Cancel */}
            {canCancel && (
              <button
                onClick={handleCancel}
                disabled={isCancelling}
                className="flex w-full items-center justify-center gap-1.5 text-xs text-gray-400 hover:text-red-500 disabled:opacity-50"
              >
                <X size={12} />
                {isCancelling ? "Cancelling…" : "Cancel trip"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
