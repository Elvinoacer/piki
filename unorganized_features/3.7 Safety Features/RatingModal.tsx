"use client";
// components/safety/RatingModal.tsx
// Post-trip rating sheet. Shows after a trip is completed.
// Supports 1–5 stars, tag selection, and optional comment.

import { useState } from "react";
import {
  RATING_TAGS_CLIENT_TO_RIDER,
  RATING_TAGS_RIDER_TO_CLIENT,
  type RatingDirection,
} from "@/types/safety";

interface RatingModalProps {
  tripId: string;
  toUserId: string;
  toUserName: string;
  direction: RatingDirection;
  onComplete: () => void;
  onSkip: () => void;
}

export function RatingModal({
  tripId,
  toUserId,
  toUserName,
  direction,
  onComplete,
  onSkip,
}: RatingModalProps) {
  const [score, setScore] = useState(0);
  const [hoveredScore, setHoveredScore] = useState(0);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const availableTags =
    direction === "CLIENT_TO_RIDER"
      ? RATING_TAGS_CLIENT_TO_RIDER
      : RATING_TAGS_RIDER_TO_CLIENT;

  function toggleTag(tag: string) {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  }

  async function handleSubmit() {
    if (score === 0) {
      setError("Please choose a star rating.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/safety/rating", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tripId, toUserId, score, tags: selectedTags, comment, direction }),
      });
      if (!res.ok) throw new Error("Failed to submit rating.");
      onComplete();
    } catch {
      setError("Couldn't save your rating. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  const displayScore = hoveredScore || score;

  const scoreLabels = ["", "Poor", "Fair", "Good", "Great", "Excellent"];

  return (
    <div className="rating-modal" role="dialog" aria-modal="true" aria-label="Rate your trip">
      <div className="rating-modal__backdrop" />
      <div className="rating-modal__sheet">
        <h2 className="rating-modal__title">How was your ride?</h2>
        <p className="rating-modal__subtitle">Rate your experience with {toUserName}</p>

        {/* Star picker */}
        <div className="rating-modal__stars" role="group" aria-label="Star rating">
          {[1, 2, 3, 4, 5].map((s) => (
            <button
              key={s}
              className={`rating-star ${s <= displayScore ? "rating-star--active" : ""}`}
              onClick={() => setScore(s)}
              onMouseEnter={() => setHoveredScore(s)}
              onMouseLeave={() => setHoveredScore(0)}
              aria-label={`${s} star${s > 1 ? "s" : ""}`}
              aria-pressed={score === s}
            >
              ★
            </button>
          ))}
        </div>
        {displayScore > 0 && (
          <p className="rating-modal__score-label" aria-live="polite">
            {scoreLabels[displayScore]}
          </p>
        )}

        {/* Tags */}
        <div className="rating-modal__tags" role="group" aria-label="Quick feedback tags">
          {availableTags.map((tag) => (
            <button
              key={tag}
              className={`rating-tag ${selectedTags.includes(tag) ? "rating-tag--selected" : ""}`}
              onClick={() => toggleTag(tag)}
              aria-pressed={selectedTags.includes(tag)}
            >
              {tag}
            </button>
          ))}
        </div>

        {/* Optional comment */}
        <textarea
          className="rating-modal__comment"
          placeholder="Anything else? (optional)"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          maxLength={500}
          rows={3}
          aria-label="Additional comments"
        />

        {error && (
          <p className="rating-modal__error" role="alert">
            {error}
          </p>
        )}

        <div className="rating-modal__actions">
          <button
            className="rating-modal__submit"
            onClick={handleSubmit}
            disabled={submitting || score === 0}
          >
            {submitting ? "Submitting…" : "Submit rating"}
          </button>
          <button className="rating-modal__skip" onClick={onSkip} disabled={submitting}>
            Skip
          </button>
        </div>
      </div>
    </div>
  );
}
