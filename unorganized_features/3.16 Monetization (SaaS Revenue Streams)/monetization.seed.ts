// prisma/seeds/monetization.seed.ts
// Run via: npx ts-node prisma/seeds/monetization.seed.ts
// Or integrate into your main seed.ts with `seedMonetization()`

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function seedMonetization() {
  console.log("🌱  Seeding monetization data...");

  // ── Subscription Plans ─────────────────────────────────────────
  const plans = [
    // Rider plans
    {
      name: "Pikii Pro (Monthly)",
      slug: "pikii-pro-monthly",
      targetRole: "RIDER" as const,
      billingCycle: "MONTHLY" as const,
      priceKes: 500,
      commissionRate: 0.08,  // 8% vs 12% default
      features: [
        "Reduced commission: 8% (vs 12% standard)",
        "Priority in matching queue",
        "Earnings analytics dashboard",
        "Pro rider badge",
      ],
    },
    {
      name: "Pikii Pro (Annual)",
      slug: "pikii-pro-annual",
      targetRole: "RIDER" as const,
      billingCycle: "ANNUAL" as const,
      priceKes: 4_800,       // 2 months free vs monthly
      commissionRate: 0.08,
      features: [
        "Reduced commission: 8% (vs 12% standard)",
        "Priority in matching queue",
        "Earnings analytics dashboard",
        "Pro rider badge",
        "2 months free vs monthly billing",
      ],
    },

    // SACCO plans
    {
      name: "SACCO Starter",
      slug: "sacco-starter",
      targetRole: "SACCO" as const,
      billingCycle: "MONTHLY" as const,
      priceKes: 2_000,
      seatLimit: 25,
      features: [
        "Up to 25 riders",
        "Fleet analytics dashboard",
        "Custom commission splits",
        "Bulk document verification queue",
        "Zone/stage assignment",
      ],
    },
    {
      name: "SACCO Growth",
      slug: "sacco-growth",
      targetRole: "SACCO" as const,
      billingCycle: "MONTHLY" as const,
      priceKes: 5_000,
      seatLimit: 100,
      features: [
        "Up to 100 riders",
        "All Starter features",
        "Priority support",
        "Payout management tools",
        "Compliance reporting exports",
        "API access (webhooks)",
      ],
    },
    {
      name: "SACCO Enterprise",
      slug: "sacco-enterprise",
      targetRole: "SACCO" as const,
      billingCycle: "MONTHLY" as const,
      priceKes: 12_000,
      seatLimit: null, // unlimited
      features: [
        "Unlimited riders",
        "All Growth features",
        "White-label option",
        "Dedicated account manager",
        "Custom commission structures",
        "SLA guarantee",
      ],
    },

    // Client plans
    {
      name: "Client Plus",
      slug: "client-plus",
      targetRole: "CLIENT" as const,
      billingCycle: "MONTHLY" as const,
      priceKes: 299,
      features: [
        "Priority matching (skip queue)",
        "Scheduled rides (up to 10/month)",
        "Up to 10 saved favourite riders",
        "Client Plus badge shown to riders",
        "Dedicated support channel",
      ],
    },
  ];

  for (const plan of plans) {
    await prisma.subscriptionPlan.upsert({
      where: { slug: plan.slug },
      update: plan,
      create: plan,
    });
    console.log(`  ✔ Plan: ${plan.name}`);
  }

  // ── Platform Commission Default ────────────────────────────────
  const existingDefault = await prisma.commissionRule.findFirst({
    where: { scope: "PLATFORM", isActive: true },
  });

  if (!existingDefault) {
    await prisma.commissionRule.create({
      data: {
        name: "Platform Default",
        scope: "PLATFORM",
        ratePercent: 12.0,     // 12%
        floorKes: 5.0,         // minimum KES 5 per trip
        capKes: 500.0,         // maximum KES 500 per trip
        validFrom: new Date("2024-01-01"),
        isActive: true,
      },
    });
    console.log("  ✔ Commission rule: Platform Default (12%)");
  } else {
    console.log("  — Platform commission rule already exists, skipping.");
  }

  console.log("✅  Monetization seed complete.");
}

// Allow running directly
if (require.main === module) {
  seedMonetization()
    .catch((e) => {
      console.error(e);
      process.exit(1);
    })
    .finally(() => prisma.$disconnect());
}
