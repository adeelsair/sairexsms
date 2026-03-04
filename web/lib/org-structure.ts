import { OrganizationStructure } from "@/lib/generated/prisma";

export interface OrgStructureInput {
  organizationStructure: OrganizationStructure;
}

export interface OrgSessionInput extends OrgStructureInput {
  organizationId: string;
  campusId?: string | null;
}

/* ── Basic checks ─────────────────────────────────────────── */

export function isSingleStructure(org: OrgStructureInput): boolean {
  return org.organizationStructure === "SINGLE";
}

export function isMultiStructure(org: OrgStructureInput): boolean {
  return org.organizationStructure === "MULTIPLE";
}

/* ── Feature availability ─────────────────────────────────── */

export function canCreateCampus(org: OrgStructureInput): boolean {
  return isMultiStructure(org);
}

export function canCreateGeo(org: OrgStructureInput): boolean {
  return isMultiStructure(org);
}

export function shouldUseCampusScope(org: OrgStructureInput): boolean {
  return isMultiStructure(org);
}

/* ── Operational scope ────────────────────────────────────── */

export type OperationalScope = {
  organizationId: string;
  campusId?: string;
};

export function getOperationalScope(
  session: OrgSessionInput,
): OperationalScope {
  if (shouldUseCampusScope(session)) {
    return {
      organizationId: session.organizationId,
      campusId: session.campusId ?? undefined,
    };
  }

  return { organizationId: session.organizationId };
}

/* ── Campus resolution ────────────────────────────────────── */

export function getDefaultCampusId(
  session: OrgSessionInput,
): string | undefined {
  return session.campusId ?? undefined;
}

/* ── Validation guards ────────────────────────────────────── */

export function assertCanCreateCampus(org: OrgStructureInput): void {
  if (!canCreateCampus(org)) {
    throw new Error("Single-structure organization can only have one campus");
  }
}

export function assertCanCreateGeo(org: OrgStructureInput): void {
  if (!canCreateGeo(org)) {
    throw new Error("Geo hierarchy is disabled for single-structure organizations");
  }
}
