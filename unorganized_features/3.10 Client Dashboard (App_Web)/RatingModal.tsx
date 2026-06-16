"use client";

import { useState, useTransition } from "react";
import { Star, Loader2 } from "lucide-react";
import { useTripStore } from "@/stores/trip.store";
import { submitRating } from "@/app/(client)/dashboard/actions";
import { cn } from "@/lib/utils";

const RATING_TAGS = [
  "Safe driving",
  "Polite",
  "Fast",
  "Knew the route",
  "Clean bike",
  "Wore helmet",
  "On time",
];

export function RatingModal() {
  const { pendingRatingTripId, activeTrip, clearRating } = useTripStore();
  const [score, setScore] = useState(0);
  const [hovered, setHovered] = useState(0);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [comment, setComment] = useState("");
  const [isSubmitting, startSubmit] = useTransition();

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const handleSubmit = () => {
    if (!pendingRatingTripId || score === 0) return;
    startSubmit(async () => {
      await submitRating(pendingRatingTripId, score, selectedTags, comment || undefined);
      clearRating();
    });
  };

  return (
    <div className="rounded-2xl bg-white shadow-xl ring-1 ring-black/5">
      <div className="p-5 space-y-5 text-center">
        {/* Rider avatar */}
        {activeTrip?.rider.photoUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={activeTrip.rider.photoUrl}
            alt={activeTrip.rider.name}
            className="mx-auto h-16 w-16 rounded-full object-cover ring-2 ring-orange-200"
          />
        )}

        <div>
          <h2 className="text-lg font-bold text-gray-900">
            How was your trip?
          </h2>
          <p className="mt-0.5 text-sm text-gray-500">
            {activeTrip?.rider.name ?? "Your rider"} would appreciate your feedback.
          </p>
        </div>

        {/* Star rating */}
        <div className="flex items-center justify-center gap-2">
          {[1, 2, 3, 4, 5].map((s) => (
            <button
              key={s}
              onMouseEnter={() => setHovered(s)}
              onMouseLeave={() => setHovered(0)}
              onClick={() => setScore(s)}
            >
              <Star
                size={32}
                className={cn(
                  "transition-colors",
                  (hovered || score) >= s
                    ? "fill-amber-400 text-amber-400"
                    : "fill-gray-200 text-gray-200"
                )}
              />
            </button>
          ))}
        </div>

        {/* Tags */}
        {score > 0 && (
          <div className="flex flex-wrap justify-center gap-2">
            {RATING_TAGS.map((tag) => (
              <button
                key={tag}
                onClick={() => toggleTag(tag)}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-xs font-medium transition-all",
                  selectedTags.includes(tag)
                    ? "border-orange-400 bg-orange-50 text-orange-700"
                    : "border-gray-200 text-gray-600 hover:bg-gray-50"
                )}
              >
                {tag}
              </button>
            ))}
          </div>
        )}

        {/* Optional comment */}
        {score > 0 && (
          <textarea
            rows={2}
            placeholder="Add a comment (optional)"
            className="w-full resize-none rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-800 outline-none focus:border-orange-300 focus:ring-2 focus:ring-orange-100"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
          />
        )}

        <div className="flex gap-2">
          <button
            onClick={clearRating}
            className="flex-1 rounded-xl border border-gray-200 py-3 text-sm font-medium text-gray-600 hover:bg-gray-50"
          >
            Skip
          </button>
          <button
            onClick={handleSubmit}
            disabled={score === 0 || isSubmitting}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-orange-500 py-3 text-sm font-semibold text-white hover:bg-orange-600 disabled:opacity-60"
          >
            {isSubmitting ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              "Submit rating"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
