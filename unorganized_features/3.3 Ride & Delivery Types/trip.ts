// ============================================================
// src/lib/validations/trip.ts
// Pikii — Zod schemas for Section 3.3 ride & delivery types
// ============================================================

import { z } from "zod";

// ─────────────────────────────────────────────
// Shared primitives
// ─────────────────────────────────────────────

const LatLng = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  address: z.string().min(3, "Address is required"),
});

const KenyanPhone = z
  .string()
  .regex(/^(\+?254|0)7\d{8}$/, "Enter a valid Kenyan phone number");

// ─────────────────────────────────────────────
// Stop (for multi-stop trips)
// ─────────────────────────────────────────────

export const TripStopSchema = z.object({
  order: z.number().int().min(0),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  address: z.string().min(3),
  label: z.string().max(80).optional(),
});

export type TripStopInput = z.infer<typeof TripStopSchema>;

// ─────────────────────────────────────────────
// 1. Boda Ride — single passenger, point-to-point
// ─────────────────────────────────────────────

export const BodaRideSchema = z.object({
  type: z.literal("BODA_RIDE"),
  pickup: LatLng,
  dropoff: LatLng,
  clientNotes: z.string().max(200).optional(),
});

export type BodaRideInput = z.infer<typeof BodaRideSchema>;

// ─────────────────────────────────────────────
// 2. Parcel / Errand Delivery
// ─────────────────────────────────────────────

export const ParcelDeliverySchema = z.object({
  type: z.enum(["PARCEL_DELIVERY", "ERRAND"]),
  pickup: LatLng,
  dropoff: LatLng,
  parcelSize: z.enum(["SMALL", "MEDIUM", "LARGE"]),
  parcelDescription: z
    .string()
    .min(3, "Briefly describe the item(s)")
    .max(300),
  recipientName: z.string().min(2, "Recipient name is required"),
  recipientPhone: KenyanPhone,
  requiresSignature: z.boolean().default(false),
  clientNotes: z.string().max(200).optional(),
});

export type ParcelDeliveryInput = z.infer<typeof ParcelDeliverySchema>;

// ─────────────────────────────────────────────
// 3. Food / Shop Delivery (future-ready)
//    Schema is minimal now; merchantId links to
//    Phase 4 Merchant model when built.
// ─────────────────────────────────────────────

export const FoodDeliverySchema = z.object({
  type: z.literal("FOOD_DELIVERY"),
  pickup: LatLng,   // Merchant location (pre-filled from merchant profile)
  dropoff: LatLng,
  merchantId: z.string().cuid("Invalid merchant reference"),
  clientNotes: z.string().max(200).optional(),
});

export type FoodDeliveryInput = z.infer<typeof FoodDeliverySchema>;

// ─────────────────────────────────────────────
// 4. Scheduled Ride
//    All fields from BodaRide + scheduledAt
// ─────────────────────────────────────────────

const MIN_SCHEDULE_MINUTES = 30; // Must book at least 30 min in advance

export const ScheduledRideSchema = z.object({
  type: z.literal("SCHEDULED_RIDE"),
  pickup: LatLng,
  dropoff: LatLng,
  scheduledAt: z
    .string()
    .datetime({ message: "scheduledAt must be an ISO-8601 datetime" })
    .refine(
      (val) => {
        const date = new Date(val);
        const minTime = new Date(
          Date.now() + MIN_SCHEDULE_MINUTES * 60 * 1000
        );
        return date >= minTime;
      },
      {
        message: `Scheduled time must be at least ${MIN_SCHEDULE_MINUTES} minutes from now`,
      }
    ),
  clientNotes: z.string().max(200).optional(),
});

export type ScheduledRideInput = z.infer<typeof ScheduledRideSchema>;

// ─────────────────────────────────────────────
// 5. Multi-stop Trip
// ─────────────────────────────────────────────

const MAX_STOPS = 5; // Configurable ceiling

export const MultiStopSchema = z.object({
  type: z.literal("MULTI_STOP"),
  pickup: LatLng,
  // dropoff is the final stop — derived from stops array
  stops: z
    .array(TripStopSchema)
    .min(1, "Add at least one stop")
    .max(MAX_STOPS, `Maximum ${MAX_STOPS} stops allowed`),
  clientNotes: z.string().max(200).optional(),
});

export type MultiStopInput = z.infer<typeof MultiStopSchema>;

// ─────────────────────────────────────────────
// Union — single validator for API route
// ─────────────────────────────────────────────

export const CreateTripSchema = z.discriminatedUnion("type", [
  BodaRideSchema,
  ParcelDeliverySchema.extend({ type: z.literal("PARCEL_DELIVERY") }),
  ParcelDeliverySchema.extend({ type: z.literal("ERRAND") }),
  FoodDeliverySchema,
  ScheduledRideSchema,
  MultiStopSchema,
]);

export type CreateTripInput = z.infer<typeof CreateTripSchema>;

// ─────────────────────────────────────────────
// Type guards
// ─────────────────────────────────────────────

export function isParcelType(
  input: CreateTripInput
): input is ParcelDeliveryInput {
  return input.type === "PARCEL_DELIVERY" || input.type === "ERRAND";
}

export function isScheduledType(
  input: CreateTripInput
): input is ScheduledRideInput {
  return input.type === "SCHEDULED_RIDE";
}

export function isMultiStopType(
  input: CreateTripInput
): input is MultiStopInput {
  return input.type === "MULTI_STOP";
}

export function isFoodDelivery(
  input: CreateTripInput
): input is FoodDeliveryInput {
  return input.type === "FOOD_DELIVERY";
}
