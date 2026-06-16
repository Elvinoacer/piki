"use client";

import { Wallet } from "lucide-react";
import type { WalletBalance } from "@/types/client-dashboard";

interface Props {
  wallet: WalletBalance;
}

export function WalletBadge({ wallet }: Props) {
  return (
    <div className="flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 shadow ring-1 ring-black/5">
      <Wallet size={13} className="text-orange-500" />
      <span className="text-xs font-semibold text-gray-800">
        KES {wallet.balance.toFixed(0)}
      </span>
    </div>
  );
}
