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
          status: "ACTIVE",
          ...(preferredOrganizationId
            ? { organizationId: preferredOrganizationId }
            : {}),
        },
        include: { organization: true },
        orderBy: { createdAt: "asc" },
        take: 1,
      },
    },
  });

  if (!user || !user.isActive) return null;
  const membership = user.memberships[0] ?? null;

  return {
    userId: user.id,
    email: user.email ?? user.phone ?? "",
    name: user.name ?? user.email ?? user.phone ?? "",
    platformRole: user.platformRole ?? null,
    role: membership?.role ?? null,
    organizationId: membership?.organizationId ?? null,
    campusId: membership?.campusId ?? null,
    membershipId: membership?.id ?? null,
    organizationStructure: membership?.organization?.organizationStructure ?? null,
    unitPath: membership?.unitPath ?? null,
  };
}
