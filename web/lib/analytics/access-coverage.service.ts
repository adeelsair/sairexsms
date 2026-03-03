import { prisma } from "@/lib/prisma";

/* ── Types ─────────────────────────────────────────────────── */

export type CoverageLevel =
  | "ORG"
  | "REGION"
  | "SUBREGION"
  | "ZONE"
  | "CAMPUS";

export type RiskLevel = "critical" | "warning" | "healthy" | "empty";

export interface CoverageRow {
  unitName: string;
  unitPath: string;
  admins: number;
  campuses: number;
  students: number;
  staff: number;
  revenue: number;
  studentsPerAdmin: number | null;
  revenuePerAdmin: number | null;
  riskLevel: RiskLevel;
}

interface CoverageParams {
  organizationId: string;
  level: CoverageLevel;
  scopeUnitPath?: string | null;
}

/* ── Constants ─────────────────────────────────────────────── */

const ADMIN_ROLES = [
  "ORG_ADMIN",
  "REGION_ADMIN",
  "SUBREGION_ADMIN",
  "ZONE_ADMIN",
  "CAMPUS_ADMIN",
] as const;

const STAFF_ROLES = ["TEACHER", "ACCOUNTANT", "STAFF"] as const;

const LEVEL_SEGMENTS: Record<CoverageLevel, number> = {
  ORG: 0,
  REGION: 1,
  SUBREGION: 2,
  ZONE: 4,
  CAMPUS: 5,
};

const STUDENTS_PER_ADMIN_WARNING = 2000;
const STUDENTS_PER_ADMIN_CRITICAL = 5000;

/* ── Prefix extraction ─────────────────────────────────────── */

function extractPrefix(fullPath: string, level: CoverageLevel): string {
  if (level === "ORG") return "__ORG__";
  const segments = fullPath.split("-");
  return segments.slice(0, LEVEL_SEGMENTS[level]).join("-");
}

/* ── Risk computation ──────────────────────────────────────── */

function computeRisk(students: number, admins: number): RiskLevel {
  if (students === 0 && admins === 0) return "empty";
  if (admins === 0 && students > 0) return "critical";
  const ratio = students / admins;
  if (ratio > STUDENTS_PER_ADMIN_CRITICAL) return "critical";
  if (ratio > STUDENTS_PER_ADMIN_WARNING) return "warning";
  return "healthy";
}

function enrichRow(partial: Omit<CoverageRow, "studentsPerAdmin" | "revenuePerAdmin" | "riskLevel">): CoverageRow {
  return {
    ...partial,
    studentsPerAdmin: partial.admins > 0 ? Math.round(partial.students / partial.admins) : null,
    revenuePerAdmin: partial.admins > 0 ? Math.round(partial.revenue / partial.admins) : null,
    riskLevel: computeRisk(partial.students, partial.admins),
  };
}

/* ══════════════════════════════════════════════════════════════
   Main service — O(6) queries regardless of org size
   ══════════════════════════════════════════════════════════════ */

export async function getAccessCoverage(
  params: CoverageParams,
): Promise<CoverageRow[]> {
  const { organizationId, level, scopeUnitPath } = params;

  const scopeFilter = scopeUnitPath
    ? { startsWith: scopeUnitPath }
    : undefined;

  /*
   * 6 queries in a single transaction:
   *   1. campuses (id + fullUnitPath + name)
   *   2. students  — groupBy campusId → _count
   *   3. staff     — groupBy campusId → _count (membership roles)
   *   4. admins    — groupBy unitPath → _count (membership roles)
   *   5. revenue   — groupBy campusId → _sum paidAmount
   *   6. unit names (regions / subregions / zones)
   */
  const [
    campuses,
    studentAgg,
    staffAgg,
    adminAgg,
    revenueAgg,
  ] = await prisma.$transaction([
    /* 1 — All campuses (lightweight) */
    prisma.campus.findMany({
      where: {
        organizationId,
        status: "ACTIVE",
        ...(scopeFilter ? { fullUnitPath: scopeFilter } : {}),
      },
      select: { id: true, name: true, fullUnitPath: true },
    }),

    /* 2 — Student counts by campus */
    prisma.student.groupBy({
      by: ["campusId"],
      orderBy: { campusId: "asc" },
      _count: { campusId: true },
      where: { organizationId },
    }),

    /* 3 — Staff counts by campus (TEACHER, ACCOUNTANT, STAFF) */
    prisma.membership.groupBy({
      by: ["campusId"],
      orderBy: { campusId: "asc" },
      _count: { campusId: true },
      where: {
        organizationId,
        status: "ACTIVE",
        role: { in: [...STAFF_ROLES] },
        campusId: { not: null },
      },
    }),

    /* 4 — Admin counts by unitPath */
    prisma.membership.groupBy({
      by: ["unitPath"],
      orderBy: { unitPath: "asc" },
      _count: { unitPath: true },
      where: {
        organizationId,
        status: "ACTIVE",
        role: { in: [...ADMIN_ROLES] },
        ...(scopeFilter ? { unitPath: scopeFilter } : {}),
      },
    }),

    /* 5 — Revenue (paid) by campus */
    prisma.feeChallan.groupBy({
      by: ["campusId"],
      orderBy: { campusId: "asc" },
      _sum: { paidAmount: true },
      where: { organizationId },
    }),
  ]);
  const unitNames = await resolveUnitNames(organizationId, level);

  /* ── Build O(1) lookup maps from aggregates ────────────── */

  const campusIdSet = new Set(campuses.map((c) => c.id));

  const studentMap = new Map<number, number>();
  for (const row of studentAgg) {
    if (campusIdSet.has(row.campusId)) {
      const count =
        row._count && row._count !== true
          ? (row._count.campusId ?? row._count._all ?? 0)
          : 0;
      studentMap.set(row.campusId, count);
    }
  }

  const staffMap = new Map<number, number>();
  for (const row of staffAgg) {
    if (row.campusId !== null && campusIdSet.has(row.campusId)) {
      const count =
        row._count && row._count !== true
          ? (row._count.campusId ?? row._count._all ?? 0)
          : 0;
      staffMap.set(row.campusId, count);
    }
  }

  const revenueMap = new Map<number, number>();
  for (const row of revenueAgg) {
    if (campusIdSet.has(row.campusId)) {
      revenueMap.set(row.campusId, Number(row._sum?.paidAmount ?? 0));
    }
  }

  const adminByPath = new Map<string, number>();
  for (const row of adminAgg) {
    if (row.unitPath) {
      const count =
        row._count && row._count !== true
          ? (row._count.unitPath ?? row._count._all ?? 0)
          : 0;
      adminByPath.set(row.unitPath, count);
    }
  }

  /* ── ORG level: single summary row ─────────────────────── */

  if (level === "ORG") {
    let totalStudents = 0;
    let totalStaff = 0;
    let totalRevenue = 0;
    let totalAdmins = 0;

    for (const c of campuses) {
      totalStudents += studentMap.get(c.id) ?? 0;
      totalStaff += staffMap.get(c.id) ?? 0;
      totalRevenue += revenueMap.get(c.id) ?? 0;
    }
    for (const count of adminByPath.values()) {
      totalAdmins += count;
    }

    return [
      enrichRow({
        unitName: "Organization",
        unitPath: "",
        admins: totalAdmins,
        campuses: campuses.length,
        students: totalStudents,
        staff: totalStaff,
        revenue: totalRevenue,
      }),
    ];
  }

  /* ── CAMPUS level: one row per campus ──────────────────── */

  if (level === "CAMPUS") {
    return campuses.map((c) =>
      enrichRow({
        unitName: c.name,
        unitPath: c.fullUnitPath,
        admins: adminByPath.get(c.fullUnitPath) ?? 0,
        campuses: 1,
        students: studentMap.get(c.id) ?? 0,
        staff: staffMap.get(c.id) ?? 0,
        revenue: revenueMap.get(c.id) ?? 0,
      }),
    );
  }

  /* ── Hierarchical levels: group campuses by prefix ─────── */

  const nameMap = buildNameMap(level, unitNames);

  const buckets = new Map<
    string,
    { campusIds: number[]; admins: number }
  >();

  for (const [prefix] of nameMap) {
    buckets.set(prefix, { campusIds: [], admins: 0 });
  }

  for (const c of campuses) {
    const prefix = extractPrefix(c.fullUnitPath, level);
    if (!prefix) continue;
    let bucket = buckets.get(prefix);
    if (!bucket) {
      bucket = { campusIds: [], admins: 0 };
      buckets.set(prefix, bucket);
    }
    bucket.campusIds.push(c.id);
  }

  for (const [path, count] of adminByPath) {
    const prefix = extractPrefix(path, level);
    const bucket = buckets.get(prefix);
    if (bucket) {
      bucket.admins += count;
    }
  }

  /* ── Aggregate per bucket ──────────────────────────────── */

  const rows: CoverageRow[] = [];
  for (const [prefix, bucket] of buckets) {
    let students = 0;
    let staff = 0;
    let revenue = 0;

    for (const id of bucket.campusIds) {
      students += studentMap.get(id) ?? 0;
      staff += staffMap.get(id) ?? 0;
      revenue += revenueMap.get(id) ?? 0;
    }

    rows.push(
      enrichRow({
        unitName: nameMap.get(prefix) ?? prefix,
        unitPath: prefix,
        admins: bucket.admins,
        campuses: bucket.campusIds.length,
        students,
        staff,
        revenue,
      }),
    );
  }

  rows.sort((a, b) => a.unitPath.localeCompare(b.unitPath));
  return rows;
}

/* ══════════════════════════════════════════════════════════════
   Unit name resolution (runs inside the $transaction)
   ══════════════════════════════════════════════════════════════ */

type UnitNameRow = { name: string; unitCode: string; region?: { unitCode: string } | null };

function resolveUnitNames(
  organizationId: string,
  level: CoverageLevel,
) {
  switch (level) {
    case "REGION":
      return prisma.region.findMany({
        where: { organizationId, status: "ACTIVE" },
        select: { name: true, unitCode: true },
      });
    case "SUBREGION":
      return prisma.subRegion.findMany({
        where: { organizationId, status: "ACTIVE" },
        select: {
          name: true,
          unitCode: true,
          region: { select: { unitCode: true } },
        },
      });
    case "ZONE":
      return prisma.zone.findMany({
        where: { organizationId, status: "ACTIVE" },
        select: { name: true, unitCode: true },
      });
    default:
      return Promise.resolve([]) as Promise<never[]>;
  }
}

function buildNameMap(
  level: CoverageLevel,
  units: UnitNameRow[],
): Map<string, string> {
  const map = new Map<string, string>();

  for (const u of units) {
    if (level === "SUBREGION" && u.region) {
      map.set(`${u.region.unitCode}-${u.unitCode}`, u.name);
    } else {
      map.set(u.unitCode, u.name);
    }
  }

  return map;
}
