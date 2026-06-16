"use client";

import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, Star, FileText, RotateCcw } from "lucide-react";
import type { TripHistoryItem } from "@/types/client-dashboard";
import { cn } from "@/lib/utils";

interface Props {
  trips: TripHistoryItem[];
  total: number;
  page: number;
}

const PAGE_SIZE = 20;

const TYPE_LABELS = { RIDE: "Boda Ride", PARCEL: "Parcel", ERRAND: "Errand" };
const PAYMENT_LABELS = { MPESA: "M-Pesa", WALLET: "Wallet", CASH: "Cash" };

export function TripHistoryList({ trips, total, page }: Props) {
  const router = useRouter();
  const totalPages = Math.ceil(total / PAGE_SIZE);

  if (trips.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 py-16 text-center">
        <span className="text-4xl">🏍️</span>
        <p className="font-medium text-gray-700">No trips yet</p>
        <p className="text-sm text-gray-500">Your completed trips will appear here.</p>
      </div>
    );
  }

  const formatDate = (iso: string) =>
    new Intl.DateTimeFormat("en-KE", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(iso));

  return (
    <div className="space-y-4">
      {trips.map((trip) => (
        <div
          key={trip.id}
          className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm"
        >
          <div className="flex items-center gap-3 px-4 py-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={trip.rider.photoUrl || "/icons/default-rider.png"}
              alt={trip.rider.name}
              className="h-10 w-10 rounded-full object-cover"
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-gray-900">{trip.rider.name}</span>
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-[10px] font-semibold",
                    trip.status === "COMPLETED"
                      ? "bg-green-100 text-green-700"
                      : "bg-red-100 text-red-600"
                  )}
                >
                  {trip.status}
                </span>
              </div>
              <p className="text-xs text-gray-500">
                {TYPE_LABELS[trip.type]} · {formatDate(trip.completedAt)}
              </p>
            </div>
          </div>

          {/* Route */}
          <div className="border-t border-gray-50 px-4 py-2.5 space-y-1">
            <div className="flex gap-2 items-start text-xs text-gray-700">
              <span className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-orange-400" />
              <span className="flex-1 leading-snug">{trip.pickup.formattedAddress}</span>
            </div>
            <div className="flex gap-2 items-start text-xs text-gray-500">
              <span className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-gray-400" />
              <span className="flex-1 leading-snug">{trip.destination.formattedAddress}</span>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between border-t border-gray-50 px-4 py-2.5">
            <div className="flex items-center gap-3 text-xs text-gray-500">
              <span className="font-semibold text-gray-900">
                KES {trip.actualFare.toFixed(0)}
              </span>
              <span>{PAYMENT_LABELS[trip.paymentMethod]}</span>
              {trip.clientRating && (
                <span className="flex items-center gap-0.5">
                  <Star size={11} className="fill-amber-400 text-amber-400" />
                  {trip.clientRating}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {trip.receiptUrl && (
                <a
                  href={trip.receiptUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-900"
                >
                  <FileText size={12} />
                  Receipt
                </a>
              )}
              {trip.canRebook && (
                <button
                  onClick={() => router.push("/dashboard")}
                  className="flex items-center gap-1 rounded-lg bg-orange-50 px-2.5 py-1 text-xs font-medium text-orange-600 hover:bg-orange-100"
                >
                  <RotateCcw size={11} />
                  Rebook
                </button>
              )}
            </div>
          </div>
        </div>
      ))}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <button
            onClick={() => router.push(`/dashboard/history?page=${page - 1}`)}
            disabled={page <= 1}
            className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-900 disabled:opacity-40"
          >
            <ChevronLeft size={16} />
            Prev
          </button>
          <span className="text-sm text-gray-500">
            Page {page} of {totalPages}
          </span>
          <button
            onClick={() => router.push(`/dashboard/history?page=${page + 1}`)}
            disabled={page >= totalPages}
            className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-900 disabled:opacity-40"
          >
            Next
            <ChevronRight size={16} />
          </button>
        </div>
      )}
    </div>
  );
}
