import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mock all external dependencies before importing the module under test.
// ---------------------------------------------------------------------------
vi.mock("@/lib/prisma", () => ({
  prisma: {
    notification: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
    },
    notificationDelivery: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    notificationPreference: {
      findMany: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
    },
    pushToken: {
      findMany: vi.fn(),
    },
  },
}));

vi.mock("@/lib/queue/queues", () => ({
  notificationQueue: { add: vi.fn().mockResolvedValue(undefined) },
}));

vi.mock("@/lib/notifications/realtime", () => ({
  emitInAppNotification: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/notifications/providers/fcm", () => ({
  fcmPushProvider: { send: vi.fn() },
}));

vi.mock("@/lib/notifications/providers/africastalking", () => ({
  africasTalkingSmsProvider: { send: vi.fn() },
}));

vi.mock("@/lib/notifications/providers/email", () => ({
  resendEmailProvider: { send: vi.fn() },
}));

// ---------------------------------------------------------------------------
// Imports (after mocks are registered)
// ---------------------------------------------------------------------------
import { prisma } from "@/lib/prisma";
import { notificationQueue } from "@/lib/queue/queues";
import { emitInAppNotification } from "@/lib/notifications/realtime";
import { fcmPushProvider } from "@/lib/notifications/providers/fcm";
import { africasTalkingSmsProvider } from "@/lib/notifications/providers/africastalking";
import { resendEmailProvider } from "@/lib/notifications/providers/email";
import { triggerNotification, sendChannel } from "@/lib/notifications/dispatcher";

const createMock = prisma.notification.create as ReturnType<typeof vi.fn>;
const deliveryFindMock = prisma.notificationDelivery.findUnique as ReturnType<typeof vi.fn>;
const deliveryUpdateMock = prisma.notificationDelivery.update as ReturnType<typeof vi.fn>;
const prefFindMock = prisma.notificationPreference.findMany as ReturnType<typeof vi.fn>;
const userFindMock = prisma.user.findUnique as ReturnType<typeof vi.fn>;
const tokenFindMock = prisma.pushToken.findMany as ReturnType<typeof vi.fn>;
const queueAddMock = notificationQueue.add as ReturnType<typeof vi.fn>;
const emitMock = emitInAppNotification as ReturnType<typeof vi.fn>;
const fcmSendMock = fcmPushProvider.send as ReturnType<typeof vi.fn>;
const smsSendMock = africasTalkingSmsProvider.send as ReturnType<typeof vi.fn>;
const emailSendMock = resendEmailProvider.send as ReturnType<typeof vi.fn>;

// Helper: configure a standard happy-path set of mocks
function setupDefaultMocks(overrides: { prefs?: any[]; locale?: string } = {}) {
  prefFindMock.mockResolvedValue(overrides.prefs ?? []);
  userFindMock.mockResolvedValue({ preferredLocale: overrides.locale ?? "en", phone: "+254712345678", email: "rider@test.com" });
  createMock.mockResolvedValue({
    id: "notif_001",
    deliveries: [
      { id: "del_push", channel: "PUSH" },
      { id: "del_sms", channel: "SMS" },
      { id: "del_inapp", channel: "IN_APP" },
    ],
  });
  emitMock.mockResolvedValue(undefined);
  deliveryUpdateMock.mockResolvedValue(undefined);
  queueAddMock.mockResolvedValue(undefined);
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------

describe("triggerNotification", () => {
  it("creates a Notification row with deliveries for all enabled channels", async () => {
    setupDefaultMocks();

    await triggerNotification({
      userId: "user_1",
      event: "RIDE_MATCHED",
      vars: { riderName: "James", vehiclePlate: "KMEA 123B", etaMinutes: 4 },
    });

    expect(createMock).toHaveBeenCalledOnce();
    const createArg = createMock.mock.calls[0][0];

    // RIDE_MATCHED defaults: PUSH, SMS, IN_APP
    const channels = createArg.data.deliveries.create.map((d: any) => d.channel);
    expect(channels).toContain("PUSH");
    expect(channels).toContain("SMS");
    expect(channels).toContain("IN_APP");
  });

  it("emits in-app realtime immediately", async () => {
    setupDefaultMocks();

    await triggerNotification({
      userId: "user_1",
      event: "RIDE_MATCHED",
      vars: { riderName: "James", vehiclePlate: "KMEA 123B", etaMinutes: 4 },
    });

    expect(emitMock).toHaveBeenCalledOnce();
    const emitArg = emitMock.mock.calls[0];
    expect(emitArg[0]).toBe("user_1");
    expect(emitArg[1].title).toBe("Rider matched!");
  });

  it("enqueues PUSH and SMS for async delivery (not dispatched in-process)", async () => {
    setupDefaultMocks();

    await triggerNotification({
      userId: "user_1",
      event: "RIDE_MATCHED",
      vars: { riderName: "James", vehiclePlate: "KMEA 123B", etaMinutes: 4 },
    });

    // Queue add is called with the async channels
    expect(queueAddMock).toHaveBeenCalledOnce();
    const jobData = queueAddMock.mock.calls[0][1];
    expect(jobData.channels).toContain("PUSH");
    expect(jobData.channels).toContain("SMS");
    expect(jobData.channels).not.toContain("IN_APP"); // IN_APP is sync, not queued
  });

  it("records SKIPPED deliveries for opted-out channels", async () => {
    // User opted out of SMS for RIDE_MATCHED
    setupDefaultMocks({ prefs: [{ channel: "SMS", enabled: false }] });

    await triggerNotification({
      userId: "user_1",
      event: "RIDE_MATCHED",
      vars: { riderName: "James", vehiclePlate: "KMEA 123B", etaMinutes: 4 },
    });

    const deliveries = createMock.mock.calls[0][0].data.deliveries.create;
    const smsDel = deliveries.find((d: any) => d.channel === "SMS");
    expect(smsDel.status).toBe("SKIPPED");
  });

  it("returns the notificationId from the created row", async () => {
    setupDefaultMocks();

    const result = await triggerNotification({
      userId: "user_1",
      event: "RIDE_MATCHED",
      vars: { riderName: "James", vehiclePlate: "KMEA 123B", etaMinutes: 4 },
    });

    expect(result.notificationId).toBe("notif_001");
  });

  it("renders the notification body in Swahili when locale=sw is passed", async () => {
    setupDefaultMocks();

    await triggerNotification({
      userId: "user_1",
      event: "RIDE_MATCHED",
      vars: { riderName: "James", vehiclePlate: "KMEA 123B", etaMinutes: 4 },
      locale: "sw",
    });

    const emitArg = emitMock.mock.calls[0][1];
    expect(emitArg.title).toBe("Dereva amepatikana");
  });

  it("links the notification to a tripId when provided", async () => {
    setupDefaultMocks();

    await triggerNotification({
      userId: "user_1",
      event: "TRIP_COMPLETED",
      vars: { destination: "JKIA", amount: "350", currency: "KES", receiptUrl: "https://pikii.app/r/x" },
      tripId: "trip_abc",
    });

    const createArg = createMock.mock.calls[0][0];
    expect(createArg.data.tripId).toBe("trip_abc");
  });
});

// ---------------------------------------------------------------------------

describe("sendChannel", () => {
  function setupDelivery(channel: string, status = "PENDING") {
    deliveryFindMock.mockResolvedValue({ id: `del_${channel}`, channel, status });
    deliveryUpdateMock.mockResolvedValue(undefined);
  }

  it("sends PUSH via FCM and marks delivery SENT on success", async () => {
    setupDelivery("PUSH");
    tokenFindMock.mockResolvedValue([{ token: "fcm_token_abc" }]);
    fcmSendMock.mockResolvedValue({ success: true, providerRef: "projects/x/messages/123" });

    await sendChannel("notif_001", "user_1", "RIDE_MATCHED", "PUSH", {
      riderName: "James", vehiclePlate: "KMEA 123B", etaMinutes: 4,
    }, "en");

    expect(fcmSendMock).toHaveBeenCalledOnce();
    expect(fcmSendMock.mock.calls[0][0].tokens).toEqual(["fcm_token_abc"]);
    expect(fcmSendMock.mock.calls[0][0].title).toBe("Rider matched!");

    const updateCalls = deliveryUpdateMock.mock.calls;
    const finalUpdate = updateCalls[updateCalls.length - 1][0];
    expect(finalUpdate.data.status).toBe("SENT");
    expect(finalUpdate.data.providerRef).toBe("projects/x/messages/123");
  });

  it("sends SMS via Africa's Talking with the user's phone number", async () => {
    setupDelivery("SMS");
    userFindMock.mockResolvedValue({ phone: "+254712345678" });
    smsSendMock.mockResolvedValue({ success: true, providerRef: "ATXid123" });

    await sendChannel("notif_001", "user_1", "RIDE_MATCHED", "SMS", {
      riderName: "James", vehiclePlate: "KMEA 123B", etaMinutes: 4,
    }, "en");

    expect(smsSendMock).toHaveBeenCalledOnce();
    expect(smsSendMock.mock.calls[0][0].to).toBe("+254712345678");
    expect(smsSendMock.mock.calls[0][0].message).toContain("James");
  });

  it("sends EMAIL via Resend with the user's email and rendered subject", async () => {
    setupDelivery("EMAIL");
    userFindMock.mockResolvedValue({ email: "client@test.com" });
    emailSendMock.mockResolvedValue({ success: true, providerRef: "resend_id_abc" });

    await sendChannel("notif_001", "user_1", "TRIP_COMPLETED", "EMAIL", {
      destination: "Westlands", amount: "200", currency: "KES", receiptUrl: "https://pikii.app/r/y",
    }, "en");

    expect(emailSendMock).toHaveBeenCalledOnce();
    expect(emailSendMock.mock.calls[0][0].subject).toBe("Your Pikii receipt — KES 200");
    expect(emailSendMock.mock.calls[0][0].to).toBe("client@test.com");
  });

  it("marks delivery FAILED and does NOT throw for permanent provider failures", async () => {
    setupDelivery("PUSH");
    tokenFindMock.mockResolvedValue([{ token: "dead_token" }]);
    fcmSendMock.mockResolvedValue({
      success: false,
      error: "messaging/registration-token-not-registered",
      permanent: true,
    });

    // Should NOT throw (permanent=true means do not retry)
    await expect(
      sendChannel("notif_001", "user_1", "RIDE_MATCHED", "PUSH", {
        riderName: "James", vehiclePlate: "KMEA 123B", etaMinutes: 4,
      }, "en"),
    ).resolves.not.toThrow();

    const updateCalls = deliveryUpdateMock.mock.calls;
    const finalUpdate = updateCalls[updateCalls.length - 1][0];
    expect(finalUpdate.data.status).toBe("FAILED");
  });

  it("throws for transient failures so BullMQ retries the job", async () => {
    setupDelivery("SMS");
    userFindMock.mockResolvedValue({ phone: "+254712345678" });
    smsSendMock.mockResolvedValue({
      success: false,
      error: "Service temporarily unavailable",
      permanent: false,
    });

    await expect(
      sendChannel("notif_001", "user_1", "RIDE_MATCHED", "SMS", {
        riderName: "James", vehiclePlate: "KMEA 123B", etaMinutes: 4,
      }, "en"),
    ).rejects.toThrow("SMS delivery failed");
  });

  it("is idempotent — skips channels already in SENT status", async () => {
    setupDelivery("PUSH", "SENT");

    await sendChannel("notif_001", "user_1", "RIDE_MATCHED", "PUSH", {
      riderName: "James", vehiclePlate: "KMEA 123B", etaMinutes: 4,
    }, "en");

    // FCM should never have been called
    expect(fcmSendMock).not.toHaveBeenCalled();
  });

  it("skips push with permanent failure when user has no push tokens", async () => {
    setupDelivery("PUSH");
    tokenFindMock.mockResolvedValue([]); // empty — no tokens registered

    // Should not throw, marks FAILED with permanent=true
    await expect(
      sendChannel("notif_001", "user_1", "RIDE_MATCHED", "PUSH", {
        riderName: "James", vehiclePlate: "KMEA 123B", etaMinutes: 4,
      }, "en"),
    ).resolves.not.toThrow();

    expect(fcmSendMock).not.toHaveBeenCalled();
    const finalUpdate = deliveryUpdateMock.mock.calls[deliveryUpdateMock.mock.calls.length - 1][0];
    expect(finalUpdate.data.status).toBe("FAILED");
  });
});
