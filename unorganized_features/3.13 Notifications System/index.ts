/**
 * workers/index.ts — Standalone worker process
 *
 * Run this as a separate process from the Next.js server, e.g.:
 *
 *   # Development (with ts-node or tsx):
 *   npx tsx workers/index.ts
 *
 *   # Production (compile first):
 *   npx tsc --project tsconfig.workers.json
 *   node dist/workers/index.js
 *
 * On Vercel: deploy as a separate service / cron consumer pointing at this
 * entrypoint. On Railway/Render/EC2: run as a parallel dyno/process alongside
 * the web process.
 *
 * IMPORTANT: this process imports server-only modules (Prisma, firebase-admin,
 * Africa's Talking, BullMQ). Do NOT bundle it into the Next.js client build.
 * The `server-only` imports in each lib file enforce this at build time.
 */

import { notificationWorker } from "@/lib/queue/workers/notifications";
import { documentExpiryWorker } from "@/lib/queue/workers/document-expiry";
import { scheduleDocumentExpiryChecks } from "@/lib/queue/queues";

async function main() {
  console.log("🚀 Pikii notification workers starting…");

  // Register the daily document-expiry repeatable job. This is idempotent
  // (the fixed jobId prevents duplicate schedules on restart).
  await scheduleDocumentExpiryChecks();
  console.log("📅 Document expiry check scheduled (daily 06:00)");

  console.log(`✅ Notification worker ready (concurrency: 10)`);
  console.log(`✅ Document expiry worker ready`);

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    console.log(`\n${signal} received — closing workers…`);
    await Promise.all([notificationWorker.close(), documentExpiryWorker.close()]);
    console.log("Workers closed. Exiting.");
    process.exit(0);
  };

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
}

main().catch((err) => {
  console.error("Worker startup failed:", err);
  process.exit(1);
});
