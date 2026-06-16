"use client";
// src/components/ratings/StarRating.tsx
// Reusable interactive star picker + static display mode.

import { useState } from "react";
import { cn } from "@/lib/utils";

interface StarRatingProps {
  value: number;           // 0–5
  onChange?: (v: number) => void;
  readonly?: boolean;
  size?: "sm" | "md" | "lg";
  showLabel?: boolean;
  className?: string;
}

const SIZE_MAP = {
  sm: "h-5 w-5",
  md: "h-7 w-7",
  lg: "h-9 w-9",
};

const SCORE_LABELS: Record<number, string> = {
  1: "Poor",
  2: "Below average",
  3: "Average",
  4: "Good",
  5: "Excellent",
};

export function StarRating({
  value,
  onChange,
  readonly = false,
  size = "md",
  showLabel = false,
  className,
}: StarRatingProps) {
  const [hovered, setHovered] = useState(0);
  const display = hovered || value;

  return (
    <div className={cn("flex flex-col items-center gap-1", className)}>
      <div
        className="flex gap-1"
        role={readonly ? undefined : "radiogroup"}
        aria-label="Star rating"
        onMouseLeave={() => !readonly && setHovered(0)}
      >
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            role={readonly ? undefined : "radio"}
            aria-checked={value === star}
            aria-label={`${star} star${star > 1 ? "s" : ""}`}
            disabled={readonly}
            onClick={() => !readonly && onChange?.(star)}
            onMouseEnter={() => !readonly && setHovered(star)}
            className={cn(
              "transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 rounded",
              !readonly && "cursor-pointer hover:scale-110 active:scale-95",
              readonly && "cursor-default"
            )}
          >
            <svg
              viewBox="0 0 24 24"
              className={cn(SIZE_MAP[size], "transition-colors duration-100")}
              fill={display >= star ? "#F59E0B" : "none"}
              stroke={display >= star ? "#F59E0B" : "#D1D5DB"}
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M11.48 3.499a.562.562 0 0 1 1.04 0l2.125 5.111a.563.563 0 0 0 .475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 0 0-.182.557l1.285 5.385a.562.562 0 0 1-.84.61l-4.725-2.885a.562.562 0 0 0-.586 0L6.982 20.54a.562.562 0 0 1-.84-.61l1.285-5.386a.562.562 0 0 0-.182-.557l-4.204-3.602a.563.563 0 0 1 .321-.988l5.518-.442a.563.563 0 0 0 .475-.345L11.48 3.5Z"
              />
            </svg>
          </button>
        ))}
      </div>

      {showLabel && display > 0 && (
        <span className="text-sm font-medium text-amber-600 dark:text-amber-400 min-h-[1.25rem]">
          {SCORE_LABELS[display]}
        </span>
      )}
    </div>
  );
}
