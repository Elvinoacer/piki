"use client";

import { useState } from "react";
import { Copy, Share2, Check, Gift } from "lucide-react";
import type { ReferralInfo } from "@/types/client-dashboard";

interface Props {
  referral: ReferralInfo;
}

export function ReferralCard({ referral }: Props) {
  const [copied, setCopied] = useState(false);

  const copyCode = async () => {
    await navigator.clipboard.writeText(referral.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShare = () => {
    const text = `Use my Pikii referral code ${referral.code} to get a discount on your first ride! ${referral.shareUrl}`;
    if (navigator.share) {
      navigator.share({ title: "Join Pikii", text, url: referral.shareUrl });
    } else {
      navigator.clipboard.writeText(text);
    }
  };

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl border border-gray-100 bg-white p-4 text-center shadow-sm">
          <p className="text-2xl font-bold text-orange-500">{referral.referralCount}</p>
          <p className="mt-0.5 text-xs text-gray-500">Friends referred</p>
        </div>
        <div className="rounded-2xl border border-gray-100 bg-white p-4 text-center shadow-sm">
          <p className="text-2xl font-bold text-orange-500">
            KES {referral.creditsEarned}
          </p>
          <p className="mt-0.5 text-xs text-gray-500">Credits earned</p>
        </div>
      </div>

      {/* Referral code card */}
      <div className="overflow-hidden rounded-2xl bg-gradient-to-br from-orange-500 to-orange-400 p-5 text-white shadow-md">
        <div className="flex items-center gap-2 mb-3">
          <Gift size={18} />
          <span className="text-sm font-semibold">Your referral code</span>
        </div>

        <div className="flex items-center justify-between rounded-xl bg-white/20 px-4 py-3 backdrop-blur-sm">
          <span className="font-mono text-2xl font-bold tracking-widest">
            {referral.code}
          </span>
          <button
            onClick={copyCode}
            className="rounded-lg bg-white/30 p-2 hover:bg-white/40 transition-colors"
            aria-label="Copy code"
          >
            {copied ? <Check size={18} /> : <Copy size={18} />}
          </button>
        </div>

        <p className="mt-3 text-xs text-orange-100">
          Share this code with friends. You both earn KES 50 credit when they complete their first trip.
        </p>
      </div>

      {/* Share button */}
      <button
        onClick={handleShare}
        className="flex w-full items-center justify-center gap-2 rounded-2xl border border-orange-200 bg-orange-50 py-3.5 text-sm font-semibold text-orange-600 hover:bg-orange-100 transition-colors"
      >
        <Share2 size={16} />
        Invite friends & earn credit
      </button>

      {/* Promo code redemption hint */}
      <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
        <p className="text-sm font-semibold text-gray-900 mb-1">Have a promo code?</p>
        <p className="text-xs text-gray-500">
          Enter it when confirming your next booking to get a discount on your ride.
        </p>
      </div>
    </div>
  );
}
