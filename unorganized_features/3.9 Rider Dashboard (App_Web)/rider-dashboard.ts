// types/rider-dashboard.ts
// All TypeScript types for the Rider Dashboard (PRD §3.9)

export type RiderStatus = "AVAILABLE" | "ON_TRIP" | "BREAK" | "OFFLINE";

export type TripStatus =
  | "REQUESTED"
  | "ACCEPTED"
  | "ARRIVING"
  | "ARRIVED"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "CANCELLED";

export type TripType = "RIDE" | "PARCEL" | "ERRAND" | "FOOD";

export type PaymentMethod = "MPESA" | "WALLET" | "CASH";

export type PayoutStatus = "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED";

export type DocumentType =
  | "NATIONAL_ID"
  | "DRIVING_LICENSE"
  | "PSV_BADGE"
  | "LOGBOOK"
  | "INSURANCE";

export type DocumentVerificationStatus =
  | "PENDING"
  | "VERIFIED"
  | "REJECTED"
  | "EXPIRED";

// ─── Incoming ride request ──────────────────────────────────────────────────

export interface IncomingRequest {
  id: string;
  tripType: TripType;
  pickupAddress: string;
  dropoffAddress: string;
  pickupLat: number;
  pickupLng: number;
  dropoffLat: number;
  dropoffLng: number;
  /** Estimated fare in KES */
  estimatedFare: number;
  /** Distance in km */
  estimatedDistance: number;
  /** Client's aggregate rating */
  clientRating: number;
  /** Seconds remaining to accept */
  countdownSeconds: number;
  /** ISO timestamp the request was broadcast */
  broadcastAt: string;
}

// ─── Earnings ───────────────────────────────────────────────────────────────

export interface TripEarning {
  tripId: string;
  completedAt: string;
  pickupAddress: string;
  dropoffAddress: string;
  tripType: TripType;
  grossFare: number;
  commission: number;
  /** Net credited to wallet */
  net: number;
  paymentMethod: PaymentMethod;
  clientName: string;
  clientRating: number | null;
}

export interface EarningsSummary {
  today: number;
  thisWeek: number;
  thisMonth: number;
  pendingPayout: number;
  trips: TripEarning[];
}

// ─── Trip history ────────────────────────────────────────────────────────────

export interface TripHistoryItem {
  id: string;
  status: TripStatus;
  tripType: TripType;
  pickupAddress: string;
  dropoffAddress: string;
  startedAt: string | null;
  completedAt: string | null;
  fare: number;
  paymentMethod: PaymentMethod;
  clientName: string;
  clientAvatar: string | null;
  ratingReceived: number | null;
  ratingComment: string | null;
  distanceKm: number;
}

// ─── Payouts ────────────────────────────────────────────────────────────────

export interface PayoutRequest {
  id: string;
  amount: number;
  status: PayoutStatus;
  requestedAt: string;
  processedAt: string | null;
  mpesaRef: string | null;
  phoneNumber: string;
}

export interface WalletBalance {
  available: number;
  pending: number;
}

// ─── Performance stats ───────────────────────────────────────────────────────

export interface PerformanceStats {
  acceptanceRate: number; // 0-100
  completionRate: number; // 0-100
  averageRating: number; // 1-5
  totalDistanceKm: number;
  totalTrips: number;
  totalEarningsAllTime: number;
}

// ─── Documents ───────────────────────────────────────────────────────────────

export interface RiderDocument {
  id: string;
  type: DocumentType;
  label: string;
  expiryDate: string | null;
  /** Days until expiry; null if no expiry */
  daysUntilExpiry: number | null;
  verificationStatus: DocumentVerificationStatus;
  fileUrl: string | null;
}

// ─── Heatmap ─────────────────────────────────────────────────────────────────

export interface HeatmapPoint {
  lat: number;
  lng: number;
  /** 0-1 intensity weight */
  weight: number;
}

// ─── Rider profile (dashboard header) ────────────────────────────────────────

export interface RiderProfile {
  id: string;
  name: string;
  phone: string;
  avatarUrl: string | null;
  status: RiderStatus;
  rating: number;
  badges: string[];
  plateNumber: string;
  saccoName: string | null;
}

// ─── Full dashboard payload (single SSR fetch) ───────────────────────────────

export interface RiderDashboardData {
  rider: RiderProfile;
  earnings: EarningsSummary;
  tripHistory: TripHistoryItem[];
  payouts: PayoutRequest[];
  wallet: WalletBalance;
  performance: PerformanceStats;
  documents: RiderDocument[];
  heatmapPoints: HeatmapPoint[];
}
