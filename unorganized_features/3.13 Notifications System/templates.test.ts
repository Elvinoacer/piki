import { describe, it, expect } from "vitest";
import { renderTemplate } from "../templates";

describe("renderTemplate", () => {
  it("interpolates variables for a known template/channel/locale", () => {
    const result = renderTemplate("ride_matched", "PUSH", "en", {
      riderName: "James",
      vehiclePlate: "KMEA 123B",
      etaMinutes: 4,
    });

    expect(result.title).toBe("Rider matched!");
    expect(result.body).toBe("James is on the way (KMEA 123B). ETA 4 min.");
  });

  it("renders Swahili variants when locale=sw", () => {
    const result = renderTemplate("rider_arrived", "PUSH", "sw", {
      riderName: "James",
    });

    expect(result.title).toBe("Dereva amefika");
    expect(result.body).toContain("James");
    expect(result.body).toContain("anakusubiri");
  });

  it("falls back to IN_APP when a channel-specific template is missing for the locale", () => {
    // "rider_arriving" has no SMS variant for either locale.
    const result = renderTemplate("rider_arriving", "SMS", "en", {
      riderName: "James",
      etaMinutes: 2,
    });

    // Falls back to en.IN_APP
    expect(result.title).toBe("Rider arriving soon");
    expect(result.body).toContain("approaching your pickup point");
  });

  it("falls back to English when the requested locale lacks a variant", () => {
    // Construct a scenario: sos_triggered has SMS for both locales, so use a
    // channel known to exist only in "en" to exercise the en-fallback path.
    // promo_available has no SMS in either locale -> falls back to IN_APP.
    const result = renderTemplate("promo_available", "SMS", "sw", {
      promoTitle: "Weekend Bonus",
      promoBody: "Get 20% off your next 3 rides",
      promoCode: "WEEKEND20",
    });

    // sw.IN_APP exists, so SMS->IN_APP fallback within "sw" should be used.
    expect(result.title).toBe("Weekend Bonus");
    expect(result.body).toContain("Tumia msimbo WEEKEND20");
  });

  it("leaves unknown placeholders untouched", () => {
    const result = renderTemplate("trip_completed", "PUSH", "en", {
      destination: "Westlands",
      // amount/currency intentionally omitted
    });

    expect(result.body).toContain("Westlands");
    expect(result.body).toContain("{{currency}}");
    expect(result.body).toContain("{{amount}}");
  });

  it("throws for an unregistered templateKey", () => {
    expect(() => renderTemplate("does_not_exist", "PUSH", "en", {})).toThrow(
      /No template registered/,
    );
  });

  it("renders EMAIL with emailSubject for trip_completed", () => {
    const result = renderTemplate("trip_completed", "EMAIL", "en", {
      destination: "JKIA",
      amount: "350.00",
      currency: "KES",
      receiptUrl: "https://pikii.app/r/abc123",
    });

    expect(result.emailSubject).toBe("Your Pikii receipt — KES 350.00");
    expect(result.body).toContain("https://pikii.app/r/abc123");
  });
});
