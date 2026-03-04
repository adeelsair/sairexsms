import type { AuthUser } from "@/lib/auth-guard";
import { isSuperAdmin } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";

/**
 * Assignable scope helpers for invite dropdowns.
 *
 * Each function returns a Prisma `where` clause that restricts
 * the entity list to only those the current user is allowed to assign.
 *
 * - Campuses use `fullUnitPath` prefix matching (indexed, fast).
 * - Geo entities (Region, SubRegion, Zone) use relational filtering
 *   since they don't carry `fullUnitPath`.
 */

/* ── Campuses ─────────────────────────────────────────────── */

export function assignableCampusesWhere(
  guard: AuthUser,
): Record<string, unknown> {
  if (isSuperAdmin(guard)) return {};

  const base: Record<string, unknown> = {
    organizationId: guard.organizationId,
    status: "ACTIVE",
  };

  if (guard.organizationStructure === "SINGLE") {
    return { ...base, isMainCampus: true };
  }

  if (guard.role === "ORG_ADMIN" || !guard.unitPath) {
    return base;
  }

  return {
    ...base,
    fullUnitPath: { startsWith: guard.unitPath },
  };
}

/* ── Regions ──────────────────────────────────────────────── */

export function assignableRegionsWhere(
  guard: AuthUser,
): Record<string, unknown> {
  if (isSuperAdmin(guard)) return {};

  return {
    organizationId: guard.organizationId,
    status: "ACTIVE",
  };
}

/* ── SubRegions ───────────────────────────────────────────── */

export async function assignableSubRegionsWhere(
  guard: AuthUser,
): Promise<Record<string, unknown>> {
  if (isSuperAdmin(guard)) return {};

  const base: Record<string, unknown> = {
    organizationId: guard.organizationId,
    status: "ACTIVE",
  };

  if (guard.role === "ORG_ADMIN" || !guard.unitPath) {
    return base;
  }

  const regionCode = guard.unitPath.split("-")[0];
  const region = await prisma.region.findFirst({
    where: {
      organizationId: guard.organizationId!,
      unitCode: regionCode,
    },
    select: { id: true },
  });

  if (!region) return { id: "__NONE__" };

  return { ...base, regionId: region.id };
}

/* ── Zones ────────────────────────────────────────────────── */

export async function assignableZonesWhere(
  guard: AuthUser,
): Promise<Record<string, unknown>> {
  if (isSuperAdmin(guard)) return {};

  const base: Record<string, unknown> = {
    organizationId: guard.organizationId,
    status: "ACTIVE",
  };

  if (guard.role === "ORG_ADMIN" || !guard.unitPath) {
    return base;
  }

  const campusesInScope = await prisma.campus.findMany({
    where: {
      organizationId: guard.organizationId!,
      fullUnitPath: { startsWith: guard.unitPath },
    },
    select: { cityId: true },
    distinct: ["cityId"],
  });

  const cityIds = campusesInScope.map((c) => c.cityId);
  if (cityIds.length === 0) return { id: "__NONE__" };

  return { ...base, cityId: { in: cityIds } };
}
