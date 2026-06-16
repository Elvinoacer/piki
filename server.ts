/**
 * server.ts
 *
 * Custom Next.js server that attaches Socket.IO to the same HTTP server.
 *
 * Run: npx ts-node --project tsconfig.server.json server.ts
 * Or:  node --require ts-node/register server.ts
 *
 * Add to package.json:
 *   "dev":   "ts-node server.ts",
 *   "start": "NODE_ENV=production ts-node server.ts"
 *
 * Note: This disables Vercel's edge/serverless deployment for API routes.
 * For Vercel, use Pusher/Ably instead and remove this file.
 */

import { createServer } from "http";
import { parse } from "url";
import next from "next";
import { initSocketServer } from "@/lib/websocket/server";

const dev  = process.env.NODE_ENV !== "production";
const port = parseInt(process.env.PORT ?? "3000", 10);

async function main() {
  const app    = next({ dev });
  const handle = app.getRequestHandler();

  await app.prepare();

  const httpServer = createServer((req, res) => {
    const parsedUrl = parse(req.url!, true);
    handle(req, res, parsedUrl);
  });

  // Attach Socket.IO to the HTTP server
  initSocketServer(httpServer);

  httpServer.listen(port, () => {
    console.log(`[Pikii] Server running on http://localhost:${port}`);
    console.log(`[Pikii] Socket.IO attached`);
  });
}

main().catch((err) => {
  console.error("[Pikii] Server failed to start:", err);
  process.exit(1);
});
