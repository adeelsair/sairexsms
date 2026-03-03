import { NextResponse } from "next/server";
import { AuthUser, isSuperAdmin } from "./auth-guard";
import { prisma } from "./prisma";

// ────────────────────────────────────────────────────────────
// 1.  SCOPE FILTER — Hierarchical RBAC
//     Structure-aware + unitPath prefix filtering.
// ────────────────────────────────────────────────────────────

type ScopeOptions = {
  /** Set true for models that have a campusId column (students, challans, etc.) */
  hasCampus?: boolean;
};

const HIERARCHICAL_ROLES = ["REGION_ADMIN", "SUBREGION_ADMIN", "ZONE_ADMIN"];

/**
 * Returns a Prisma-compatible `where` filter scoped to the user's tenant.
 *
 * | Case                           | Filter                                              |
 * |--------------------------------|------------------------------------------------------|
 * | SUPER_ADMIN                    | `{}`                                                 |
 * | SINGLE structure (any role)    | `{ organizationId }`                                 |
 * | ORG_ADMIN                      | `{ organizationId }`                                 |
 * | REGION/SUBREGION/ZONE_ADMIN    | `{ organizationId, campus: { fullUnitPath starts } }`|
 * | CAMPUS_ADMIN (unitPath)        | `{ organizationId, campus: { fullUnitPath exact } }`  |
 * | Legacy campus-scoped           | `{ organizationId, campusId }`                       |
 * | Staff with unitPath            | `{ organizationId, campus: { fullUnitPath exact } }`  |
 */
export function scopeFilter(
  guard: AuthUser,
  opts: ScopeOptions = {},
): Record<string, unknown> {
  if (isSuperAdmin(guard)) return {};

  const baseFilter: Record<string, unknown> = {
    organizationId: guard.organizationId,
  };

  if (!opts.hasCampus) return baseFilter;

  if (guard.organizationStructure === "SINGLE") {
    return baseFilter;
  }

  if (guard.role === "ORG_ADMIN") {
    return baseFilter;
  }

  if (HIERARCHICAL_ROLES.includes(guard.role ?? "") && guard.unitPath) {
    return {
      ...baseFilter,
      campus: {
        fullUnitPath: { startsWith: guard.unitPath },
      },
    };
  }

  if (guard.role === "CAMPUS_ADMIN" && guard.unitPath) {
    return {
      ...baseFilter,
      campus: {
        fullUnitPath: guard.unitPath,
      },
    };
  }

  if (guard.campusId) {
    return {
      ...baseFilter,
      campusId: guard.campusId,
    };
  }

  if (guard.unitPath) {
    return {
      ...baseFilter,
      campus: {
        fullUnitPath: guard.unitPath,
      },
    };
  }

  return baseFilter;
}

// ────────────────────────────────────────────────────────────
// 2.  RESOLVE ORG ID — determines the effective organizationId for writes
// ────────────────────────────────────────────────────────────

/**
 * For POST/PUT, determine the effective organizationId.
 * Tenant context must come from authenticated session only.
 */
export function resolveOrgId(
  guard: AuthUser,
  bodyOrgId?: string | null,
): string {
  const sessionOrgId = guard.organizationId ?? "";

  if (!sessionOrgId) {
    return "";
  }

  // Defensive check: reject client-supplied tenant override attempts.
  if (bodyOrgId && bodyOrgId !== sessionOrgId) {
    throw new Error("Tenant override attempt detected");
  }

  return sessionOrgId;
}

// ────────────────────────────────────────────────────────────
// 3.  CROSS-REFERENCE VALIDATION
//     Ensures a referenced entity belongs to the same organization
// ────────────────────────────────────────────────────────────

type CrossRefCheck = {
  model: "campus" | "feeHead" | "student";
  id: number;
  label: string;
};

/**
 * Validates that every referenced entity belongs to the given organizationId.
 * Returns null if all pass, or a 403 NextResponse describing the violation.
 */
export async function validateCrossRefs(
  orgId: string,
  checks: CrossRefCheck[],
): Promise<NextResponse | null> {
  for (const check of checks) {
    if (!check.id) continue;

    let record: { organizationId: string } | null = null;

    switch (check.model) {
      case "campus":
        record = await prisma.campus.findUnique({
          where: { id: check.id },
          select: { organizationId: true },
        });
        break;
      case "feeHead":
        record = await prisma.feeHead.findUnique({
          where: { id: check.id },
          select: { organizationId: true },
        });
        break;
      case "student":
        record = await prisma.student.findUnique({
          where: { id: check.id },
          select: { organizationId: true },
        });
        break;
    }

    if (!record) {
      return NextResponse.json(
        { error: `${check.label} not found (id: ${check.id})` },
        { status: 404 },
      );
    }

    if (record.organizationId !== orgId) {
      return NextResponse.json(
        {
          error: `${check.label} does not belong to your organization`,
        },
        { status: 403 },
      );
    }
  }

  return null;
}

// ────────────────────────────────────────────────────────────
// 4.  OWNERSHIP CHECK — verifies an existing record belongs to the user's org
// ────────────────────────────────────────────────────────────

/**
 * Verifies that a record's organizationId matches the user's.
 * Returns null if OK, or a 403 NextResponse.
 */
export function assertOwnership(
  guard: AuthUser,
  recordOrgId: string,
): NextResponse | null {
  if (isSuperAdmin(guard)) return null;

  if (recordOrgId !== guard.organizationId) {
    return NextResponse.json(
      { error: "Forbidden — this record belongs to another organization" },
      { status: 403 },
    );
  }

  return null;
}
