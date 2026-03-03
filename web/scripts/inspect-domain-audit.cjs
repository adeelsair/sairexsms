const fs = require("fs");
const path = require("path");
const { PrismaClient } = require("../lib/generated/prisma");

function ensureDbUrl() {
  if (process.env.DATABASE_URL) return;
  const envPath = path.join(__dirname, "..", ".env.local");
  if (!fs.existsSync(envPath)) return;
  const raw = fs.readFileSync(envPath, "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    if (!trimmed.startsWith("DATABASE_URL=")) continue;
    let value = trimmed.slice("DATABASE_URL=".length).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    process.env.DATABASE_URL = value;
    return;
  }
}

async function main() {
  ensureDbUrl();
  const prisma = new PrismaClient();
  const rows = await prisma.domainEventLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 30,
    select: {
      eventType: true,
      organizationId: true,
      createdAt: true,
      payload: true,
    },
  });

  for (const row of rows) {
    const audit = row.payload && typeof row.payload === "object" ? row.payload._audit ?? {} : {};
    console.log(
      JSON.stringify({
        eventType: row.eventType,
        organizationId: row.organizationId,
        actorUserId: audit.actorUserId ?? null,
        effectiveUserId: audit.effectiveUserId ?? null,
        tenantId: audit.tenantId ?? null,
        impersonation: audit.impersonation ?? null,
      }),
    );
  }

  await prisma.$disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
