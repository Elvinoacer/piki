import { describe, it, expect, vi, beforeEach } from "vitest";
import { resolveChannelsForUser, resolveChannelsForUsers } from "../preferences";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    notificationPreference: {
      findMany: vi.fn(),
    },
  },
}));

import { prisma } from "@/lib/prisma";

const findManyMock = prisma.notificationPreference.findMany as unknown as ReturnType<typeof vi.fn>;

beforeEach(() => {
  findManyMock.mockReset();
});

describe("resolveChannelsForUser", () => {
  it("returns event defaults when the user has no overrides", async () => {
    findManyMock.mockResolvedValue([]);

    const result = await resolveChannelsForUser("user_1", "RIDE_MATCHED");

    // RIDE_MATCHED defaults: PUSH, IN_APP, SMS
    expect(result.enabled.sort()).toEqual(["IN_APP", "PUSH", "SMS"]);
    expect(result.skipped).toEqual([]);
  });

  it("respects a user opting out of a non-locked default channel", async () => {
    findManyMock.mockResolvedValue([
      { channel: "SMS", enabled: false },
    ]);

    const result = await resolveChannelsForUser("user_1", "RIDE_MATCHED");

    expect(result.enabled.sort()).toEqual(["IN_APP", "PUSH"]);
    expect(result.skipped).toEqual(["SMS"]);
  });

  it("forces locked channels on even if the user opted out", async () => {
    // PAYMENT_RECEIVED locks SMS.
    findManyMock.mockResolvedValue([
      { channel: "SMS", enabled: false },
    ]);

    const result = await resolveChannelsForUser("user_1", "PAYMENT_RECEIVED");

    expect(result.enabled).toContain("SMS");
    // Locked channel being "on" despite the override should NOT appear in skipped.
    expect(result.skipped).not.toContain("SMS");
  });

  it("does not record a 'skipped' entry for a channel that wasn't a default anyway", async () => {
    // RIDER_ARRIVING defaults: PUSH, IN_APP (no SMS, no EMAIL).
    // User explicitly disables EMAIL (which was never going to be sent).
    findManyMock.mockResolvedValue([
      { channel: "EMAIL", enabled: false },
    ]);

    const result = await resolveChannelsForUser("user_1", "RIDER_ARRIVING");

    expect(result.enabled.sort()).toEqual(["IN_APP", "PUSH"]);
    expect(result.skipped).toEqual([]);
  });

  it("allows enabling a channel that is not a default", async () => {
    // TRIP_STARTED defaults: PUSH, IN_APP. User opts INTO SMS.
    findManyMock.mockResolvedValue([
      { channel: "SMS", enabled: true },
    ]);

    const result = await resolveChannelsForUser("user_1", "TRIP_STARTED");

    expect(result.enabled.sort()).toEqual(["IN_APP", "PUSH", "SMS"]);
  });

  it("always forces SOS channels regardless of any opt-out", async () => {
    findManyMock.mockResolvedValue([
      { channel: "PUSH", enabled: false },
      { channel: "SMS", enabled: false },
      { channel: "IN_APP", enabled: false },
    ]);

    const result = await resolveChannelsForUser("user_1", "SOS_TRIGGERED");

    // PUSH and SMS are locked for SOS_TRIGGERED.
    expect(result.enabled).toContain("PUSH");
    expect(result.enabled).toContain("SMS");
    // IN_APP is a default but not locked, so the opt-out is honored.
    expect(result.enabled).not.toContain("IN_APP");
    expect(result.skipped).toContain("IN_APP");
  });
});

describe("resolveChannelsForUsers (bulk)", () => {
  it("resolves per-user overrides correctly in a single batch", async () => {
    findManyMock.mockResolvedValue([
      { userId: "user_1", channel: "SMS", enabled: false },
      { userId: "user_2", channel: "PUSH", enabled: false },
    ]);

    const result = await resolveChannelsForUsers(["user_1", "user_2", "user_3"], "RIDE_MATCHED");

    expect(result.get("user_1")!.enabled.sort()).toEqual(["IN_APP", "PUSH"]);
    expect(result.get("user_1")!.skipped).toEqual(["SMS"]);

    expect(result.get("user_2")!.enabled.sort()).toEqual(["IN_APP", "SMS"]);
    expect(result.get("user_2")!.skipped).toEqual(["PUSH"]);

    // user_3 has no overrides -> pure defaults
    expect(result.get("user_3")!.enabled.sort()).toEqual(["IN_APP", "PUSH", "SMS"]);
    expect(result.get("user_3")!.skipped).toEqual([]);
  });

  it("returns a result entry for every requested userId, even with zero overrides", async () => {
    findManyMock.mockResolvedValue([]);

    const result = await resolveChannelsForUsers(["a", "b", "c"], "BROADCAST");

    expect([...result.keys()].sort()).toEqual(["a", "b", "c"]);
  });
});
