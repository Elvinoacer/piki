"use client";

import { useEffect } from "react";
import { useTripStore } from "@/stores/trip.store";
import { useWalletStore } from "@/stores/wallet.store";
import type { SavedPlace, WalletBalance } from "@/types/client-dashboard";
import { BookingLocationStep } from "./BookingLocationStep";
import { BookingTypeStep } from "./BookingTypeStep";
import { FareEstimatePanel } from "./FareEstimatePanel";
import { SearchingRiderOverlay } from "./SearchingRiderOverlay";
import { RatingModal } from "./RatingModal";
import { ClientMapView } from "./ClientMapView";

interface Props {
  savedPlaces: SavedPlace[];
  wallet: WalletBalance;
}

export function BookingShell({ savedPlaces, wallet }: Props) {
  const { step, bookingRequest } = useTripStore();
  const { setWallet } = useWalletStore();

  // Hydrate wallet store from server-fetched data
  useEffect(() => {
    setWallet(wallet);
  }, [wallet, setWallet]);

  return (
    <div className="relative h-full w-full">
      {/* Map fills the entire background */}
      <ClientMapView
        pickup={bookingRequest.pickup ?? null}
        destination={bookingRequest.destination ?? null}
        riderLocation={null}
        showRider={false}
      />

      {/* Sliding bottom sheet UI layered over the map */}
      <div className="absolute inset-x-0 bottom-16 z-10 mx-auto max-w-lg px-4 lg:bottom-0 lg:left-4 lg:right-auto lg:w-96">
        {step === "idle" && (
          <BookingLocationStep savedPlaces={savedPlaces} />
        )}
        {step === "selecting" && (
          <BookingTypeStep />
        )}
        {step === "estimating" || step === "confirming" ? (
          <FareEstimatePanel />
        ) : null}
        {step === "searching" && <SearchingRiderOverlay />}
        {step === "rating" && <RatingModal />}
      </div>
    </div>
  );
}
