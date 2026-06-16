"use client";
// src/components/ratings/RatingPromptModal.tsx
// Post-trip modal shown to both client and rider immediately after trip completion.

import { useState } from "react";
import { StarRating } from "./StarRating";
import { cn } from "@/lib/utils";
import { useRatingsStore } from "@/store/useRatingsStore";
import { CLIENT_TO_RIDER_TAGS, RIDER_TO_CLIENT_TAGS } from "@/types/ratings";

interface RatingPromptModalProps {
  tripId: string;
  /**
   * Who is the *subject* being rated.
   * direction="CLIENT_TO_RIDER" → client rates the rider → shows rider tags.
   * direction="RIDER_TO_CLIENT" → rider rates the client → shows client tags.
   */
  direction: "CLIENT_TO_RIDER" | "RIDER_TO_CLIENT";
  subjectName: string;
  subjectPhotoUrl?: string | null;
  onClose: () => void;
  onSuccess?: () => void;
}

export function RatingPromptModal({
  tripId,
  direction,
  subjectName,
  subjectPhotoUrl,
  onClose,
  onSuccess,
}: RatingPromptModalProps) {
  const [score, setScore] = useState(0);
  const [comment, setComment] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);

  const { submitRating, isSubmittingRating, ratingError, clearRatingError } =
    useRatingsStore();

  const tags =
    direction === "CLIENT_TO_RIDER" ? CLIENT_TO_RIDER_TAGS : RIDER_TO_CLIENT_TAGS;

  const heading =
    direction === "CLIENT_TO_RIDER"
      ? `Rate your ride with ${subjectName}`
      : `Rate your client ${subjectName}`;

  const toggleTag = (value: string) => {
    clearRatingError();
    setSelectedTags((prev) =>
      prev.includes(value) ? prev.filter((t) => t !== value) : [...prev, value]
    );
  };

  const handleSubmit = async () => {
    if (score === 0) return;
    const result = await submitRating({ tripId, score, comment, tags: selectedTags });
    if (result) onSuccess?.();
  };

  return (
    // Backdrop
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      {/* Sheet */}
      <div className="w-full max-w-md bg-white dark:bg-neutral-900 rounded-2xl shadow-2xl overflow-hidden animate-in slide-in-from-bottom-4 duration-300">
        {/* Header */}
        <div className="bg-gradient-to-br from-amber-400 to-orange-500 px-6 pt-8 pb-6 text-center">
          {subjectPhotoUrl ? (
            <img
              src={subjectPhotoUrl}
              alt={subjectName}
              className="mx-auto h-20 w-20 rounded-full object-cover ring-4 ring-white shadow-lg mb-3"
            />
          ) : (
            <div className="mx-auto h-20 w-20 rounded-full bg-white/20 flex items-center justify-center text-3xl font-bold text-white ring-4 ring-white shadow-lg mb-3">
              {subjectName[0]?.toUpperCase()}
            </div>
          )}
          <h2 className="text-lg font-semibold text-white">{heading}</h2>
          <p className="text-sm text-white/80 mt-0.5">Trip completed · How did it go?</p>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-5">
          {/* Stars */}
          <div className="flex flex-col items-center gap-2">
            <StarRating
              value={score}
              onChange={setScore}
              size="lg"
              showLabel
            />
          </div>

          {/* Tags — only shown after a score is set */}
          {score > 0 && (
            <div>
              <p className="text-xs font-medium text-neutral-500 dark:text-neutral-400 mb-2 uppercase tracking-wide">
                What stood out?
              </p>
              <div className="flex flex-wrap gap-2">
                {tags.map((tag) => (
                  <button
                    key={tag.value}
                    type="button"
                    onClick={() => toggleTag(tag.value)}
                    className={cn(
                      "rounded-full border px-3 py-1 text-sm font-medium transition-colors",
                      selectedTags.includes(tag.value)
                        ? "border-amber-500 bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
                        : "border-neutral-200 bg-neutral-50 text-neutral-600 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-300"
                    )}
                  >
                    {tag.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Optional comment */}
          {score > 0 && (
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Add a comment (optional)…"
              rows={2}
              maxLength={300}
              className="w-full resize-none rounded-xl border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 p-3 text-sm text-neutral-800 dark:text-neutral-100 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-amber-400"
            />
          )}

          {/* Error */}
          {ratingError && (
            <p className="text-sm text-red-600 dark:text-red-400">{ratingError}</p>
          )}

          {/* Actions */}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-xl border border-neutral-200 dark:border-neutral-700 py-3 text-sm font-medium text-neutral-600 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors"
            >
              Skip
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={score === 0 || isSubmittingRating}
              className="flex-[2] rounded-xl bg-amber-500 py-3 text-sm font-semibold text-white hover:bg-amber-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {isSubmittingRating ? "Submitting…" : "Submit Rating"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
