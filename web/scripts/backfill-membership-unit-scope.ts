/**
 * Backfill script: Populate unitId + unitPath on existing Membership rows
 * so the hierarchical RBAC (Phase 3) works immediately.
 *
 * Rules:
 *   - ORG_ADMIN      → skip (org-wide scope, unitPath stays NULL)
 *   - CAMPUS_ADMIN    → unitId = campus.id, unitPath = campus.fullUnitPath
 *   - TEACHER, etc.   → same as campus if campusId is set
 *   - Already filled  → skip (idempotent)
 *   - No campusId     → skip (cannot scope)
 *
 * Run: npx tsx scripts/backfill-membership-unit-scope.ts
 */

import { PrismaClient } from "../lib/generated/prisma";

const prisma = new PrismaClient();
const BATCH_SIZE = 500;

async function main() {
  console.log("Starting membership unitPath backfill...");

  let lastId = 0;
  let totalProcessed = 0;
  let totalUpdated = 0;

  while (true) {
    const memberships = await prisma.membership.findMany({
      take: BATCH_SIZE,
      where: { id: { gt: lastId } },
      orderBy: { id: "asc" },
      include: {
        campus: {
          select: {
            id: true,
            fullUnitPath: true,
          },
        },
      },
    });

    if (memberships.length === 0) break;

    const updates = [];

    for (const m of memberships) {
      if (m.role === "ORG_ADMIN") continue;

      if (m.unitPath) continue;

      if (!m.campusId || !m.campus) continue;

      updates.push(
        prisma.membership.update({
          where: { id: m.id },
          data: {
            unitId: String(m.campus.id),
            unitPath: m.campus.fullUnitPath,
          },
        }),
      );
    }

    if (updates.length > 0) {
      await prisma.$transaction(updates);
      totalUpdated += updates.length;
    }

    totalProcessed += memberships.length;
    lastId = memberships[memberships.length - 1].id;

    console.log(
      `  Processed batch: ${memberships.length} rows (${updates.length} updated) | Total: ${totalProcessed}`,
    );
  }

  console.log(`\nBackfill complete.`);
  console.log(`  Total processed: ${totalProcessed}`);
  console.log(`  Total updated:   ${totalUpdated}`);

  const verification = await prisma.membership.groupBy({
    by: ["role"],
    _count: true,
    where: { unitPath: { not: null } },
  });

  console.log(`\nVerification — memberships with unitPath:`);
  for (const row of verification) {
    console.log(`  ${row.role}: ${row._count}`);
  }

  const nullCount = await prisma.membership.count({
    where: { unitPath: null, role: { not: "ORG_ADMIN" }, campusId: { not: null } },
  });
  console.log(`\n  Remaining campus-linked without unitPath (should be 0): ${nullCount}`);
}

main()
  .catch((e) => {
    console.error("Backfill failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
