import { prisma } from "@/lib/prisma";
import type { UnitScopeType } from "@/lib/generated/prisma";

/* ── Types ──────────────────────────────────────────────── */

export type RoutingSource =
  | "CAMPUS_PRIMARY"
  | "ZONE_PRIMARY"
  | "CITY_PRIMARY"
  | "SUBREGION_PRIMARY"
  | "REGION_PRIMARY"
  | "MANUAL_OVERRIDE";

export interface RoutingResult {
  bankAccountId: string;
  bankName: string;
  accountTitle: string;
  accountNumber: string;
  iban: string | null;
  source: RoutingSource;
}

export interface RoutingParams {
  organizationId: string;
  campusId: number;
  overrideBankAccountId?: string;
}

/* ── Helpers ────────────────────────────────────────────── */

interface BankRow {
  id: string;
  bankName: string;
  accountTitle: string;
  accountNumber: string;
  iban: string | null;
}

function toResult(bank: BankRow, source: RoutingSource): RoutingResult {
  return {
    bankAccountId: bank.id,
    bankName: bank.bankName,
    accountTitle: bank.accountTitle,
    accountNumber: bank.accountNumber,
    iban: bank.iban,
    source,
  };
}

async function findPrimaryForUnit(unitType: UnitScopeType, unitId: string): Promise<BankRow | null> {
  const profile = await prisma.unitProfile.findUnique({
    where: { unitType_unitId: { unitType, unitId } },
    select: { id: true },
  });
  if (!profile) return null;

  return prisma.unitBankAccount.findFirst({
    where: { unitProfileId: profile.id, isPrimary: true, status: "ACTIVE" },
    select: { id: true, bankName: true, accountTitle: true, accountNumber: true, iban: true },
  });
}

/* ── Single Campus Resolver ─────────────────────────────── */

export async function resolveChallanBankAccount(
  params: RoutingParams,
): Promise<RoutingResult> {
  const { organizationId, campusId, overrideBankAccountId } = params;

  if (overrideBankAccountId) {
    const override = await prisma.unitBankAccount.findFirst({
      where: { id: overrideBankAccountId, organizationId, status: "ACTIVE" },
      select: { id: true, bankName: true, accountTitle: true, accountNumber: true, iban: true },
    });
    if (!override) {
      throw new RoutingError("Override bank account not found or inactive");
    }
    return toResult(override, "MANUAL_OVERRIDE");
  }

  const org = await prisma.organization.findUniqueOrThrow({
    where: { id: organizationId },
    select: { financeRoutingMode: true },
  });

  const campusPrimary = await findPrimaryForUnit("CAMPUS", String(campusId));
  if (campusPrimary) return toResult(campusPrimary, "CAMPUS_PRIMARY");

  if (org.financeRoutingMode === "CAMPUS_PRIMARY") {
    throw new RoutingError("No primary bank account configured for this campus");
  }

  const campus = await prisma.campus.findUniqueOrThrow({
    where: { id: campusId },
    select: { zoneId: true, cityId: true },
  });

  if (campus.zoneId) {
    const bank = await findPrimaryForUnit("ZONE", campus.zoneId);
    if (bank) return toResult(bank, "ZONE_PRIMARY");
  }

  const cityBank = await findPrimaryForUnit("CITY", campus.cityId);
  if (cityBank) return toResult(cityBank, "CITY_PRIMARY");

  const city = await prisma.city.findUniqueOrThrow({
    where: { id: campus.cityId },
    select: { subRegionId: true, regionId: true },
  });

  if (city.subRegionId) {
    const bank = await findPrimaryForUnit("SUBREGION", city.subRegionId);
    if (bank) return toResult(bank, "SUBREGION_PRIMARY");
  }

  if (city.regionId) {
    const bank = await findPrimaryForUnit("REGION", city.regionId);
    if (bank) return toResult(bank, "REGION_PRIMARY");
  }

  throw new RoutingError("No eligible bank account found in hierarchy");
}

/* ── Batch Resolver (O(1) query set) ────────────────────── */

export async function resolveBankAccountsBatch(params: {
  organizationId: string;
  campusIds: number[];
}): Promise<Map<number, RoutingResult>> {
  const { organizationId, campusIds } = params;
  if (campusIds.length === 0) return new Map();

  const [org, primaryBanks, campuses] = await prisma.$transaction([
    prisma.organization.findUniqueOrThrow({
      where: { id: organizationId },
      select: { financeRoutingMode: true },
    }),

    prisma.unitBankAccount.findMany({
      where: { organizationId, isPrimary: true, status: "ACTIVE" },
      select: {
        id: true,
        bankName: true,
        accountTitle: true,
        accountNumber: true,
        iban: true,
        unitProfile: { select: { unitType: true, unitId: true } },
      },
    }),

    prisma.campus.findMany({
      where: { id: { in: campusIds }, organizationId },
      select: {
        id: true,
        zoneId: true,
        cityId: true,
        city: { select: { id: true, subRegionId: true, regionId: true } },
      },
    }),
  ]);

  const bankByKey = new Map<string, BankRow>();
  for (const b of primaryBanks) {
    bankByKey.set(`${b.unitProfile.unitType}:${b.unitProfile.unitId}`, b);
  }

  const results = new Map<number, RoutingResult>();
  const isParentMode = org.financeRoutingMode === "NEAREST_PARENT_PRIMARY";

  for (const campus of campuses) {
    const campusKey = `CAMPUS:${campus.id}`;
    const campusBank = bankByKey.get(campusKey);
    if (campusBank) {
      results.set(campus.id, toResult(campusBank, "CAMPUS_PRIMARY"));
      continue;
    }

    if (!isParentMode) continue;

    const parentIds: { type: UnitScopeType; id: string | null; source: RoutingSource }[] = [
      { type: "ZONE", id: campus.zoneId, source: "ZONE_PRIMARY" },
      { type: "CITY", id: campus.cityId, source: "CITY_PRIMARY" },
      { type: "SUBREGION", id: campus.city?.subRegionId ?? null, source: "SUBREGION_PRIMARY" },
      { type: "REGION", id: campus.city?.regionId ?? null, source: "REGION_PRIMARY" },
    ];

    for (const parent of parentIds) {
      if (!parent.id) continue;
      const key = `${parent.type}:${parent.id}`;
      const bank = bankByKey.get(key);
      if (bank) {
        results.set(campus.id, toResult(bank, parent.source));
        break;
      }
    }
  }

  return results;
}

/* ── Custom Error ───────────────────────────────────────── */

export class RoutingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RoutingError";
  }
}
