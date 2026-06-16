import { getFavoriteRiders } from "../actions";
import { FavoriteRidersList } from "@/components/client-dashboard/FavoriteRidersList";

export default async function FavoriteRidersPage() {
  const riders = await getFavoriteRiders();

  return (
    <div className="mx-auto max-w-xl px-4 py-6">
      <h1 className="mb-6 text-2xl font-bold text-gray-900">Favourite Riders</h1>
      <p className="mb-6 text-sm text-gray-500">
        Riders you mark as favourite get priority in your next booking.
      </p>
      <FavoriteRidersList initialRiders={riders} />
    </div>
  );
}
