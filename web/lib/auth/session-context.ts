import { prisma } from "@/lib/prisma";

export type SessionContext = {
  userId: number;
  email: string;
  name: string;
  platformRole: string | null;
  role: string | null;
  organizationId: string | null;
  campusId: number | null;
  membershipId: number | null;
  organizationStructure: string | null;
  unitPath: string | null;
};

export async function resolveSessionContext(
  userId: number,
  preferredOrganizationId?: string | null,
): Promise<SessionContext | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      memberships: {
        where: {
          ...(preferredOrganizationId
            ? { organizationId: preferredOrganizationId }
            : {}),
        },
        // Narrow org fields: loading full Organization can fail on prod DBs that
        // lag migrations (new columns in schema but not yet in database).
        include: {
          organization: {
            select: {
              id: true,
              organizationStructure: true,
            },
          },
        },
        orderBy: { createdAt: "asc" },
        take: 5,
      },
    },
  });

  if (!user || !user.isActive) return null;

  const activeMembership = user.memberships.find((m) => m.status === "ACTIVE");
  const invitedMembership = user.memberships.find((m) => m.status === "INVITED");
  const membership =
    activeMembership ?? invitedMembership ?? user.memberships[0] ?? null;

  let resolvedOrganizationId = membership?.organizationId ?? null;
  let resolvedCampusId = membership?.campusId ?? null;
  let resolvedMembershipId = membership?.id ?? null;
  let resolvedOrganizationStructure =
    membership?.organization?.organizationStructure ?? null;
  let resolvedUnitPath = membership?.unitPath ?? null;

  // Platform users can exist without membership rows; choose a default org context.
  if (
    !resolvedOrganizationId &&
    (user.platformRole === "SUPER_ADMIN" || user.platformRole === "SUPPORT")
  ) {
    const defaultOrg = await prisma.organization.findFirst({
      where: { status: "ACTIVE" },
      select: { id: true, organizationStructure: true },
      orderBy: { createdAt: "desc" },
    });

    if (defaultOrg) {
      resolvedOrganizationId = defaultOrg.id;
      resolvedOrganizationStructure = defaultOrg.organizationStructure;

      const mainCampus = await prisma.campus.findFirst({
        where: {
          organizationId: defaultOrg.id,
          isMainCampus: true,
        },
        select: { id: true },
      });

      resolvedCampusId = mainCampus?.id ?? null;
      resolvedMembershipId = null;
      resolvedUnitPath = null;
    }
  }

  return {
    userId: user.id,
    email: user.email ?? user.phone ?? "",
    name: user.name ?? user.email ?? user.phone ?? "",
    platformRole: user.platformRole ?? null,
    role: membership?.role ?? null,
    organizationId: resolvedOrganizationId,
    campusId: resolvedCampusId,
    membershipId: resolvedMembershipId,
    organizationStructure: resolvedOrganizationStructure,
    unitPath: resolvedUnitPath,
  };
}
