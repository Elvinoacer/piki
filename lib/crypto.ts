import crypto from "crypto";
import { getEnv } from "@/lib/env";

// -------------------------------------------------------------------------------------
// Application-level encryption for sensitive fields
// -------------------------------------------------------------------------------------
// Used for: RiderPayoutMethod.mpesaPhoneEnc / bankAccountNumberEnc,
// OAuthAccount.accessTokenEnc / refreshTokenEnc.
//
// Algorithm: AES-256-GCM. Output format: base64(iv) + ":" + base64(authTag) + ":" + base64(ciphertext)
// NFR (Security): "All PII encrypted at rest".
// -------------------------------------------------------------------------------------

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // recommended for GCM

function getKey(): Buffer {
  const { APP_ENCRYPTION_KEY } = getEnv();
  const key = Buffer.from(APP_ENCRYPTION_KEY, "base64");
  if (key.length !== 32) {
    throw new Error(
      "APP_ENCRYPTION_KEY must decode to exactly 32 bytes (base64-encoded AES-256 key)."
    );
  }
  return key;
}

/**
 * Encrypts a UTF-8 string. Returns a single string suitable for storage in a
 * Prisma `String?` column.
 */
export function encryptField(plaintext: string): string {
  const key = getKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return [iv.toString("base64"), authTag.toString("base64"), ciphertext.toString("base64")].join(
    ":"
  );
}

/**
 * Decrypts a value produced by {@link encryptField}. Throws if the value is
 * malformed or the auth tag does not verify (tampering / wrong key).
 */
export function decryptField(stored: string): string {
  const key = getKey();
  const [ivB64, tagB64, dataB64] = stored.split(":");
  if (!ivB64 || !tagB64 || !dataB64) {
    throw new Error("Malformed encrypted field value.");
  }

  const iv = Buffer.from(ivB64, "base64");
  const authTag = Buffer.from(tagB64, "base64");
  const ciphertext = Buffer.from(dataB64, "base64");

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return plaintext.toString("utf8");
}

/**
 * Masks a value for display (e.g. "+25471****678" or "****1234"), used in
 * API responses so full PII is never echoed back unnecessarily.
 */
export function maskTail(value: string, visibleTail = 4): string {
  if (value.length <= visibleTail) return "*".repeat(value.length);
  return "*".repeat(value.length - visibleTail) + value.slice(-visibleTail);
}
