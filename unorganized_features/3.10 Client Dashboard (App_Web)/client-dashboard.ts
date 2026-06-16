// ─── Shared Enums ────────────────────────────────────────────────────────────

export type TripType = "RIDE" | "PARCEL" | "ERRAND";

export type TripStatus =
  | "REQUESTED"
  | "ACCEPTED"
  | "ARRIVING"
  | "ARRIVED"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "CANCELLED";

export type PaymentMethod = "MPESA" | "WALLET" | "CASH";

export type SavedPlaceType = "HOME" | "WORK" | "FREQUENT";

// ─── Location ─────────────────────────────────────────────────────────────────

export interface LatLng {
  lat: number;
  lng: number;
}

export interface Address {
  formattedAddress: string;
  latLng: LatLng;
  placeId?: string;
}

// ─── Saved Places ─────────────────────────────────────────────────────────────

export interface SavedPlace {
  id: string;
  type: SavedPlaceType;
  label: string;
  address: Address;
  usageCount: number;
}

// ─── Rider ────────────────────────────────────────────────────────────────────

export interface RiderBadge {
  type: "VERIFIED" | "TOP_RATED" | "FIVE_STAR" | "SACCO_CERTIFIED";
  label: string;
}

export interface Rider {
  id: string;
  name: string;
  photoUrl: string;
  plateNumber: string;
  rating: number;
  totalTrips: number;
  badges: RiderBadge[];
  isFavorite: boolean;
  phoneLastFour?: string; // masked
}

export interface ActiveRiderLocation {
  latLng: LatLng;
  heading: number;
  updatedAt: string;
}

// ─── Booking Flow ─────────────────────────────────────────────────────────────

export interface BookingRequest {
  type: TripType;
  pickup: Address;
  destination: Address;
  stops?: Address[];
  scheduledAt?: string; // ISO string for scheduled rides
  paymentMethod: PaymentMethod;
  promoCode?: string;
}

export interface FareEstimate {
  baseFare: number;
  distanceFare: number;
  timeFare: number;
  surgeMultiplier: number;
  promoDiscount: number;
  totalFare: number;
  distanceKm: number;
  estimatedMinutes: number;
  currency: "KES";
}

// ─── Active Trip ───────────────────────────────────────────────────────────────

export interface ActiveTrip {
  id: string;
  status: TripStatus;
  type: TripType;
  pickup: Address;
  destination: Address;
  stops?: Address[];
  rider: Rider;
  riderLocation: ActiveRiderLocation;
  fareEstimate: FareEstimate;
  actualFare?: number;
  paymentMethod: PaymentMethod;
  etaMinutes: number;
  startedAt?: string;
  completedAt?: string;
  shareLink: string;
}

// ─── Trip History ──────────────────────────────────────────────────────────────

export interface TripHistoryItem {
  id: string;
  status: TripStatus;
  type: TripType;
  pickup: Address;
  destination: Address;
  rider: Pick<Rider, "id" | "name" | "photoUrl" | "rating" | "plateNumber">;
  actualFare: number;
  paymentMethod: PaymentMethod;
  completedAt: string;
  clientRating?: number;
  receiptUrl?: string;
  canRebook: boolean;
}

// ─── Payments & Wallet ────────────────────────────────────────────────────────

export interface WalletBalance {
  balance: number;
  currency: "KES";
  lastTopUpAt?: string;
}

// ─── Promo & Referral ─────────────────────────────────────────────────────────

export interface PromoResult {
  valid: boolean;
  discount: number;
  description: string;
  code: string;
}

export interface ReferralInfo {
  code: string;
  referralCount: number;
  creditsEarned: number;
  shareUrl: string;
}

// ─── Support ──────────────────────────────────────────────────────────────────

export interface SupportTicket {
  id: string;
  subject: string;
  status: "OPEN" | "IN_PROGRESS" | "RESOLVED" | "CLOSED";
  createdAt: string;
  lastReplyAt: string;
  tripId?: string;
}

export interface CreateTicketPayload {
  subject: string;
  description: string;
  tripId?: string;
  category: "PAYMENT" | "RIDER" | "TRIP" | "ACCOUNT" | "OTHER";
}
