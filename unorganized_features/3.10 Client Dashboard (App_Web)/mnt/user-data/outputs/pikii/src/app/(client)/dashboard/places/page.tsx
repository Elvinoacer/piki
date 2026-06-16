import { getSavedPlaces } from "../actions";
import { SavedPlacesList } from "@/components/client-dashboard/SavedPlacesList";

export default async function SavedPlacesPage() {
  const places = await getSavedPlaces();

  return (
    <div className="mx-auto max-w-xl px-4 py-6">
      <h1 className="mb-6 text-2xl font-bold text-gray-900">Saved Places</h1>
      <SavedPlacesList initialPlaces={places} />
    </div>
  );
}
