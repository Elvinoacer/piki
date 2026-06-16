import crypto from "crypto";
import { prisma } from "@/lib/prisma";

// -------------------------------------------------------------------------------------
// Referral Code Generation (3.15 — referenced field on User)
// -------------------------------------------------------------------------------------
// Generates a short, human-shareable, collision-checked referral code at
// signup. Format: 6 uppercase alphanumeric characters (e.g. "PK7X2A"),
// excluding visually-ambiguous characters (0/O, 1/I/L).
// -------------------------------------------------------------------------------------

const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // no 0/O/1/I/L

function randomCode(length = 6): string {
  let out = "";
  for (let i = 0; i < length; i++) {
    out += ALPHABET[crypto.randomInt(0, ALPHABET.length)];
  }
  return out;
}

/**
 * Generates a unique referral code, retrying on collision (extremely rare
 * given ~1B combinations at length 6, but checked for correctness).
 */
export async function generateUniqueReferralCode(): Promise<string> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = randomCode();
    const existing = await prisma.user.findUnique({
      where: { referralCode: code },
      select: { id: true },
    });
    if (!existing) return code;
  }
  // Fallback: extend length on repeated collisions (should never realistically happen).
  return randomCode(8);
}
