export interface RequestContext {
  ipAddress: string | null;
  userAgent: string | null;
}

export function getRequestContext(req: Request): RequestContext {
  const forwarded = req.headers.get("x-forwarded-for");
  return {
    ipAddress: forwarded?.split(",")[0]?.trim() ?? null,
    userAgent: req.headers.get("user-agent") ?? null,
  };
}
