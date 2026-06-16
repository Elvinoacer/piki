"use client";
// components/safety/RiderIdentityBadge.tsx
// Displayed to the client on the trip detail / matching screen.
// Shows photo, name, plate, rating, and verification badges.

import Image from "next/image";
import type { RiderIdentityBadge as RiderIdentityBadgeType } from "@/types/safety";

interface Props {
  badge: RiderIdentityBadgeType;
}

const BADGE_LABELS: Record<string, string> = {
  Verified: "✓ Verified",
  "Top Rated": "⭐ Top Rated",
  "SACCO Certified": "🏢 SACCO Certified",
  "5-Star Streak": "🔥 5-Star Streak",
};

function StarRating({ score }: { score: number }) {
  return (
    <span className="rider-badge__stars" aria-label={`Rated ${score.toFixed(1)} out of 5`}>
      {Array.from({ length: 5 }).map((_, i) => (
        <span key={i} className={i < Math.round(score) ? "star star--filled" : "star"} aria-hidden="true">
          ★
        </span>
      ))}
      <span className="rider-badge__score">{score.toFixed(1)}</span>
    </span>
  );
}

export function RiderIdentityBadge({ badge }: Props) {
  return (
    <div className="rider-badge" role="region" aria-label="Rider identity">
      <div className="rider-badge__photo-wrap">
        {badge.photo ? (
          <Image
            src={badge.photo}
            alt={`${badge.name}'s profile photo`}
            width={64}
            height={64}
            className="rider-badge__photo"
          />
        ) : (
          <div className="rider-badge__photo-placeholder" aria-hidden="true">
            {badge.name.charAt(0).toUpperCase()}
          </div>
        )}
        {badge.isVerified && (
          <span className="rider-badge__verified-dot" aria-label="Identity verified" title="Identity verified" />
        )}
      </div>

      <div className="rider-badge__info">
        <p className="rider-badge__name">{badge.name}</p>
        <p className="rider-badge__plate">{badge.plateNumber}</p>
        <StarRating score={badge.rating} />
        <p className="rider-badge__rating-count">{badge.ratingCount} trips</p>
      </div>

      {badge.badges.length > 0 && (
        <ul className="rider-badge__tag-list" aria-label="Rider badges">
          {badge.badges.map((b) => (
            <li key={b} className="rider-badge__tag">
              {BADGE_LABELS[b] ?? b}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
