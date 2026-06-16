// types/history.ts
// Feature 3.14 — Search, History & Receipts

export type TripStatus =
  | "REQUESTED"
  | "ACCEPTED"
  | "ARRIVING"
  | "ARRIVED"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "CANCELLED";

export type TripType = "RIDE" | "PARCEL" | "FOOD" | "ERRAND";

export type PaymentMethod = "MPESA" | "WALLET" | "CASH";

export interface FareBreakdown {
  baseFare: number;
  distanceFare: number;
  timeFare: number;
  surgeFactor: number;
  tip: number;
  total: number;
}

export interface TripHistoryItem {
  id: string;
  type: TripType;
  status: TripStatus;
  pickupAddress: string;
  dropoffAddress: string;
  pickupLat: number;
  pickupLng: number;
  dropoffLat: number;
  dropoffLng: number;
  fareAmount: number | null;
  fareBreakdown: FareBreakdown | null;
  distanceKm: number | null;
  durationMin: number | null;
  paymentMethod: PaymentMethod | null;
  receiptUrl: string | null;
  createdAt: string; // ISO string
  completedAt: string | null;
  cancelledAt: string | null;
  cancelReason: string | null;
  rider: {
    id: string;
    name: string;
    phone: string;
    avatarUrl: string | null;
    plateNumber: string | null;
    rating: number | null;
  } | null;
  rating: {
    score: number;
    comment: string | null;
  } | null;
}

export interface TripHistoryFilters {
  search: string;          // full-text across addresses
  dateFrom: string | null; // ISO date string
  dateTo: string | null;   // ISO date string
  type: TripType | "ALL";
  status: TripStatus | "ALL";
  page: number;
  pageSize: number;
}

export interface TripHistoryResponse {
  trips: TripHistoryItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface ReceiptGenerationResult {
  receiptUrl: string;
  tripId: string;
}
