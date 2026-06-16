import { PrismaClient } from "@prisma/client";

// -------------------------------------------------------------------------------------
// Prisma Client Singleton
// -------------------------------------------------------------------------------------
// Next.js dev mode hot-reloads modules, which can exhaust DB connections if a
// new PrismaClient is instantiated on every reload. We cache the instance on
// the global object in non-production environments.
// -------------------------------------------------------------------------------------

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
