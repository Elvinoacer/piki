// types/payments.ts
// Shared TypeScript types for Pikii Payments feature

import { Decimal } from "@prisma/client/runtime/library";

// ----------------------------------------------------------------
// Daraja / M-Pesa
// ----------------------------------------------------------------
export interface MpesaSTKPushRequest {
  phone: string;         // 254XXXXXXXXX format
  amount: number;        // KES, integer
  accountReference: string; // e.g. "PIKII-TRIP-{tripId}"
  transactionDesc: string;
}

export interface MpesaSTKPushResponse {
  MerchantRequestID: string;
  CheckoutRequestID: string;
  ResponseCode: string;
  ResponseDescription: string;
  CustomerMessage: string;
}

export interface MpesaSTKCallbackBody {
  Body: {
    stkCallback: {
      MerchantRequestID: string;
      CheckoutRequestID: string;
      ResultCode: number;   // 0 = success
      ResultDesc: string;
      CallbackMetadata?: {
        Item: Array<{ Name: string; Value?: string | number }>;
      };
    };
  };
}

export interface MpesaB2CRequest {
  phone: string;
  amount: number;
  remarks: string;
  occasion?: string;
}

export interface MpesaB2CResponse {
  ConversationID: string;
  OriginatorConversationID: string;
  ResponseCode: string;
  ResponseDescription: string;
}

export interface MpesaB2CCallbackBody {
  Result: {
    ResultType: number;
    ResultCode: number;
    ResultDesc: string;
    OriginatorConversationID: string;
    ConversationID: string;
    TransactionID: string;
    ResultParameters?: {
      ResultParameter: Array<{ Key: string; Value: string | number }>;
    };
  };
}

// ----------------------------------------------------------------
// Payment / Trip Payment
// ----------------------------------------------------------------
export interface InitiatePaymentInput {
  tripId: string;
  method: "MPESA" | "WALLET" | "CASH";
  phone?: string;   // required for MPESA
  amount: number;
  tipAmount?: number;
}

export interface PaymentResult {
  success: boolean;
  paymentId: string;
  method: "MPESA" | "WALLET" | "CASH";
  status: "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED";
  checkoutRequestId?: string; // MPESA only — poll/listen for callback
  message?: string;
}

// ----------------------------------------------------------------
// Wallet
// ----------------------------------------------------------------
export interface WalletBalance {
  walletId: string;
  balance: number;
  currency: string;
}

export interface WalletTopUpInput {
  phone: string;
  amount: number;
}

export interface LedgerEntry {
  id: string;
  type: "CREDIT" | "DEBIT";
  reason: string;
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  description?: string;
  referenceId?: string;
  createdAt: Date;
}

// ----------------------------------------------------------------
// Payout
// ----------------------------------------------------------------
export interface PayoutRequestInput {
  amount: number;
  phone?: string; // defaults to rider's registered phone
}

export interface PayoutResult {
  payoutId: string;
  status: "PENDING" | "PROCESSING" | "FAILED";
  message: string;
}

// ----------------------------------------------------------------
// Commission
// ----------------------------------------------------------------
export interface CommissionConfig {
  rate: number;           // 0.12 = 12%
  minFare: number;        // minimum fare before commission applies
}

export interface FareBreakdown {
  baseFare: number;
  tripFare: number;
  tip: number;
  commissionRate: number;
  commissionAmount: number;
  riderEarning: number;
  total: number;
}

// ----------------------------------------------------------------
// Receipt
// ----------------------------------------------------------------
export interface ReceiptData {
  receiptNumber: string;
  tripId: string;
  clientName: string;
  riderName: string;
  riderPlate: string;
  pickupAddress: string;
  dropoffAddress: string;
  tripDate: Date;
  distanceKm: number;
  durationMinutes: number;
  fareBreakdown: FareBreakdown;
  paymentMethod: string;
  mpesaReceiptNumber?: string;
}
