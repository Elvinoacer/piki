// src/types/ratings.ts

export type RatingDirection = "CLIENT_TO_RIDER" | "RIDER_TO_CLIENT";

export type BadgeType =
  | "VERIFIED"
  | "TOP_RATED"
  | "FIVE_STAR_STREAK"
  | "SACCO_CERTIFIED";

export type DisputeStatus =
  | "OPEN"
  | "UNDER_REVIEW"
  | "RESOLVED"
  | "DISMISSED";

export type DisputeReason =
  | "WRONG_FARE"
  | "RIDER_DID_NOT_ARRIVE"
  | "UNSAFE_DRIVING"
  | "HARASSMENT"
  | "ITEM_DAMAGED_OR_LOST"
  | "ROUTE_DEVIATION"
  | "PAYMENT_ISSUE"
  | "OTHER";

// ── Tag constants ─────────────────────────────────────────────

export const CLIENT_TO_RIDER_TAGS = [
  { value: "safe_driving", label: "Safe Driving" },
  { value: "polite", label: "Polite" },
  { value: "fast", label: "Fast" },
  { value: "helmet_provided", label: "Helmet Provided" },
  { value: "on_time", label: "On Time" },
  { value: "knew_route", label: "Knew the Route" },
  { value: "clean_bike", label: "Clean Bike" },
] as const;

export const RIDER_TO_CLIENT_TAGS = [
  { value: "polite", label: "Polite" },
  { value: "ready_on_time", label: "Ready on Time" },
  { value: "clear_directions", label: "Clear Directions" },
  { value: "good_tipper", label: "Good Tipper" },
] as const;

export type ClientToRiderTag = (typeof CLIENT_TO_RIDER_TAGS)[number]["value"];
export type RiderToClientTag = (typeof RIDER_TO_CLIENT_TAGS)[number]["value"];

// ── Badge metadata ────────────────────────────────────────────

export const BADGE_META: Record<
  BadgeType,
  { label: string; description: string; icon: string; color: string }
> = {
  VERIFIED: {
    label: "Verified",
    description: "Identity and documents checked",
    icon: "shield-check",
    color: "blue",
  },
  TOP_RATED: {
    label: "Top Rated",
    description: "4.8+ average score over 50+ trips",
    icon: "star",
    color: "amber",
  },
  FIVE_STAR_STREAK: {
    label: "5-Star Streak",
    description: "10+ consecutive 5-star trips",
    icon: "zap",
    color: "purple",
  },
  SACCO_CERTIFIED: {
    label: "SACCO Certified",
    description: "Verified member of a registered SACCO",
    icon: "award",
    color: "green",
  },
};

// ── API payload types ─────────────────────────────────────────

export interface SubmitRatingPayload {
  tripId: string;
  score: number; // 1–5
  comment?: string;
  tags?: string[];
}

export interface RatingResponse {
  id: string;
  tripId: string;
  direction: RatingDirection;
  score: number;
  comment?: string | null;
  tags: string[];
  createdAt: string;
}

export interface TrustScoreResponse {
  riderId: string;
  averageScore: number;
  totalRatings: number;
  fiveStarCount: number;
  oneStarCount: number;
  currentStreakCount: number;
  matchingPriority: number;
  tierLevel: number;
  badges: BadgeSummary[];
}

export interface BadgeSummary {
  type: BadgeType;
  label: string;
  awardedAt: string;
  expiresAt?: string | null;
  isActive: boolean;
}

export interface SubmitDisputePayload {
  tripId: string;
  ratingId?: string;
  reason: DisputeReason;
  description: string;
}

export interface DisputeResponse {
  id: string;
  tripId: string;
  reason: DisputeReason;
  status: DisputeStatus;
  createdAt: string;
}

export interface RatingSummaryForTrip {
  hasRatedAsClient?: boolean;
  hasRatedAsRider?: boolean;
  clientToRiderRating?: RatingResponse | null;
  riderToClientRating?: RatingResponse | null;
  canDispute: boolean;
}
