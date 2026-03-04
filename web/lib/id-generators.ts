import { prisma } from "./prisma";

/**
 * Generates the next Organization ID using a database sequence.
 *
 * Strategy (race-safe):
 *   1. Upsert the OrganizationSequence row (ensures it exists).
 *   2. Atomically increment lastValue using a raw SQL UPDATE ... RETURNING.
 *   3. Format as ORG-XXXXX.
 *
 * This avoids race conditions from counting rows.
 */
export async function generateOrganizationId(): Promise<string> {
  const PREFIX = "ORG";
  const PAD_LENGTH = 5;

  // Ensure the sequence row exists (idempotent)
  await prisma.organizationSequence.upsert({
    where: { id: 1 },
    update: {},
    create: { id: 1, lastValue: 0 },
  });

  // Atomic increment + return
  const result = await prisma.$queryRaw<{ lastValue: number }[]>`
    UPDATE "OrganizationSequence"
    SET "lastValue" = "lastValue" + 1
    WHERE id = 1
    RETURNING "lastValue"
  `;

  const nextNumber = result[0].lastValue;
  const paddedNumber = String(nextNumber).padStart(PAD_LENGTH, "0");
  return `${PREFIX}-${paddedNumber}`;
}
