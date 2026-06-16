"use client";
// src/components/ratings/BadgeChip.tsx

import { cn } from "@/lib/utils";
import { BADGE_META } from "@/types/ratings";
import type { BadgeType } from "@/types/ratings";

interface BadgeChipProps {
  type: BadgeType;
  size?: "sm" | "md";
  className?: string;
}

const COLOR_CLASSES: Record<string, string> = {
  blue: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800",
  amber: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800",
  purple: "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950 dark:text-purple-300 dark:border-purple-800",
  green: "bg-green-50 text-green-700 border-green-200 dark:bg-green-950 dark:text-green-300 dark:border-green-800",
};

const BADGE_ICONS: Record<BadgeType, JSX.Element> = {
  VERIFIED: (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
      <path
        fillRule="evenodd"
        d="M16.403 12.652a3 3 0 0 0 0-5.304 3 3 0 0 0-3.75-3.751 3 3 0 0 0-5.305 0 3 3 0 0 0-3.751 3.75 3 3 0 0 0 0 5.305 3 3 0 0 0 3.75 3.751 3 3 0 0 0 5.305 0 3 3 0 0 0 3.751-3.75Zm-2.546-4.46a.75.75 0 0 0-1.214-.883l-3.483 4.79-1.88-1.88a.75.75 0 1 0-1.06 1.061l2.5 2.5a.75.75 0 0 0 1.137-.089l4-5.5Z"
        clipRule="evenodd"
      />
    </svg>
  ),
  TOP_RATED: (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
      <path
        fillRule="evenodd"
        d="M10.868 2.884c-.321-.772-1.415-.772-1.736 0l-1.83 4.401-4.753.381c-.833.067-1.171 1.107-.536 1.651l3.62 3.102-1.106 4.637c-.194.813.691 1.456 1.405 1.02L10 15.591l4.069 2.485c.713.436 1.598-.207 1.404-1.02l-1.106-4.637 3.62-3.102c.635-.544.297-1.584-.536-1.65l-4.752-.382-1.831-4.401Z"
        clipRule="evenodd"
      />
    </svg>
  ),
  FIVE_STAR_STREAK: (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
      <path d="M11.983 1.907a.75.75 0 0 0-1.292-.657l-8.5 9.5A.75.75 0 0 0 2.75 12h6.572l-1.305 6.093a.75.75 0 0 0 1.292.657l8.5-9.5A.75.75 0 0 0 17.25 8h-6.572l1.305-6.093Z" />
    </svg>
  ),
  SACCO_CERTIFIED: (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
      <path
        fillRule="evenodd"
        d="M9.664 1.319a.75.75 0 0 1 .672 0 41.059 41.059 0 0 1 8.198 5.424.75.75 0 0 1-.254 1.285 31.372 31.372 0 0 0-7.86 3.83.75.75 0 0 1-.84 0 31.508 31.508 0 0 0-2.08-1.287V9.394c0-.244.116-.463.315-.6a35.504 35.504 0 0 1 3.043-1.725 37.137 37.137 0 0 1 5.094-2.051 39.487 39.487 0 0 0-5.056-2.828 39.608 39.608 0 0 0-4.988 2.504c-.2.127-.46.126-.657-.003L3.382 7.97a.75.75 0 0 1-.004-1.248 41.803 41.803 0 0 1 6.286-5.403ZM4.5 12.319a31.2 31.2 0 0 0-1.91 2.042.75.75 0 0 0 .566 1.229h13.688a.75.75 0 0 0 .566-1.229 31.198 31.198 0 0 0-1.91-2.042A32.977 32.977 0 0 1 10 14.062a32.978 32.978 0 0 1-5.5-1.743Z"
        clipRule="evenodd"
      />
    </svg>
  ),
};

export function BadgeChip({ type, size = "md", className }: BadgeChipProps) {
  const meta = BADGE_META[type];
  const colors = COLOR_CLASSES[meta.color];

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border font-medium",
        size === "sm" ? "px-2 py-0.5 text-xs" : "px-2.5 py-1 text-xs",
        colors,
        className
      )}
      title={meta.description}
    >
      {BADGE_ICONS[type]}
      {meta.label}
    </span>
  );
}
