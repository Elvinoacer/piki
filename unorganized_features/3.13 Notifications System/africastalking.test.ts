import { describe, it, expect } from "vitest";
import { normalizeToE164 } from "../providers/africastalking";

describe("normalizeToE164", () => {
  it("leaves an already-E164 number untouched", () => {
    expect(normalizeToE164("+254712345678")).toBe("+254712345678");
  });

  it("converts a 0-prefixed Kenyan number to E164", () => {
    expect(normalizeToE164("0712345678")).toBe("+254712345678");
  });

  it("converts a 254-prefixed number without + to E164", () => {
    expect(normalizeToE164("254712345678")).toBe("+254712345678");
  });

  it("strips spaces and dashes before normalising", () => {
    expect(normalizeToE164("0712 345 678")).toBe("+254712345678");
    expect(normalizeToE164("0712-345-678")).toBe("+254712345678");
  });

  it("handles numbers without any prefix by assuming +254", () => {
    expect(normalizeToE164("712345678")).toBe("+254712345678");
  });
});
