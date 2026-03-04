/**
 * Backfill script: Assign organizationId to all geo entities (Region, SubRegion, City, Zone)
 * and UnitCodeSequence rows based on Campus → City → Region/SubRegion hierarchy.
 *
 * Strategy:
 *   1. For each campus (which already has organizationId), walk up its hierarchy
 *   2. Assign the campus's organizationId to its city, zone, subRegion, region
 *   3. For geo rows not reachable from any campus, mark as ARCHIVED
 *   4. For UnitCodeSequence rows without orgId, assign from the first org found
 *
 * Run: npx tsx web/scripts/backfill-geo-org.ts
 */

import { PrismaClient } from "../lib/generated/prisma";

const prisma = new PrismaClient();

async function main() {
  console.log("=== GEO BACKFILL: Assigning organizationId from campuses ===\n");

  const campuses = await prisma.campus.findMany({
    select: {
      id: true,
      organizationId: true,
      cityId: true,
      zoneId: true,
    },
  });

  console.log(`Found ${campuses.length} campuses to process.`);

  let citiesUpdated = 0;
  let zonesUpdated = 0;
  let subRegionsUpdated = 0;
  let regionsUpdated = 0;

  for (const campus of campuses) {
    const orgId = campus.organizationId;

    // Update zone
    if (campus.zoneId) {
      const zone = await prisma.zone.findUnique({ where: { id: campus.zoneId } });
      if (zone && !zone.organizationId) {
        await prisma.zone.update({ where: { id: zone.id }, data: { organizationId: orgId } });
        zonesUpdated++;
        console.log(`  Zone "${zone.name}" → ${orgId}`);
      }
    }

    // Update city
    const city = await prisma.city.findUnique({ where: { id: campus.cityId } });
    if (city && !city.organizationId) {
      await prisma.city.update({ where: { id: city.id }, data: { organizationId: orgId } });
      citiesUpdated++;
      console.log(`  City "${city.name}" → ${orgId}`);

      // Update subRegion via city
      if (city.subRegionId) {
        const sr = await prisma.subRegion.findUnique({ where: { id: city.subRegionId } });
        if (sr && !sr.organizationId) {
          await prisma.subRegion.update({ where: { id: sr.id }, data: { organizationId: orgId } });
          subRegionsUpdated++;
          console.log(`  SubRegion "${sr.name}" → ${orgId}`);
        }
      }

      // Update region via city
      if (city.regionId) {
        const reg = await prisma.region.findUnique({ where: { id: city.regionId } });
        if (reg && !reg.organizationId) {
          await prisma.region.update({ where: { id: reg.id }, data: { organizationId: orgId } });
          regionsUpdated++;
          console.log(`  Region "${reg.name}" → ${orgId}`);
        }
      }
    }
  }

  console.log(`\nBackfill summary:`);
  console.log(`  Regions:    ${regionsUpdated}`);
  console.log(`  SubRegions: ${subRegionsUpdated}`);
  console.log(`  Cities:     ${citiesUpdated}`);
  console.log(`  Zones:      ${zonesUpdated}`);

  // Archive orphan geo entities (no campus → no orgId)
  const firstOrg = await prisma.organization.findFirst({ orderBy: { createdAt: "asc" } });

  if (firstOrg) {
    const fallbackOrgId = firstOrg.id;
    console.log(`\nFallback org for orphans: ${fallbackOrgId} (${firstOrg.organizationName})`);

    const orphanRegions = await prisma.region.findMany({ where: { organizationId: null } });
    for (const r of orphanRegions) {
      await prisma.region.update({ where: { id: r.id }, data: { organizationId: fallbackOrgId, status: "ARCHIVED" } });
      console.log(`  Archived orphan Region "${r.name}" → ${fallbackOrgId}`);
    }

    const orphanSubRegions = await prisma.subRegion.findMany({ where: { organizationId: null } });
    for (const sr of orphanSubRegions) {
      await prisma.subRegion.update({ where: { id: sr.id }, data: { organizationId: fallbackOrgId, status: "ARCHIVED" } });
      console.log(`  Archived orphan SubRegion "${sr.name}" → ${fallbackOrgId}`);
    }

    const orphanCities = await prisma.city.findMany({ where: { organizationId: null } });
    for (const c of orphanCities) {
      await prisma.city.update({ where: { id: c.id }, data: { organizationId: fallbackOrgId, status: "ARCHIVED" } });
      console.log(`  Archived orphan City "${c.name}" → ${fallbackOrgId}`);
    }

    const orphanZones = await prisma.zone.findMany({ where: { organizationId: null } });
    for (const z of orphanZones) {
      await prisma.zone.update({ where: { id: z.id }, data: { organizationId: fallbackOrgId, status: "ARCHIVED" } });
      console.log(`  Archived orphan Zone "${z.name}" → ${fallbackOrgId}`);
    }

    // Backfill UnitCodeSequence
    const orphanSeqs = await prisma.unitCodeSequence.findMany({ where: { organizationId: null } });
    for (const seq of orphanSeqs) {
      await prisma.unitCodeSequence.update({ where: { id: seq.id }, data: { organizationId: fallbackOrgId } });
    }
    if (orphanSeqs.length > 0) {
      console.log(`  Assigned ${orphanSeqs.length} UnitCodeSequence rows → ${fallbackOrgId}`);
    }
  } else {
    console.log("\nNo organizations found — skipping orphan handling.");
  }

  // Verify no nulls remain
  const nullCounts = {
    regions: await prisma.region.count({ where: { organizationId: null } }),
    subRegions: await prisma.subRegion.count({ where: { organizationId: null } }),
    cities: await prisma.city.count({ where: { organizationId: null } }),
    zones: await prisma.zone.count({ where: { organizationId: null } }),
    sequences: await prisma.unitCodeSequence.count({ where: { organizationId: null } }),
  };

  console.log(`\nVerification (should all be 0):`);
  console.log(`  Regions null orgId:    ${nullCounts.regions}`);
  console.log(`  SubRegions null orgId: ${nullCounts.subRegions}`);
  console.log(`  Cities null orgId:     ${nullCounts.cities}`);
  console.log(`  Zones null orgId:      ${nullCounts.zones}`);
  console.log(`  Sequences null orgId:  ${nullCounts.sequences}`);

  const allClear = Object.values(nullCounts).every((c) => c === 0);
  if (allClear) {
    console.log("\n✅ All rows backfilled. Safe to make organizationId required.");
  } else {
    console.log("\n⚠️  Some rows still have null organizationId. Investigate before making column required.");
  }
}

main()
  .catch((e) => {
    console.error("Backfill failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
