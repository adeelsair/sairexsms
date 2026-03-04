import type { UnitScopeType } from "@/lib/generated/prisma";

type TransactionClient = Parameters<Parameters<typeof import("@/lib/prisma").prisma.$transaction>[0]>[0];

interface CreateUnitProfileParams {
  tx: TransactionClient;
  organizationId: string;
  unitType: UnitScopeType;
  unitId: string;
  displayName?: string;
}

/**
 * Auto-create a UnitProfile inside the same transaction that creates the unit.
 * Guarantees every operational unit has an administrative identity from birth.
 */
export async function createUnitProfile({
  tx,
  organizationId,
  unitType,
  unitId,
  displayName,
}: CreateUnitProfileParams) {
  return tx.unitProfile.create({
    data: {
      organizationId,
      unitType,
      unitId,
      displayName,
    },
  });
}
