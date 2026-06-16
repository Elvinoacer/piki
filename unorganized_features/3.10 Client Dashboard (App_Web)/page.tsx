import { getActiveTrip, getSavedPlaces, getWalletBalance } from "./actions";
import { BookingShell } from "@/components/client-dashboard/BookingShell";
import { ActiveTripCard } from "@/components/client-dashboard/ActiveTripCard";
import { WalletBadge } from "@/components/client-dashboard/WalletBadge";

export default async function ClientDashboardPage() {
  const [activeTrip, savedPlaces, wallet] = await Promise.all([
    getActiveTrip(),
    getSavedPlaces(),
    getWalletBalance(),
  ]);

  return (
    <div className="relative h-full w-full">
      {/* Wallet quick-view */}
      <div className="absolute right-4 top-4 z-10">
        <WalletBadge wallet={wallet} />
      </div>

      {activeTrip ? (
        /* If there's an active trip, show the live tracking view */
        <ActiveTripCard trip={activeTrip} />
      ) : (
        /* Otherwise show the booking flow */
        <BookingShell savedPlaces={savedPlaces} wallet={wallet} />
      )}
    </div>
  );
}
