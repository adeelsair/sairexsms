import NextAuth from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/prisma";
import { authConfig } from "./auth.config";
import {
  readSessionTokenFromRequestCookies,
} from "@/lib/auth/session-cookie";
import { resolveSessionContext } from "@/lib/auth/session-context";

function parseUserId(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  adapter: PrismaAdapter(prisma),
  session: { strategy: "database" },
  callbacks: {
    ...authConfig.callbacks,
    async session({ session, user, trigger, newSession }) {
      const rawSession = session as unknown as Record<string, unknown>;
      const rawSessionUser = (rawSession.user ?? {}) as Record<string, unknown>;
      const adapterUser = (user ?? {}) as unknown as Record<string, unknown>;

      const sessionToken = await readSessionTokenFromRequestCookies();
      if (!sessionToken) return session;

      const dbSession = await prisma.session.findUnique({
        where: { sessionToken },
      });
      if (!dbSession) return session;

      const userId = parseUserId(adapterUser.id ?? rawSessionUser.id ?? rawSession.userId);
      if (!userId) return session;

      if (trigger === "update" && newSession && !dbSession.impersonation) {
        const incoming = newSession as Record<string, unknown>;
        const patch: Record<string, unknown> = {};
        if (incoming.organizationId !== undefined) {
          patch.organizationId = incoming.organizationId
            ? String(incoming.organizationId)
            : null;
        }
        if (incoming.campusId !== undefined) {
          patch.campusId = incoming.campusId ? Number(incoming.campusId) : null;
        }
        if (incoming.membershipId !== undefined) {
          patch.membershipId = incoming.membershipId
            ? Number(incoming.membershipId)
            : null;
        }
        if (incoming.organizationStructure !== undefined) {
          patch.organizationStructure = incoming.organizationStructure
            ? String(incoming.organizationStructure)
            : null;
        }
        if (incoming.unitPath !== undefined) {
          patch.unitPath = incoming.unitPath ? String(incoming.unitPath) : null;
        }
        if (incoming.role !== undefined) {
          patch.role = incoming.role ? String(incoming.role) : null;
        }

        if (Object.keys(patch).length > 0) {
          await prisma.session.update({
            where: { id: dbSession.id },
            data: patch,
          });
        }
      }

      const latestSession = await prisma.session.findUnique({
        where: { sessionToken },
      });
      if (!latestSession) return session;

      let baseCtx: Awaited<ReturnType<typeof resolveSessionContext>> = null;
      try {
        baseCtx = await resolveSessionContext(
          userId,
          latestSession.organizationId ?? null,
        );
      } catch (err) {
        console.error("[auth.session] resolveSessionContext failed:", err);
        baseCtx = null;
      }

      if (!latestSession.organizationId && baseCtx) {
        await prisma.session.update({
          where: { id: latestSession.id },
          data: {
            organizationId: baseCtx.organizationId,
            campusId: baseCtx.campusId,
            membershipId: baseCtx.membershipId,
            organizationStructure: baseCtx.organizationStructure,
            unitPath: baseCtx.unitPath,
            role: baseCtx.role,
            platformRole: baseCtx.platformRole,
          },
        });
      }

      const resolved = await prisma.session.findUnique({
        where: { sessionToken },
      });
      if (!resolved) return session;

      const normalizedSession = {
        expires: resolved.expires.toISOString(),
        user: {},
      } as typeof session;
      const userRecord = normalizedSession.user as unknown as Record<string, unknown>;
      userRecord.id = String(userId);
      userRecord.email =
        baseCtx?.email ??
        (typeof rawSessionUser.email === "string" ? rawSessionUser.email : "");
      userRecord.name =
        baseCtx?.name ??
        (typeof rawSessionUser.name === "string" ? rawSessionUser.name : "");
      userRecord.platformRole = resolved.platformRole ?? baseCtx?.platformRole ?? null;
      userRecord.role = resolved.role ?? baseCtx?.role ?? null;
      userRecord.organizationId =
        resolved.organizationId ?? baseCtx?.organizationId ?? null;
      userRecord.campusId = resolved.campusId ?? baseCtx?.campusId ?? null;
      userRecord.membershipId =
        resolved.membershipId ?? baseCtx?.membershipId ?? null;
      userRecord.organizationStructure =
        resolved.organizationStructure ?? baseCtx?.organizationStructure ?? null;
      userRecord.unitPath = resolved.unitPath ?? baseCtx?.unitPath ?? null;
      userRecord.impersonation = Boolean(resolved.impersonation);
      userRecord.impersonationOriginalUserId =
        resolved.impersonationOriginalUserId ?? null;
      userRecord.impersonationEffectiveUserId =
        resolved.impersonationEffectiveUserId ?? null;
      userRecord.impersonationTenantId = resolved.impersonationTenantId ?? null;
      userRecord.impersonationExpiresAt = resolved.impersonationExpiresAt
        ? resolved.impersonationExpiresAt.getTime()
        : null;

      return normalizedSession;
    },
  },
  providers: [],
});
