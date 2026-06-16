"use client";

import { useState, useTransition } from "react";
import { useTripStore } from "@/stores/trip.store";
import { useWalletStore } from "@/stores/wallet.store";
import type { PaymentMethod } from "@/types/client-dashboard";
import { ChevronLeft, Tag, Loader2, Smartphone, Wallet, Banknote } from "lucide-react";
import { bookRide, applyPromoCode } from "@/app/(client)/dashboard/actions";
import { cn } from "@/lib/utils";

const PAYMENT_OPTIONS: { method: PaymentMethod; label: string; icon: React.ElementType }[] = [
  { method: "MPESA", label: "M-Pesa", icon: Smartphone },
  { method: "WALLET", label: "Wallet", icon: Wallet },
  { method: "CASH", label: "Cash", icon: Banknote },
];

export function FareEstimatePanel() {
  const { bookingRequest, fareEstimate, isEstimating, updateBookingRequest, setStep } =
    useTripStore();
  const { wallet } = useWalletStore();

  const [promoInput, setPromoInput] = useState("");
  const [promoError, setPromoError] = useState<string | null>(null);
  const [promoDiscount, setPromoDiscount] = useState(0);
  const [isApplyingPromo, startPromo] = useTransition();
  const [isBooking, startBooking] = useTransition();

  const selectedPayment = bookingRequest.paymentMethod ?? "MPESA";
  const total = fareEstimate
    ? Math.max(0, fareEstimate.totalFare - promoDiscount)
    : 0;

  const handleApplyPromo = () => {
    if (!promoInput.trim() || !fareEstimate) return;
    startPromo(async () => {
      const result = await applyPromoCode(promoInput.trim(), fareEstimate.totalFare);
      if (result.valid) {
        setPromoDiscount(result.discount);
        updateBookingRequest({ promoCode: result.code });
        setPromoError(null);
      } else {
        setPromoError(result.description);
        setPromoDiscount(0);
      }
    });
  };

  const handleConfirm = () => {
    if (!bookingRequest.pickup || !bookingRequest.destination || !bookingRequest.type) return;
    startBooking(async () => {
      const { tripId } = await bookRide({
        type: bookingRequest.type!,
        pickup: bookingRequest.pickup!,
        destination: bookingRequest.destination!,
        paymentMethod: selectedPayment,
        promoCode: bookingRequest.promoCode,
      });
      // Trip created — switch to searching overlay
      setStep("searching");
      // The socket will notify when a rider accepts
      // Store tripId in URL or trip store if needed
      console.log("[BookingConfirmed]", tripId);
    });
  };

  return (
    <div className="rounded-2xl bg-white shadow-xl ring-1 ring-black/5">
      <div className="p-4 space-y-4">
        {/* Header */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setStep("selecting")}
            className="rounded-full p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
            disabled={isBooking}
          >
            <ChevronLeft size={18} />
          </button>
          <h2 className="text-base font-semibold text-gray-900">Fare estimate</h2>
        </div>

        {isEstimating ? (
          <div className="flex items-center justify-center py-6">
            <Loader2 size={24} className="animate-spin text-orange-500" />
          </div>
        ) : fareEstimate ? (
          <>
            {/* Route summary */}
            <div className="rounded-xl bg-gray-50 px-3 py-2.5 space-y-1 text-xs text-gray-600">
              <div className="flex justify-between">
                <span>Distance</span>
                <span className="font-medium">{fareEstimate.distanceKm} km</span>
              </div>
              <div className="flex justify-between">
                <span>Est. time</span>
                <span className="font-medium">{fareEstimate.estimatedMinutes} min</span>
              </div>
              {fareEstimate.surgeMultiplier > 1 && (
                <div className="flex justify-between text-orange-600">
                  <span>Surge ({fareEstimate.surgeMultiplier}×)</span>
                  <span className="font-medium">Active</span>
                </div>
              )}
            </div>

            {/* Fare breakdown */}
            <div className="space-y-1.5 text-sm">
              <FareLine label="Base fare" amount={fareEstimate.baseFare} />
              <FareLine label="Distance" amount={fareEstimate.distanceFare} />
              <FareLine label="Time" amount={fareEstimate.timeFare} />
              {promoDiscount > 0 && (
                <FareLine label="Promo discount" amount={-promoDiscount} className="text-green-600" />
              )}
              <div className="flex items-center justify-between border-t border-gray-100 pt-2 font-semibold">
                <span>Total</span>
                <span className="text-lg text-orange-600">KES {total.toFixed(0)}</span>
              </div>
            </div>

            {/* Promo code */}
            <div className="space-y-1.5">
              <div className="flex gap-2">
                <div className="flex flex-1 items-center gap-2 rounded-lg border border-gray-200 px-3 py-2">
                  <Tag size={14} className="text-gray-400" />
                  <input
                    placeholder="Promo code"
                    className="flex-1 bg-transparent text-sm outline-none placeholder:text-gray-400"
                    value={promoInput}
                    onChange={(e) => setPromoInput(e.target.value.toUpperCase())}
                    disabled={isApplyingPromo}
                  />
                </div>
                <button
                  onClick={handleApplyPromo}
                  disabled={!promoInput || isApplyingPromo}
                  className="rounded-lg bg-gray-900 px-3 text-xs font-semibold text-white disabled:opacity-40"
                >
                  {isApplyingPromo ? <Loader2 size={14} className="animate-spin" /> : "Apply"}
                </button>
              </div>
              {promoError && (
                <p className="text-xs text-red-500">{promoError}</p>
              )}
              {promoDiscount > 0 && (
                <p className="text-xs text-green-600">✓ Promo applied — KES {promoDiscount.toFixed(0)} off</p>
              )}
            </div>

            {/* Payment method */}
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-gray-500">Pay with</p>
              <div className="flex gap-2">
                {PAYMENT_OPTIONS.map(({ method, label, icon: Icon }) => (
                  <button
                    key={method}
                    onClick={() => updateBookingRequest({ paymentMethod: method })}
                    className={cn(
                      "flex flex-1 flex-col items-center gap-1 rounded-xl border py-2.5 text-xs font-medium transition-all",
                      selectedPayment === method
                        ? "border-orange-400 bg-orange-50 text-orange-700 ring-2 ring-orange-100"
                        : "border-gray-200 text-gray-600 hover:bg-gray-50"
                    )}
                  >
                    <Icon size={16} />
                    {label}
                    {method === "WALLET" && wallet && (
                      <span className="text-[10px] text-gray-400">
                        KES {wallet.balance.toFixed(0)}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Confirm button */}
            <button
              onClick={handleConfirm}
              disabled={isBooking}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-orange-500 py-3.5 text-sm font-semibold text-white hover:bg-orange-600 disabled:opacity-60"
            >
              {isBooking ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Finding your rider…
                </>
              ) : (
                `Confirm — KES ${total.toFixed(0)}`
              )}
            </button>
          </>
        ) : null}
      </div>
    </div>
  );
}

function FareLine({
  label,
  amount,
  className,
}: {
  label: string;
  amount: number;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center justify-between text-gray-600", className)}>
      <span>{label}</span>
      <span>KES {Math.abs(amount).toFixed(0)}</span>
    </div>
  );
}
