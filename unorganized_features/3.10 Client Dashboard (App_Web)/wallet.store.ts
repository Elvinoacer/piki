import { create } from "zustand";
import { devtools } from "zustand/middleware";
import type { WalletBalance } from "@/types/client-dashboard";

interface WalletStoreState {
  wallet: WalletBalance | null;
  isLoading: boolean;
}

interface WalletStoreActions {
  setWallet: (wallet: WalletBalance) => void;
  deductBalance: (amount: number) => void;
  setLoading: (v: boolean) => void;
}

type WalletStore = WalletStoreState & WalletStoreActions;

export const useWalletStore = create<WalletStore>()(
  devtools(
    (set) => ({
      wallet: null,
      isLoading: false,

      setWallet: (wallet) => set({ wallet }, false, "setWallet"),

      deductBalance: (amount) =>
        set(
          (s) =>
            s.wallet
              ? { wallet: { ...s.wallet, balance: Math.max(0, s.wallet.balance - amount) } }
              : s,
          false,
          "deductBalance"
        ),

      setLoading: (isLoading) => set({ isLoading }, false, "setLoading"),
    }),
    { name: "WalletStore" }
  )
);
