import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-guard";

export type RequestContext = {
  userId: string;
  userName: string;
  organizationId: string;
  campusId?: string;
  role: string;
};

export async function getRequestContext(
  request?: Request,
): Promise<RequestContext> {
  const guard = await requireAuth();
  if (guard instanceof NextResponse) {
    throw new Error("Unauthorized");
  }

  const role = guard.platformRole ?? guard.role ?? "USER";
  const organizationId = guard.organizationId;

  if (!organizationId) {
    throw new Error("Organization context required");
  }

  const userName =
    guard.name?.trim() ||
    guard.email.split("@")[0] ||
    "User";

  return {
    userId: String(guard.id),
    userName,
    organizationId,
    campusId: guard.campusId != null ? String(guard.campusId) : undefined,
    role,
  };
}
