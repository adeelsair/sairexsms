export interface AuditSessionLike {
  id: number | string;
  organizationId?: string | null;
  impersonation?: boolean;
  impersonationOriginalUserId?: number | null;
  impersonationEffectiveUserId?: number | null;
  impersonationTenantId?: string | null;
}

export interface AuditActorContext {
  actorUserId: number;
  effectiveUserId: number;
  tenantId: string;
  impersonation: boolean;
}

export function resolveAuditActor(session: AuditSessionLike): AuditActorContext {
  const effectiveUserId = Boolean(session.impersonation)
    ? Number(session.impersonationEffectiveUserId ?? session.id)
    : Number(session.id);
  if (!Number.isFinite(effectiveUserId) || effectiveUserId <= 0) {
    throw new Error("Invalid audit session user id");
  }

  const impersonation = Boolean(session.impersonation);
  const actorUserId = impersonation
    ? Number(session.impersonationOriginalUserId ?? effectiveUserId)
    : effectiveUserId;

  if (!Number.isFinite(actorUserId) || actorUserId <= 0) {
    throw new Error("Invalid audit actor user id");
  }

  const tenantId = impersonation
    ? (session.impersonationTenantId ?? session.organizationId ?? "")
    : (session.organizationId ?? "");

  if (!tenantId) {
    throw new Error("Invalid audit tenant id");
  }

  return {
    actorUserId,
    effectiveUserId,
    tenantId,
    impersonation,
  };
}
