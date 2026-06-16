"use client";
// app/(rider)/dashboard/RiderDashboardClient.tsx
// Client shell: hydrates Zustand store, wires socket, renders tabbed UI

import { useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRiderDashboardStore } from "@/store/riderDashboardStore";
import { useRiderSocket } from "@/components/rider/useRiderSocket";

import { StatusToggle } from "@/components/rider/StatusToggle";
import { IncomingRequestCard } from "@/components/rider/IncomingRequestCard";
import { OverviewPanel } from "@/components/rider/OverviewPanel";
import { EarningsPanel } from "@/components/rider/EarningsPanel";
import { TripHistoryList } from "@/components/rider/TripHistoryList";
import { PayoutsPanel } from "@/components/rider/PayoutsPanel";
import { PerformanceStats } from "@/components/rider/PerformanceStats";
import { DocumentAlerts } from "@/components/rider/DocumentAlerts";
import { DemandHeatmap } from "@/components/rider/DemandHeatmap";
import type { RiderDashboardData } from "@/types/rider-dashboard";

type Tab = RiderDashboardData extends never
  ? never
  : "overview" | "earnings" | "history" | "payouts" | "stats" | "documents" | "heatmap";

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: "overview", label: "Home", icon: "🏠" },
  { id: "earnings", label: "Earnings", icon: "💰" },
  { id: "history", label: "Trips", icon: "🗂️" },
  { id: "payouts", label: "Wallet", icon: "📲" },
  { id: "stats", label: "Stats", icon: "📊" },
  { id: "documents", label: "Docs", icon: "📋" },
  { id: "heatmap", label: "Zones", icon: "🗺️" },
];

interface Props {
  initialData: RiderDashboardData;
}

export function RiderDashboardClient({ initialData }: Props) {
  const { data: session } = useSession();
  const {
    activeTab,
    setActiveTab,
    setInitialData,
    riderStatus,
    documents,
  } = useRiderDashboardStore();

  // Hydrate store once with SSR data
  useEffect(() => {
    setInitialData({
      rider: initialData.rider,
      riderStatus: initialData.rider.status,
      earnings: initialData.earnings,
      tripHistory: initialData.tripHistory,
      payouts: initialData.payouts,
      wallet: initialData.wallet,
      performance: initialData.performance,
      documents: initialData.documents,
      heatmapPoints: initialData.heatmapPoints,
    });
  }, []); // intentionally once — subsequent updates come via sockets

  // Wire real-time socket
  useRiderSocket(session?.user?.riderId as string | undefined);

  // Count critical docs
  const criticalDocs = documents.filter((d) => {
    if (!d.daysUntilExpiry) return false;
    return d.daysUntilExpiry <= 14 || d.verificationStatus === "REJECTED";
  }).length;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Incoming request overlay */}
      <IncomingRequestCard />

      {/* Top bar */}
      <header className="sticky top-0 z-30 bg-white border-b border-gray-100 px-4 py-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-lg font-extrabold text-gray-900 tracking-tight">
            Pikii
          </span>
          <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-medium">
            Rider
          </span>
        </div>
        <StatusToggle />
      </header>

      {/* Main content */}
      <main className="flex-1 px-4 py-4 max-w-lg mx-auto w-full pb-28">
        {activeTab === "overview" && <OverviewPanel />}
        {activeTab === "earnings" && <EarningsPanel />}
        {activeTab === "history" && <TripHistoryList />}
        {activeTab === "payouts" && <PayoutsPanel />}
        {activeTab === "stats" && <PerformanceStats />}
        {activeTab === "documents" && <DocumentAlerts />}
        {activeTab === "heatmap" && <DemandHeatmap />}
      </main>

      {/* Bottom tab bar */}
      <nav className="fixed bottom-0 inset-x-0 z-30 bg-white border-t border-gray-100 px-2 pb-safe">
        <ul className="flex items-center justify-around max-w-lg mx-auto">
          {TABS.map((tab) => {
            const isActive = activeTab === tab.id;
            const showBadge = tab.id === "documents" && criticalDocs > 0;

            return (
              <li key={tab.id}>
                <button
                  onClick={() => setActiveTab(tab.id)}
                  className={`
                    relative flex flex-col items-center py-2 px-1 min-w-[3.25rem]
                    transition-colors
                    ${isActive ? "text-emerald-600" : "text-gray-400"}
                  `}
                >
                  <span className="text-xl">{tab.icon}</span>
                  <span className="text-[10px] mt-0.5 font-medium">{tab.label}</span>
                  {showBadge && (
                    <span className="absolute top-1.5 right-1 h-4 w-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                      {criticalDocs}
                    </span>
                  )}
                  {isActive && (
                    <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-emerald-500" />
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
