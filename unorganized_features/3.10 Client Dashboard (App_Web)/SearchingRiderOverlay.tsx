"use client";

import { useEffect, useState, useTransition } from "react";
import { Loader2, X } from "lucide-react";
import { useTripStore } from "@/stores/trip.store";
import { cancelTrip } from "@/app/(client)/dashboard/actions";

export function SearchingRiderOverlay() {
  const { activeTrip, resetBooking } = useTripStore();
  const [elapsed, setElapsed] = useState(0);
  const [isCancelling, startCancel] = useTransition();

  // Count up so user knows something is happening
  useEffect(() => {
    const id = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const handleCancel = () => {
    if (!activeTrip) {
      resetBooking();
      return;
    }
    startCancel(async () => {
      await cancelTrip(activeTrip.id);
      resetBooking();
    });
  };

  return (
    <div className="flex flex-col items-center gap-4 rounded-2xl bg-white p-6 shadow-xl ring-1 ring-black/5 text-center">
      <div className="relative flex h-16 w-16 items-center justify-center rounded-full bg-orange-100">
        <Loader2 size={28} className="animate-spin text-orange-500" />
        <span className="absolute -bottom-1 -right-1 rounded-full bg-white px-1.5 py-0.5 text-[10px] font-bold text-gray-500 shadow">
          {elapsed}s
        </span>
      </div>
      <div>
        <p className="font-semibold text-gray-900">Finding your rider</p>
        <p className="mt-0.5 text-sm text-gray-500">
          Searching nearby bodaboda riders for you…
        </p>
      </div>
      <button
        onClick={handleCancel}
        disabled={isCancelling}
        className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-red-500 disabled:opacity-50"
      >
        <X size={14} />
        Cancel request
      </button>
    </div>
  );
}
