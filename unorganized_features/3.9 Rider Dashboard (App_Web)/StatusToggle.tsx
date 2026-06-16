"use client";
// components/rider/StatusToggle.tsx
// Online / Offline / Break toggle — PRD §3.9

import { useState } from "react";
import { useRiderDashboardStore } from "@/store/riderDashboardStore";
import type { RiderStatus } from "@/types/rider-dashboard";

const STATUS_CONFIG: Record<
  RiderStatus,
  { label: string; color: string; bg: string; dot: string }
> = {
  AVAILABLE: {
    label: "Available",
    color: "text-emerald-700",
    bg: "bg-emerald-50 border-emerald-200",
    dot: "bg-emerald-500",
  },
  ON_TRIP: {
    label: "On Trip",
    color: "text-blue-700",
    bg: "bg-blue-50 border-blue-200",
    dot: "bg-blue-500",
  },
  BREAK: {
    label: "On Break",
    color: "text-amber-700",
    bg: "bg-amber-50 border-amber-200",
    dot: "bg-amber-500",
  },
  OFFLINE: {
    label: "Offline",
    color: "text-gray-500",
    bg: "bg-gray-100 border-gray-200",
    dot: "bg-gray-400",
  },
};

export function StatusToggle() {
  const { riderStatus, setRiderStatus } = useRiderDashboardStore();
  const [open, setOpen] = useState(false);

  const current = STATUS_CONFIG[riderStatus];
  const isOnline = riderStatus !== "OFFLINE";

  const switchableStatuses: RiderStatus[] = isOnline
    ? ["AVAILABLE", "BREAK", "OFFLINE"]
    : ["AVAILABLE"];

  return (
    <div className="relative flex items-center gap-3">
      {/* Main pill toggle */}
      <button
        onClick={() => {
          if (!isOnline) {
            setRiderStatus("AVAILABLE");
          } else {
            setOpen((v) => !v);
          }
        }}
        className={`
          flex items-center gap-2 px-4 py-2 rounded-full border text-sm font-medium
          transition-all duration-200 select-none
          ${current.bg} ${current.color}
        `}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        {/* Animated dot */}
        <span className="relative flex h-2.5 w-2.5">
          {riderStatus === "AVAILABLE" && (
            <span
              className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${current.dot}`}
            />
          )}
          <span
            className={`relative inline-flex rounded-full h-2.5 w-2.5 ${current.dot}`}
          />
        </span>
        {current.label}
        {isOnline && (
          <svg
            className={`w-3.5 h-3.5 transition-transform ${open ? "rotate-180" : ""}`}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M6 9l6 6 6-6"
            />
          </svg>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setOpen(false)}
          />
          <ul
            role="listbox"
            className="absolute top-full left-0 mt-1 z-20 w-44 bg-white border border-gray-200 rounded-xl shadow-lg py-1 overflow-hidden"
          >
            {switchableStatuses.map((s) => {
              const cfg = STATUS_CONFIG[s];
              return (
                <li key={s}>
                  <button
                    role="option"
                    aria-selected={riderStatus === s}
                    onClick={() => {
                      setRiderStatus(s);
                      setOpen(false);
                    }}
                    className={`
                      w-full flex items-center gap-2.5 px-4 py-2.5 text-sm
                      ${riderStatus === s ? "bg-gray-50 font-medium" : "hover:bg-gray-50"}
                      ${cfg.color}
                    `}
                  >
                    <span
                      className={`h-2 w-2 rounded-full shrink-0 ${cfg.dot}`}
                    />
                    {cfg.label}
                    {riderStatus === s && (
                      <svg
                        className="ml-auto w-4 h-4"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={2.5}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}
