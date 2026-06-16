// src/types/sacco.ts
// Shared TypeScript types for the SACCO / Fleet Management module

import type { Decimal } from "@prisma/client/runtime/library";

// ── Enums (mirror Prisma enums for client-side use) ──────────
export type SaccoStatus = "ACTIVE" | "SUSPENDED" | "PENDING_APPROVAL";
export type SaccoRole = "OWNER" | "MANAGER" | "MEMBER";
export type PayoutManager = "PLATFORM" | "SACCO";
export type SaccoRiderStatus = "ACTIVE" | "SUSPENDED" | "REMOVED";
export type BulkJobStatus = "PENDING" | "IN_PROGRESS" | "COMPLETED" | "FAILED";
export type PayoutBatchStatus = "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED";
export type VerificationResult = "APPROVED" | "REJECTED" | "NEEDS_REVIEW";

// ── Core DTOs returned from API routes ───────────────────────

export interface SaccoOrgDTO {
  id: string;
  name: string;
  registrationNo: string | null;
  contactPhone: string | null;
  contactEmail: string | null;
  logoUrl: string | null;
  status: SaccoStatus;
  platformCommissionPct: string; // serialised Decimal
  saccoCommissionPct: string;
  payoutManagedBy: PayoutManager;
  createdAt: string;
}

export interface SaccoRiderDTO {
  id: string; // RiderProfile.id
  userId: string;
  fullName: string;
  phone: string;
  avatarUrl: string | null;
  vehiclePlate: string | null;
  rating: string;
  saccoStatus: SaccoRiderStatus;
  saccoJoinedAt: string | null;
  onlineStatus: boolean;
  tripCount: number;
  totalEarnings: string;
  activeZones: string[]; // zone names
  documentsExpiringSoon: number; // count of docs expiring in ≤30 days
  commissionOverride: CommissionRuleDTO | null;
}

export interface CommissionRuleDTO {
  id: string;
  saccoId: string;
  riderProfileId: string | null;
  platformCommissionPct: string;
  saccoCommissionPct: string;
  effectiveFrom: string;
  effectiveTo: string | null;
  note: string | null;
}

export interface ZoneAssignmentDTO {
  id: string;
  riderProfileId: string;
  riderName: string;
  zoneId: string;
  zoneName: string;
  assignedAt: string;
  removedAt: string | null;
}

export interface ZoneDTO {
  id: string;
  name: string;
  riderCount: number;
}

export interface BulkVerificationJobDTO {
  id: string;
  saccoId: string;
  initiatedBy: string;
  totalCount: number;
  processedCount: number;
  status: BulkJobStatus;
  createdAt: string;
  completedAt: string | null;
}

export interface BulkVerificationItemDTO {
  id: string;
  documentId: string;
  riderName: string;
  docType: string;
  fileUrl: string;
  expiryDate: string | null;
  result: VerificationResult | null;
  reviewNote: string | null;
}

export interface SaccoPayoutBatchDTO {
  id: string;
  saccoId: string;
  initiatedBy: string;
  totalAmount: string;
  status: PayoutBatchStatus;
  mpesaB2CRef: string | null;
  note: string | null;
  createdAt: string;
  processedAt: string | null;
  payoutCount: number;
}

export interface RiderPayoutDTO {
  riderId: string;
  riderName: string;
  phone: string;
  pendingEarnings: string;
  lastPayoutDate: string | null;
  selected?: boolean;
}

// ── Fleet analytics ──────────────────────────────────────────

export interface FleetAnalyticsDTO {
  period: "today" | "week" | "month";
  activeRiders: number;
  onlineNow: number;
  tripsCompleted: number;
  totalRevenue: string;
  totalCommissionEarned: string; // SACCO's cut
  topPerformers: TopPerformerDTO[];
  documentsExpiringSoon: number;
  documentsExpired: number;
}

export interface TopPerformerDTO {
  riderProfileId: string;
  riderName: string;
  avatarUrl: string | null;
  tripsCompleted: number;
  earnings: string;
  rating: string;
}

export interface ComplianceRiderDTO {
  riderProfileId: string;
  riderName: string;
  phone: string;
  avatarUrl: string | null;
  documents: ComplianceDocDTO[];
  overallStatus: "COMPLIANT" | "EXPIRING_SOON" | "EXPIRED" | "MISSING";
}

export interface ComplianceDocDTO {
  id: string;
  type: string; // e.g. "DRIVING_LICENSE", "INSURANCE"
  verificationStatus: "PENDING" | "APPROVED" | "REJECTED" | "EXPIRED";
  expiryDate: string | null;
  daysUntilExpiry: number | null;
}

// ── Request / Input shapes ────────────────────────────────────

export interface SetCommissionInput {
  riderProfileId?: string | null; // null = fleet-wide
  platformCommissionPct: number;
  saccoCommissionPct: number;
  effectiveTo?: string | null;
  note?: string | null;
}

export interface AssignZoneInput {
  riderProfileIds: string[];
  zoneId: string;
}

export interface RemoveZoneInput {
  riderProfileId: string;
  zoneId: string;
}

export interface InitiatePayoutBatchInput {
  riderProfileIds: string[];
  note?: string;
}

export interface BulkVerifyInput {
  items: {
    documentId: string;
    result: VerificationResult;
    reviewNote?: string;
  }[];
}

export interface OnboardRiderToSaccoInput {
  riderProfileId: string;
}

export interface RemoveRiderFromSaccoInput {
  riderProfileId: string;
  reason?: string;
}

// ── Zustand store shape ──────────────────────────────────────

export interface SaccoStore {
  // Org
  sacco: SaccoOrgDTO | null;
  setSacco: (sacco: SaccoOrgDTO | null) => void;

  // Riders
  riders: SaccoRiderDTO[];
  ridersLoading: boolean;
  setRiders: (riders: SaccoRiderDTO[]) => void;
  setRidersLoading: (v: boolean) => void;

  // Analytics
  analytics: FleetAnalyticsDTO | null;
  analyticsLoading: boolean;
  setAnalytics: (a: FleetAnalyticsDTO | null) => void;
  setAnalyticsLoading: (v: boolean) => void;

  // Compliance
  compliance: ComplianceRiderDTO[];
  complianceLoading: boolean;
  setCompliance: (c: ComplianceRiderDTO[]) => void;
  setComplianceLoading: (v: boolean) => void;

  // Payout
  payoutBatches: SaccoPayoutBatchDTO[];
  payoutBatchesLoading: boolean;
  setPayoutBatches: (b: SaccoPayoutBatchDTO[]) => void;
  setPayoutBatchesLoading: (v: boolean) => void;

  // Zones
  zones: ZoneDTO[];
  setZones: (z: ZoneDTO[]) => void;
}
