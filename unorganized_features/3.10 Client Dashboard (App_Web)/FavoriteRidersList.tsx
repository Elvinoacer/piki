"use client";

import { useState, useTransition } from "react";
import { Heart, Star } from "lucide-react";
import type { Rider } from "@/types/client-dashboard";
import { toggleFavoriteRider } from "@/app/(client)/dashboard/actions";
import { cn } from "@/lib/utils";

interface Props {
  initialRiders: Rider[];
}

export function FavoriteRidersList({ initialRiders }: Props) {
  const [riders, setRiders] = useState(initialRiders);
  const [toggling, startToggle] = useTransition();

  const handleUnfavorite = (riderId: string) => {
    startToggle(async () => {
      await toggleFavoriteRider(riderId, false);
      setRiders((prev) => prev.filter((r) => r.id !== riderId));
    });
  };

  if (riders.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 py-12 text-center">
        <Heart size={36} className="text-gray-200" />
        <p className="text-sm font-medium text-gray-700">No favourite riders yet</p>
        <p className="text-xs text-gray-500">
          After a trip, tap the heart on a rider's profile to save them here.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {riders.map((rider) => (
        <div
          key={rider.id}
          className="flex items-center gap-3 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm"
        >
          <div className="relative">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={rider.photoUrl || "/icons/default-rider.png"}
              alt={rider.name}
              className="h-12 w-12 rounded-full object-cover"
            />
            {rider.badges.some((b) => b.type === "VERIFIED") && (
              <span className="absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-green-500 text-[9px] text-white">
                ✓
              </span>
            )}
          </div>

          <div className="flex-1 min-w-0">
            <p className="truncate text-sm font-semibold text-gray-900">{rider.name}</p>
            <div className="mt-0.5 flex items-center gap-2 text-xs text-gray-500">
              <span className="flex items-center gap-0.5">
                <Star size={11} className="fill-amber-400 text-amber-400" />
                {rider.rating.toFixed(1)}
              </span>
              <span>·</span>
              <span>{rider.plateNumber}</span>
              <span>·</span>
              <span>{rider.totalTrips} trips</span>
            </div>
            {rider.badges.length > 0 && (
              <div className="mt-1 flex gap-1 flex-wrap">
                {rider.badges.slice(0, 2).map((badge) => (
                  <span
                    key={badge.type}
                    className="rounded-full bg-orange-50 px-1.5 py-0.5 text-[10px] font-medium text-orange-700"
                  >
                    {badge.label}
                  </span>
                ))}
              </div>
            )}
          </div>

          <button
            onClick={() => handleUnfavorite(rider.id)}
            disabled={toggling}
            className={cn(
              "rounded-full p-2 transition-colors",
              "text-red-400 hover:bg-red-50 hover:text-red-600"
            )}
            aria-label="Remove from favourites"
          >
            <Heart size={18} className="fill-red-400" />
          </button>
        </div>
      ))}
    </div>
  );
}
