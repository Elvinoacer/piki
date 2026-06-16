"use client";

import { useState, useTransition } from "react";
import { Plus, Pencil, Trash2, Loader2, Home, Briefcase, MapPin } from "lucide-react";
import type { SavedPlace, SavedPlaceType } from "@/types/client-dashboard";
import { upsertSavedPlace, deleteSavedPlace } from "@/app/(client)/dashboard/actions";

const PLACE_ICONS: Record<SavedPlaceType, React.ElementType> = {
  HOME: Home,
  WORK: Briefcase,
  FREQUENT: MapPin,
};

interface Props {
  initialPlaces: SavedPlace[];
}

export function SavedPlacesList({ initialPlaces }: Props) {
  const [places, setPlaces] = useState(initialPlaces);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState("");
  const [isSaving, startSave] = useTransition();
  const [isDeleting, startDelete] = useTransition();

  const startEdit = (place: SavedPlace) => {
    setEditingId(place.id);
    setEditLabel(place.label);
  };

  const handleSave = (place: SavedPlace) => {
    startSave(async () => {
      await upsertSavedPlace({ ...place, label: editLabel, id: place.id });
      setPlaces((prev) =>
        prev.map((p) => (p.id === place.id ? { ...p, label: editLabel } : p))
      );
      setEditingId(null);
    });
  };

  const handleDelete = (id: string) => {
    startDelete(async () => {
      await deleteSavedPlace(id);
      setPlaces((prev) => prev.filter((p) => p.id !== id));
    });
  };

  return (
    <div className="space-y-3">
      {places.map((place) => {
        const Icon = PLACE_ICONS[place.type];
        const isEditing = editingId === place.id;

        return (
          <div
            key={place.id}
            className="flex items-center gap-3 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-orange-50">
              <Icon size={18} className="text-orange-600" />
            </div>

            <div className="flex-1 min-w-0">
              {isEditing ? (
                <input
                  autoFocus
                  value={editLabel}
                  onChange={(e) => setEditLabel(e.target.value)}
                  className="w-full rounded-lg border border-orange-300 px-2 py-1 text-sm outline-none ring-2 ring-orange-100"
                />
              ) : (
                <p className="truncate text-sm font-semibold text-gray-900">{place.label}</p>
              )}
              <p className="mt-0.5 truncate text-xs text-gray-500">
                {place.address.formattedAddress}
              </p>
            </div>

            <div className="flex items-center gap-1.5">
              {isEditing ? (
                <button
                  onClick={() => handleSave(place)}
                  disabled={isSaving}
                  className="rounded-lg bg-orange-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-orange-600 disabled:opacity-50"
                >
                  {isSaving ? <Loader2 size={12} className="animate-spin" /> : "Save"}
                </button>
              ) : (
                <button
                  onClick={() => startEdit(place)}
                  className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                >
                  <Pencil size={14} />
                </button>
              )}
              <button
                onClick={() => handleDelete(place.id)}
                disabled={isDeleting}
                className="rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-500"
              >
                {isDeleting ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Trash2 size={14} />
                )}
              </button>
            </div>
          </div>
        );
      })}

      {places.length === 0 && (
        <div className="rounded-2xl border border-dashed border-gray-200 px-4 py-10 text-center">
          <p className="text-sm text-gray-500">No saved places yet.</p>
        </div>
      )}

      {/* Add from map placeholder */}
      <button className="flex w-full items-center gap-3 rounded-2xl border border-dashed border-gray-200 px-4 py-3 text-sm text-gray-500 hover:border-orange-300 hover:bg-orange-50 hover:text-orange-600 transition-colors">
        <Plus size={16} />
        Add a place from the map
      </button>
    </div>
  );
}
