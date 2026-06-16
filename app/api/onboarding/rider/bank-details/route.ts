import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser, assertRole } from "@/lib/auth/session";
import { payoutMethodSchema } from "@/lib/validation/onboarding";
import { normalizeKenyanPhone } from "@/lib/validation/phone";
import { encryptField, decryptField, maskTail } from "@/lib/crypto";
import { ok, created, errorResponse, resolveLocale, ApiError } from "@/lib/api-response";
import { t } from "@/lib/i18n/messages";
import type { Prisma } from "@/app/generated/prisma/client";

// =====================================================================================
// POST /api/onboarding/rider/bank-details
// -------------------------------------------------------------------------------------
// Header: Authorization: Bearer <accessToken>  (role: RIDER)
// Body: discriminated union on `method`:
//   { method: "MPESA", mpesaPhone, isDefault? }
//   { method: "BANK_TRANSFER", bankName, bankBranch?, bankAccountNumber,
//     accountHolderName, isDefault? }
//
// Implements 3.1 "Bank/M-Pesa details for payouts." Sensitive account
// identifiers (M-Pesa phone, bank account number) are AES-256-GCM encrypted
// before storage (see lib/crypto) — NFR: "All PII encrypted at rest."
//
// If `isDefault` (default true), any other payout methods for this rider
// are demoted (isDefault=false) so exactly one default exists.
// =====================================================================================

export async function POST(req: NextRequest) {
  const locale = resolveLocale(req.headers.get("x-locale"));

  try {
    const session = await requireUser(req);
    assertRole(session, ["RIDER"]);

    const input = payoutMethodSchema.parse(await req.json());

    const rider = await prisma.riderProfile.findUnique({ where: { userId: session.id } });
    if (!rider) {
      throw new ApiError(404, "NOT_FOUND", locale);
    }

    let createData: Prisma.RiderPayoutMethodUncheckedCreateInput;

    if (input.method === "MPESA") {
      const normalizedPhone = normalizeKenyanPhone(input.mpesaPhone);
      if (!normalizedPhone) {
        throw new ApiError(422, "VALIDATION_ERROR", session.locale, {
          fieldErrors: { mpesaPhone: ["Please enter a valid Kenyan phone number."] },
        });
      }
      createData = {
        riderId: rider.id,
        method: "MPESA",
        mpesaPhoneEnc: encryptField(normalizedPhone),
        isDefault: input.isDefault,
      };
    } else {
      createData = {
        riderId: rider.id,
        method: "BANK_TRANSFER",
        bankName: input.bankName,
        bankBranch: input.bankBranch,
        bankAccountNumberEnc: encryptField(input.bankAccountNumber),
        accountHolderName: input.accountHolderName,
        isDefault: input.isDefault,
      };
    }

    const payoutMethod = await prisma.$transaction(async (tx) => {
      if (input.isDefault) {
        await tx.riderPayoutMethod.updateMany({
          where: { riderId: rider.id, isDefault: true },
          data: { isDefault: false },
        });
      }
      return tx.riderPayoutMethod.create({ data: createData });
    });

    return created({
      message: t(session.locale, "PAYOUT_METHOD_ADDED"),
      payoutMethod: serializePayoutMethod(payoutMethod),
    });
  } catch (err) {
    return errorResponse(err, locale);
  }
}

// -------------------------------------------------------------------------------------
// GET /api/onboarding/rider/bank-details
// -------------------------------------------------------------------------------------
// Lists the caller's registered payout methods. Account identifiers are
// returned MASKED (e.g. "+25471****678", "****4521") — full values are
// never re-exposed via the API after creation, only used internally by the
// payouts feature (3.5) when actually disbursing funds.
// -------------------------------------------------------------------------------------

export async function GET(req: NextRequest) {
  const locale = resolveLocale(req.headers.get("x-locale"));

  try {
    const session = await requireUser(req);
    assertRole(session, ["RIDER"]);

    const rider = await prisma.riderProfile.findUnique({ where: { userId: session.id } });
    if (!rider) {
      throw new ApiError(404, "NOT_FOUND", locale);
    }

    const methods = await prisma.riderPayoutMethod.findMany({
      where: { riderId: rider.id },
      orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
    });

    return ok({ payoutMethods: methods.map(serializePayoutMethod) });
  } catch (err) {
    return errorResponse(err, locale);
  }
}

function serializePayoutMethod(pm: {
  id: string;
  method: string;
  mpesaPhoneEnc: string | null;
  bankName: string | null;
  bankBranch: string | null;
  bankAccountNumberEnc: string | null;
  accountHolderName: string | null;
  isDefault: boolean;
  isVerified: boolean;
  createdAt: Date;
}) {
  return {
    id: pm.id,
    method: pm.method,
    mpesaPhoneMasked: pm.mpesaPhoneEnc ? maskWithDecrypt(pm.mpesaPhoneEnc) : null,
    bankName: pm.bankName,
    bankBranch: pm.bankBranch,
    bankAccountNumberMasked: pm.bankAccountNumberEnc ? maskWithDecrypt(pm.bankAccountNumberEnc) : null,
    accountHolderName: pm.accountHolderName,
    isDefault: pm.isDefault,
    isVerified: pm.isVerified,
    createdAt: pm.createdAt,
  };
}

function maskWithDecrypt(encrypted: string): string {
  // Decrypt only to compute a display mask; the plaintext is never returned
  // to the caller — this function's return value replaces it immediately.
  return maskTail(decryptField(encrypted));
}
