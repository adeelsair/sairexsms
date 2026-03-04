/**
 * Seed script for Plan Features
 *
 * Populates the PlanFeature table with the default feature matrix
 * for all plan types (FREE, BASIC, PRO, ENTERPRISE).
 *
 * Run with: npx tsx web/scripts/seed-plan-features.ts
 */
import { seedPlanFeatures } from "../lib/feature-gate";

async function main() {
  console.log("Seeding plan features...");
  const count = await seedPlanFeatures();
  console.log(`Seeded ${count} plan feature entries.`);
  process.exit(0);
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
