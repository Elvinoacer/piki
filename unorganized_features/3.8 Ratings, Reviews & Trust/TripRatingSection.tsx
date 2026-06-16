"use client";
// src/components/ratings/TripRatingSection.tsx
// Shown at the bottom of a completed trip card in trip history.
// Handles: rating CTA, already-rated summary, and dispute link.

import { useEffect, useState } from "react";
import { StarRating } from "./StarRating";
import { DisputeForm } from "./DisputeForm";
import { RatingPromptModal } from "./RatingPromptModal";
import { useRatingsStore } from "@/store/useRatingsStore";

interface TripRatingSectionProps {
  tripId: string;
  /** Role of the CURRENT user viewing this section */
  viewerRole: "CLIENT" | "RIDER";
  /** Name of the OTHER party (who gets rated) */
  otherPartyName: string;
  otherPartyPhotoUrl?: string | null;
}

export function TripRatingSection({
  tripId,
  viewerRole,
  otherPartyName,
  otherPartyPhotoUrl,
}: TripRatingSectionProps) {
  const { tripRatingSummaryCache, fetchTripRatingSummary } = useRatingsStore();
  const summary = tripRatingSummaryCache[tripId];

  const [showRatingModal, setShowRatingModal] = useState(false);
  const [showDisputeForm, setShowDisputeForm] = useState(false);
  const [disputeSubmitted, setDisputeSubmitted] = useState(false);

  useEffect(() => {
    if (!summary) fetchTripRatingSummary(tripId);
  }, [tripId, summary, fetchTripRatingSummary]);

  if (!summary) {
    return (
      <div className="animate-pulse mt-4 h-10 rounded-xl bg-neutral-100 dark:bg-neutral-800" />
    );
  }

  const direction =
    viewerRole === "CLIENT" ? "CLIENT_TO_RIDER" : "RIDER_TO_CLIENT";
  const alreadyRated =
    viewerRole === "CLIENT" ? summary.hasRatedAsClient : summary.hasRatedAsRider;
  const myRating =
    viewerRole === "CLIENT"
      ? summary.clientToRiderRating
      : summary.riderToClientRating;

  return (
    <div className="mt-4 space-y-3 border-t border-neutral-100 dark:border-neutral-800 pt-4">
      {/* Already rated → show submitted score */}
      {alreadyRated && myRating ? (
        <div className="flex items-center gap-3">
          <StarRating value={myRating.score} readonly size="sm" />
          <span className="text-sm text-neutral-500">
            You gave {myRating.score} star{myRating.score !== 1 ? "s" : ""}
            {myRating.comment ? ` · "${myRating.comment}"` : ""}
          </span>
        </div>
      ) : (
        /* Not yet rated → CTA */
        <button
          type="button"
          onClick={() => setShowRatingModal(true)}
          className="w-full rounded-xl bg-amber-500 py-2.5 text-sm font-semibold text-white hover:bg-amber-600 transition-colors"
        >
          Rate this trip ★
        </button>
      )}

      {/* Dispute section */}
      {summary.canDispute && !disputeSubmitted && (
        <div>
          {showDisputeForm ? (
            <DisputeForm
              tripId={tripId}
              ratingId={myRating?.id}
              onSuccess={() => {
                setShowDisputeForm(false);
                setDisputeSubmitted(true);
              }}
              onCancel={() => setShowDisputeForm(false)}
            />
          ) : (
            <button
              type="button"
              onClick={() => setShowDisputeForm(true)}
              className="text-xs text-neutral-400 hover:text-red-500 underline underline-offset-2 transition-colors"
            >
              Report an issue with this trip
            </button>
          )}
        </div>
      )}

      {disputeSubmitted && (
        <p className="text-xs text-green-600 dark:text-green-400">
          ✓ Dispute submitted. Our team will review within 24h.
        </p>
      )}

      {/* Rating modal */}
      {showRatingModal && (
        <RatingPromptModal
          tripId={tripId}
          direction={direction}
          subjectName={otherPartyName}
          subjectPhotoUrl={otherPartyPhotoUrl}
          onClose={() => setShowRatingModal(false)}
          onSuccess={() => {
            setShowRatingModal(false);
            fetchTripRatingSummary(tripId); // refresh summary
          }}
        />
      )}
    </div>
  );
}
