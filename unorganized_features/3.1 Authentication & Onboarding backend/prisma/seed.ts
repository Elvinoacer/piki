import { PrismaClient } from "@prisma/client";

// =====================================================================================
// Prisma Seed Script
// -------------------------------------------------------------------------------------
// Run via: npm run prisma:seed
// Seeds a minimal dataset for local development/testing of the 3.1
// Authentication & Onboarding feature: one platform admin, one approved
// rider, one rider mid-onboarding, and one client.
//
// NOTE: Passwords/OTPs are NOT seeded here — phone-OTP is the primary login
// method and OTPs are time-bound/single-use by design, so seeding a fixed
// code would be misleading. For local dev, set AFRICASTALKING_API_KEY="" in
// .env to use the console-log fallback in sms-provider.ts, which prints the
// generated OTP to the server console on every /api/auth/otp/request call.
// =====================================================================================

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding Pikii database...");

  const admin = await prisma.user.upsert({
    where: { phone: "+254700000001" },
    update: {},
    create: {
      phone: "+254700000001",
      phoneVerifiedAt: new Date(),
      email: "admin@pikii.dev",
      firstName: "Asha",
      lastName: "Admin",
      role: "PLATFORM_ADMIN",
      status: "ACTIVE",
      locale: "EN",
      referralCode: "ADMIN01",
      termsAcceptedAt: new Date(),
      privacyAcceptedAt: new Date(),
    },
  });

  const client = await prisma.user.upsert({
    where: { phone: "+254700000002" },
    update: {},
    create: {
      phone: "+254700000002",
      phoneVerifiedAt: new Date(),
      firstName: "Wanjiru",
      lastName: "Client",
      role: "CLIENT",
      status: "ACTIVE",
      locale: "SW",
      referralCode: "CLIENT01",
      termsAcceptedAt: new Date(),
      privacyAcceptedAt: new Date(),
      clientProfile: { create: {} },
    },
  });

  const approvedRiderUser = await prisma.user.upsert({
    where: { phone: "+254700000003" },
    update: {},
    create: {
      phone: "+254700000003",
      phoneVerifiedAt: new Date(),
      firstName: "Otieno",
      lastName: "Rider",
      role: "RIDER",
      status: "ACTIVE",
      locale: "EN",
      referralCode: "RIDER01",
      termsAcceptedAt: new Date(),
      privacyAcceptedAt: new Date(),
      riderProfile: {
        create: {
          vehicleType: "MOTORCYCLE",
          numberPlate: "KMEA123B",
          vehicleMake: "Honda",
          vehicleModel: "CB125",
          licenseNumber: "DL-998877",
          licenseClass: "CLASS_A",
          licenseExpiresAt: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000),
          insurancePolicyNumber: "INS-554433",
          insuranceExpiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
          verificationStatus: "APPROVED",
          onboardingCompletedAt: new Date(),
          verifiedAt: new Date(),
          availability: "OFFLINE",
        },
      },
    },
    include: { riderProfile: true },
  });

  await prisma.riderProfile.update({
    where: { userId: approvedRiderUser.id },
    data: {
      payoutMethods: {
        create: [{ method: "MPESA", mpesaPhoneEnc: "seed-placeholder-not-real-ciphertext", isDefault: true }],
      },
    },
  });

  const onboardingRiderUser = await prisma.user.upsert({
    where: { phone: "+254700000004" },
    update: {},
    create: {
      phone: "+254700000004",
      phoneVerifiedAt: new Date(),
      firstName: "Kiptoo",
      lastName: "NewRider",
      role: "RIDER",
      status: "ACTIVE",
      locale: "EN",
      referralCode: "RIDER02",
      termsAcceptedAt: new Date(),
      privacyAcceptedAt: new Date(),
      riderProfile: {
        create: {
          vehicleType: "MOTORCYCLE",
          verificationStatus: "INCOMPLETE",
        },
      },
    },
  });

  console.log("Seed complete:", {
    admin: admin.phone,
    client: client.phone,
    approvedRider: approvedRiderUser.phone,
    onboardingRider: onboardingRiderUser.phone,
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
