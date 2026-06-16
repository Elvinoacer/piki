// types/safety.ts

export type SosStatus = "ACTIVE" | "ACKNOWLEDGED" | "RESOLVED";
export type RatingDirection = "CLIENT_TO_RIDER" | "RIDER_TO_CLIENT";
export type ReportReason =
  | "UNSAFE_DRIVING"
  | "HARASSMENT"
  | "WRONG_ROUTE"
  | "OVERCHARGING"
  | "FRAUD"
  | "IMPERSONATION"
  | "OTHER";
export type ReportStatus = "PENDING" | "UNDER_REVIEW" | "RESOLVED" | "DISMISSED";
export type CheckInStatus = "PENDING" | "SAFE" | "NO_RESPONSE";

// ── Trusted Contacts ──────────────────────────────────────────────────────────
export interface TrustedContact {
  id: string;
  userId: string;
  name: string;
  phone: string;
  createdAt: Date;
}

export interface AddTrustedContactInput {
  name: string;
  phone: string; // +254…
}

// ── SOS ───────────────────────────────────────────────────────────────────────
export interface SosEvent {
  id: string;
  tripId?: string;
  userId: string;
  latitude: number;
  longitude: number;
  status: SosStatus;
  resolvedAt?: Date;
  createdAt: Date;
}

export interface TriggerSosInput {
  tripId?: string;
  latitude: number;
  longitude: number;
}

// ── Trip Share ────────────────────────────────────────────────────────────────
export interface TripShareLink {
  id: string;
  tripId: string;
  token: string;
  expiresAt: Date;
  createdAt: Date;
}

export interface TripSharePublicView {
  tripId: string;
  status: string;
  riderName: string;
  riderPhoto: string | null;
  riderPlate: string;
  riderRating: number;
  pickup: { lat: number; lng: number; address: string };
  dropoff: { lat: number; lng: number; address: string };
  riderLat?: number;
  riderLng?: number;
  eta?: number; // seconds
}

// ── Trip Trail ────────────────────────────────────────────────────────────────
export interface TrailPoint {
  latitude: number;
  longitude: number;
  recordedAt: Date;
}

// ── Ratings ───────────────────────────────────────────────────────────────────
export const RATING_TAGS_CLIENT_TO_RIDER = [
  "safe driving",
  "polite",
  "fast",
  "clean helmet",
  "knew the route",
  "punctual",
] as const;

export const RATING_TAGS_RIDER_TO_CLIENT = [
  "ready on time",
  "clear instructions",
  "respectful",
  "good tipper",
] as const;

export type RiderRatingTag = (typeof RATING_TAGS_CLIENT_TO_RIDER)[number];
export type ClientRatingTag = (typeof RATING_TAGS_RIDER_TO_CLIENT)[number];

export interface SubmitRatingInput {
  tripId: string;
  toUserId: string;
  score: number; // 1–5
  tags: string[];
  comment?: string;
  direction: RatingDirection;
}

export interface Rating {
  id: string;
  tripId: string;
  fromUserId: string;
  toUserId: string;
  score: number;
  tags: string[];
  comment?: string;
  direction: RatingDirection;
  flagged: boolean;
  createdAt: Date;
}

// ── Report & Block ────────────────────────────────────────────────────────────
export interface SubmitReportInput {
  reportedId: string;
  tripId?: string;
  reason: ReportReason;
  description?: string;
}

export interface BlockUserInput {
  blockedId: string;
}

// ── Night Check-in ────────────────────────────────────────────────────────────
export interface NightCheckIn {
  id: string;
  tripId: string;
  userId: string;
  status: CheckInStatus;
  sentAt: Date;
  respondedAt?: Date;
}

// ── Rider Identity Badge ──────────────────────────────────────────────────────
export interface RiderIdentityBadge {
  riderId: string;
  name: string;
  photo: string | null;
  plateNumber: string;
  rating: number;
  ratingCount: number;
  isVerified: boolean;
  badges: string[]; // e.g. ["Top Rated", "SACCO Certified"]
}
