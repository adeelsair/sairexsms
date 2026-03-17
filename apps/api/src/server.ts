/**
 * Standalone HTTP server for the payment API (dev / local).
 * Usage: from repo root, REDIS_URL=redis://127.0.0.1:6379 npx tsx apps/api/src/server.ts
 */
import { app } from "./app";

const port = Number(process.env.PAYMENT_API_PORT ?? "4010");
const server = app.listen(port, () => {
  console.log(`Payment API listening on http://localhost:${port}`);
});

server.on("error", (err) => {
  console.error("Payment API server error:", err);
  process.exitCode = 1;
});
