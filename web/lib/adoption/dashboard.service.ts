/**
 * Action-Based Dashboard — Service Layer
 *
 * Provides role-aware action buttons, quick stats, and activity feed
 * by orchestrating existing domain queries. No new business logic.
 *
 * Architecture:
 *   1. Static action registry (fallback for all orgs)
 *   2. Per-org overrides via DashboardAction table (enterprise)
 *   3. Quick stats via existing aggregation queries
 *   4. Activity feed from DomainEventLog
 */
import { prisma } from "@/lib/prisma";
import type { AuthUser } from "@/lib/auth-guard";
import { isSuperAdmin } from "@/lib/auth-guard";
import { getRedisConnection } from "@/lib/queue/connection";
import { toDailyStatsDate } from "@/lib/performance/organization-daily-stats.service";

/* ── Action Types ─────────────────────────────────────── */

export interface DashboardActionDef {
  key: string;
  label: string;
  icon: string;
  route: string;
  category: "primary" | "secondary";
}

export interface QuickStat {
  key: string;
  label: string;
  value: number | string;
  trend?: "up" | "down" | "neutral";
  format?: "number" | "currency" | "percent";
}

export interface ActivityItem {
  id: string;
  eventType: string;
  label: string;
  occurredAt: Date;
  initiatedByUserId: number | null;
}

/* ── Static Action Registry ───────────────────────────── */

const ACTION_REGISTRY: Record<string, DashboardActionDef[]> = {
  ORG_ADMIN: [
    { key: "ENROLLMENT_STATS", label: "Enrollment Stats", icon: "users", route: "/admin/enrollments", category: "primary" },
    { key: "REVENUE_SNAPSHOT", label: "Revenue Snapshot", icon: "trending-up", route: "/admin/finance/revenue", category: "primary" },
    { key: "ACADEMIC_OVERVIEW", label: "Academic Overview", icon: "graduation-cap", route: "/admin/academic", category: "primary" },
    { key: "DEFAULTER_SUMMARY", label: "Defaulter Summary", icon: "alert-triangle", route: "/admin/finance/defaulters", category: "primary" },
    { key: "MANAGE_STAFF", label: "Manage Staff", icon: "user-cog", route: "/admin/staff", category: "primary" },
    { key: "BROADCAST_MESSAGE", label: "Send Broadcast", icon: "megaphone", route: "/admin/messages/broadcast", category: "primary" },
  ],
  CAMPUS_ADMIN: [
    { key: "ENROLLMENT_STATS", label: "Enrollment Stats", icon: "users", route: "/admin/enrollments", category: "primary" },
    { key: "REVENUE_SNAPSHOT", label: "Revenue Today", icon: "trending-up", route: "/admin/finance/revenue", category: "primary" },
    { key: "ATTENDANCE_OVERVIEW", label: "Attendance Today", icon: "calendar-check", route: "/admin/attendance", category: "primary" },
    { key: "DEFAULTER_SUMMARY", label: "Defaulter List", icon: "alert-triangle", route: "/admin/finance/defaulters", category: "primary" },
    { key: "ADD_STUDENT", label: "Add Student", icon: "user-plus", route: "/admin/students/new", category: "primary" },
    { key: "SEND_MESSAGE", label: "Send Message", icon: "megaphone", route: "/admin/messages", category: "secondary" },
  ],
  ACCOUNTANT: [
    { key: "COLLECT_FEE", label: "Collect Fee", icon: "wallet", route: "/admin/fees/collect", category: "primary" },
    { key: "TODAYS_COLLECTION", label: "Today's Collection", icon: "banknote", route: "/admin/finance/today", category: "primary" },
    { key: "REVENUE_SUMMARY", label: "Revenue Summary", icon: "bar-chart-3", route: "/admin/finance/revenue", category: "primary" },
    { key: "PRINT_CHALLAN", label: "Print Challan", icon: "printer", route: "/admin/fees/print", category: "primary" },
    { key: "RECONCILE_PAYMENT", label: "Reconcile Payment", icon: "check-circle", route: "/admin/finance/reconcile", category: "primary" },
    { key: "DEFAULTER_REMINDER", label: "Send Reminders", icon: "bell", route: "/admin/finance/reminders", category: "secondary" },
  ],
  TEACHER: [
    { key: "MARK_ATTENDANCE", label: "Mark Attendance", icon: "calendar", route: "/admin/attendance/mark", category: "primary" },
    { key: "ENTER_MARKS", label: "Enter Marks", icon: "edit-3", route: "/admin/exams/results", category: "primary" },
    { key: "VIEW_CLASS", label: "View Class List", icon: "list", route: "/admin/classes/my", category: "primary" },
    { key: "ATTENDANCE_SUMMARY", label: "Attendance Summary", icon: "pie-chart", route: "/admin/attendance/summary", category: "primary" },
    { key: "CLASS_MESSAGE", label: "Send Class Message", icon: "message-square", route: "/admin/messages/class", category: "secondary" },
  ],
  STAFF: [
    { key: "ADD_STUDENT", label: "Add Student", icon: "user-plus", route: "/admin/students/new", category: "primary" },
    { key: "COLLECT_FEE", label: "Collect Fee", icon: "wallet", route: "/admin/fees/collect", category: "primary" },
    { key: "PRINT_CHALLAN", label: "Print Challan", icon: "printer", route: "/admin/fees/print", category: "primary" },
    { key: "SEARCH_STUDENT", label: "Search Student", icon: "search", route: "/admin/students", category: "primary" },
    { key: "NEW_ADMISSION", label: "New Admission", icon: "clipboard-plus", route: "/admin/admissions/new", category: "primary" },
    { key: "SEND_MESSAGE", label: "Send Message", icon: "megaphone", route: "/admin/messages", category: "secondary" },
  ],
  PARENT: [
    { key: "VIEW_CHILD", label: "My Child", icon: "user", route: "/parent/child", category: "primary" },
    { key: "FEE_STATUS", label: "Fee Status", icon: "wallet", route: "/parent/fees", category: "primary" },
    { key: "ATTENDANCE", label: "Attendance", icon: "calendar", route: "/parent/attendance", category: "primary" },
    { key: "RESULTS", label: "Results", icon: "award", route: "/parent/results", category: "primary" },
  ],
};

const HIERARCHICAL_ADMIN_ROLES = [
  "REGION_ADMIN",
  "SUBREGION_ADMIN",
  "ZONE_ADMIN",
];

/* ── Get Actions ──────────────────────────────────────── */

export async function getDashboardActions(
  guard: AuthUser,
): Promise<DashboardActionDef[]> {
  const role = guard.role ?? "";
  const orgId = guard.organizationId;

  if (orgId) {
    const customActions = await prisma.dashboardAction.findMany({
      where: {
        organizationId: orgId,
        role,
        enabled: true,
      },
      orderBy: { displayOrder: "asc" },
    });

    if (customActions.length > 0) {
      return customActions.map((a) => ({
        key: a.actionKey,
        label: a.label,
        icon: a.icon,
        route: a.route,
        category: a.category as "primary" | "secondary",
      }));
    }
  }

  const effectiveRole = HIERARCHICAL_ADMIN_ROLES.includes(role)
    ? "ORG_ADMIN"
    : role;

  if (isSuperAdmin(guard)) {
    return ACTION_REGISTRY["ORG_ADMIN"] ?? [];
  }

  return ACTION_REGISTRY[effectiveRole] ?? ACTION_REGISTRY["STAFF"] ?? [];
}

/* ── Quick Stats ──────────────────────────────────────── */

export async function getDashboardStats(
  guard: AuthUser,
): Promise<QuickStat[]> {
  const orgId = guard.organizationId;

  if (!orgId && !isSuperAdmin(guard)) return [];
  if (!orgId) return [];
  const statsDate = toDailyStatsDate();
  const dayKey = `${statsDate.getUTCFullYear()}-${String(statsDate.getUTCMonth() + 1).padStart(2, "0")}-${String(statsDate.getUTCDate()).padStart(2, "0")}`;
  const cacheKey = `dashboard:${orgId}:${dayKey}`;

  let payload:
    | {
      studentCount: number;
      totalRevenue: number;
      attendanceCount: number;
      challanCount: number;
      outstandingAmount: number;
    }
    | null = null;

  try {
    const redis = getRedisConnection();
    const cached = await redis.get(cacheKey);
    if (cached) {
      payload = JSON.parse(cached) as {
        studentCount: number;
        totalRevenue: number;
        attendanceCount: number;
        challanCount: number;
        outstandingAmount: number;
      };
    } else {
      const row = await prisma.organizationDailyStats.findUnique({
        where: {
          organizationId_date: {
            organizationId: orgId,
            date: statsDate,
          },
        },
      });
      payload = {
        studentCount: row?.studentCount ?? 0,
        totalRevenue: row?.totalRevenue ?? 0,
        attendanceCount: row?.attendanceCount ?? 0,
        challanCount: row?.challanCount ?? 0,
        outstandingAmount: row?.outstandingAmount ?? 0,
      };
      await redis.set(cacheKey, JSON.stringify(payload), "EX", 10);
    }
  } catch {
    const row = await prisma.organizationDailyStats.findUnique({
      where: {
        organizationId_date: {
          organizationId: orgId,
          date: statsDate,
        },
      },
    });
    payload = {
      studentCount: row?.studentCount ?? 0,
      totalRevenue: row?.totalRevenue ?? 0,
      attendanceCount: row?.attendanceCount ?? 0,
      challanCount: row?.challanCount ?? 0,
      outstandingAmount: row?.outstandingAmount ?? 0,
    };
  }

  return [
    { key: "students", label: "Total Students", value: payload.studentCount, format: "number" },
    { key: "today_collection", label: "Today's Collection", value: payload.totalRevenue, format: "currency" },
    { key: "attendance_marked", label: "Attendance Marked", value: payload.attendanceCount, format: "number" },
    { key: "challans_issued", label: "Challans Issued", value: payload.challanCount, format: "number" },
    { key: "outstanding", label: "Outstanding", value: payload.outstandingAmount, format: "currency" },
  ];
}

/* ── Activity Feed ────────────────────────────────────── */

const EVENT_LABELS: Record<string, string> = {
  PaymentReconciled: "Payment received",
  ChallanCreated: "Challan generated",
  StudentEnrolled: "Student enrolled",
  StudentWithdrawn: "Student withdrawn",
  StudentPromoted: "Student promoted",
  FeePostingCompleted: "Fee posting completed",
  ExamPublished: "Exam results published",
  AcademicYearActivated: "Academic year activated",
  AcademicYearClosed: "Academic year closed",
  PromotionRunCompleted: "Promotion run completed",
  OrganizationBootstrapped: "School setup completed",
  ParentAccessCreated: "Parent linked",
};

export async function getDashboardActivity(
  guard: AuthUser,
  limit = 15,
): Promise<ActivityItem[]> {
  const orgId = guard.organizationId;

  if (!orgId && !isSuperAdmin(guard)) return [];

  const where: Record<string, unknown> = {};
  if (orgId) where.organizationId = orgId;

  const events = await prisma.domainEventLog.findMany({
    where,
    orderBy: { occurredAt: "desc" },
    take: limit,
    select: {
      id: true,
      eventType: true,
      occurredAt: true,
      initiatedByUserId: true,
    },
  });

  return events.map((e) => ({
    id: e.id,
    eventType: e.eventType,
    label: EVENT_LABELS[e.eventType] ?? e.eventType,
    occurredAt: e.occurredAt,
    initiatedByUserId: e.initiatedByUserId,
  }));
}
