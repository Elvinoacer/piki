// -------------------------------------------------------------------------------------
// Kenyan Phone Number Utilities
// -------------------------------------------------------------------------------------
// Pikii's primary identifier is a Kenyan phone number stored in E.164 format
// (+254XXXXXXXXX). Users may enter numbers in several common local formats:
//   - 0712345678        (Safaricom/Airtel mobile, leading 0)
//   - 0112345678        (newer 01-prefixed mobile ranges)
//   - 712345678         (no leading 0)
//   - 254712345678      (country code, no +)
//   - +254712345678     (E.164, already correct)
//
// This module normalizes all of the above to a single canonical E.164 string
// and validates that the result is a plausible Kenyan mobile number.
// -------------------------------------------------------------------------------------

/**
 * Strips whitespace, hyphens, and parentheses commonly found in pasted
 * phone numbers (e.g. "+254 712 345 678" or "(07) 1234-5678").
 */
function stripFormatting(input: string): string {
  return input.replace(/[\s\-()]/g, "");
}

/**
 * Normalizes a user-entered Kenyan phone number to E.164 (+254XXXXXXXXX).
 *
 * @returns the normalized number, or `null` if the input cannot be
 * confidently normalized to a valid Kenyan mobile number.
 */
export function normalizeKenyanPhone(input: string): string | null {
  let phone = stripFormatting(input);

  // Remove a leading "+" for uniform processing, re-add at the end.
  const hadPlus = phone.startsWith("+");
  if (hadPlus) phone = phone.slice(1);

  // Already has country code (254...)
  if (phone.startsWith("254")) {
    // expected length: 254 + 9 digits = 12
    const rest = phone.slice(3);
    if (!/^\d{9}$/.test(rest)) return null;
    if (!isValidLocalMobilePrefix(rest)) return null;
    return `+254${rest}`;
  }

  // Local format with leading 0 (0712345678 / 0112345678) -> 10 digits total
  if (phone.startsWith("0")) {
    const rest = phone.slice(1);
    if (!/^\d{9}$/.test(rest)) return null;
    if (!isValidLocalMobilePrefix(rest)) return null;
    return `+254${rest}`;
  }

  // Bare 9-digit local number without leading 0 (712345678 / 112345678)
  if (/^\d{9}$/.test(phone)) {
    if (!isValidLocalMobilePrefix(phone)) return null;
    return `+254${phone}`;
  }

  return null;
}

/**
 * Checks that the 9-digit subscriber number (after the leading 0 / country
 * code has been stripped) starts with a digit range used by Kenyan mobile
 * networks. Currently covers 7xx and 1xx ranges (Safaricom, Airtel, Telkom,
 * and newer 01x allocations). This is intentionally permissive — full MNO
 * validation is out of scope; the goal is to reject obviously-invalid input
 * (e.g. landline 020... numbers) early.
 */
function isValidLocalMobilePrefix(nineDigits: string): boolean {
  return /^[17]\d{8}$/.test(nineDigits);
}

/**
 * Returns true if `input`, after normalization, is a valid Kenyan mobile
 * number in E.164 format.
 */
export function isValidKenyanPhone(input: string): boolean {
  return normalizeKenyanPhone(input) !== null;
}

/**
 * Formats an E.164 Kenyan number for display, e.g. "+254 712 345 678".
 * Returns the input unchanged if it doesn't match the expected shape.
 */
export function formatKenyanPhoneForDisplay(e164: string): string {
  const match = e164.match(/^\+254(\d{3})(\d{3})(\d{3})$/);
  if (!match) return e164;
  return `+254 ${match[1]} ${match[2]} ${match[3]}`;
}
