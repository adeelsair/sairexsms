import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const configDir = path.dirname(fileURLToPath(import.meta.url));

/** BullMQ imports `ioredis/built/utils`; when Next marks `ioredis` external, Node cannot resolve that subpath. */
const ioredisBuiltUtilsWebpack = path.join(configDir, "node_modules", "ioredis", "built", "utils", "index.js");
/**
 * Turbopack rejects Windows absolute paths in resolveAlias ("windows imports are not implemented yet").
 * Use a path relative to `turbopack.root` (`configDir` / the `web` folder).
 */
const ioredisBuiltUtilsTurbopack = "./node_modules/ioredis/built/utils/index.js";

const nextConfig: NextConfig = {
  output: "standalone",
  experimental: {
    serverActions: {
      bodySizeLimit: "4mb",
    },
  },
  turbopack: {
    root: configDir,
    resolveAlias: {
      "ioredis/built/utils": ioredisBuiltUtilsTurbopack,
    },
  },
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.resolve.alias = {
        ...config.resolve.alias,
        "ioredis/built/utils": ioredisBuiltUtilsWebpack,
      };
    }
    return config;
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
  // ioredis: keep default externalization; `ioredis/built/utils` is aliased above for bullmq subpath imports.
  serverExternalPackages: ["pdf-parse", "pdfjs-dist"],
};

export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  silent: !process.env.CI,
  widenClientFileUpload: true,
  tunnelRoute: "/monitoring",
});
