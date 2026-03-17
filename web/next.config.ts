import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const configDir = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  output: "standalone",
  experimental: {
    serverActions: {
      bodySizeLimit: "4mb",
    },
  },
  turbopack: {
    root: configDir,
  },
  typescript: {
    // Docker build currently focuses on producing runnable images; type checks run separately in CI.
    ignoreBuildErrors: process.env.DOCKER_BUILD === "1",
  },
  // Proxy /payments/* to Express payment API only when PAYMENTS_API_URL is set (e.g. http://localhost:4010).
  // When unset, /payments/* requests hit Next.js and return 404 — Payment Gateway page shows "API not running" and no proxy errors in terminal.
  async rewrites() {
    const base = process.env.PAYMENTS_API_URL ?? "";
    if (!base) return [];
    return [{ source: "/payments/:path*", destination: `${base}/payments/:path*` }];
  },
  // pdf-parse and pdfjs-dist: run from node_modules so pdf.worker.mjs resolves (fixes NTN certificate verification in API routes)
  // Note: ioredis is auto-externalized by Next/Turbopack; adding it to transpilePackages conflicts and causes a fatal error.
  serverExternalPackages: ["pdf-parse", "pdfjs-dist"],
};

export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  silent: !process.env.CI,
  widenClientFileUpload: true,
  tunnelRoute: "/monitoring",
});
