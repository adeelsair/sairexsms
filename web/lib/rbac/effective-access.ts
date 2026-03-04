import { prisma } from "@/lib/prisma";

/* ── Types ─────────────────────────────────────────────────── */

export interface EffectiveCampus {
  id: number;
  name: string;
  fullUnitPath: string;
}

export interface EffectiveAccessResult {
  campuses: EffectiveCampus[];
  totalCampuses: number;
}

export interface EffectiveAccessParams {
  organizationId: string;
  role: string;
  unitPath?: string | null;
  campusId?: number | null;
  countOnly?: boolean;
}

/* ── Core computation ──────────────────────────────────────── */

export async function computeEffectiveCampusAccess(
  params: EffectiveAccessParams,
): Promise<EffectiveAccessResult> {
  const { organizationId, role, unitPath, campusId, countOnly } = params;

  const select = { id: true, name: true, fullUnitPath: true } as const;

  if (role === "ORG_ADMIN") {
    if (countOnly) {
      const totalCampuses = await prisma.campus.count({
        where: { organizationId, status: "ACTIVE" },
      });
      return { campuses: [], totalCampuses };
    }

    const campuses = await prisma.campus.findMany({
      where: { organizationId, status: "ACTIVE" },
      select,
      orderBy: { name: "asc" },
    });
    return { campuses, totalCampuses: campuses.length };
  }

  if (campusId && !unitPath) {
    const campus = await prisma.campus.findUnique({
      where: { id: campusId },
      select,
    });
    return {
      campuses: campus ? [campus] : [],
      totalCampuses: campus ? 1 : 0,
    };
  }

  if (unitPath) {
    const where = {
      organizationId,
      status: "ACTIVE" as const,
      fullUnitPath: { startsWith: unitPath },
    };

    if (countOnly) {
      const totalCampuses = await prisma.campus.count({ where });
      return { campuses: [], totalCampuses };
    }

    const campuses = await prisma.campus.findMany({
      where,
      select,
      orderBy: { name: "asc" },
    });
    return { campuses, totalCampuses: campuses.length };
  }

  return { campuses: [], totalCampuses: 0 };
}

/* ── Client-side tree grouping helper ──────────────────────── */

export interface CampusTreeNode {
  segment: string;
  fullPath: string;
  campuses: EffectiveCampus[];
  children: CampusTreeNode[];
}

export function buildCampusTree(
  campuses: EffectiveCampus[],
): CampusTreeNode[] {
  const root: CampusTreeNode[] = [];

  for (const campus of campuses) {
    const segments = campus.fullUnitPath.split("-");
    let current = root;

    let pathSoFar = "";
    for (let i = 0; i < segments.length - 1; i++) {
      pathSoFar = pathSoFar ? `${pathSoFar}-${segments[i]}` : segments[i];
      let node = current.find((n) => n.segment === segments[i]);
      if (!node) {
        node = {
          segment: segments[i],
          fullPath: pathSoFar,
          campuses: [],
          children: [],
        };
        current.push(node);
      }
      current = node.children;
    }

    const leafSegment = segments[segments.length - 1];
    pathSoFar = pathSoFar
      ? `${pathSoFar}-${leafSegment}`
      : leafSegment;
    let leaf = current.find((n) => n.segment === leafSegment);
    if (!leaf) {
      leaf = {
        segment: leafSegment,
        fullPath: pathSoFar,
        campuses: [],
        children: [],
      };
      current.push(leaf);
    }
    leaf.campuses.push(campus);
  }

  return root;
}
