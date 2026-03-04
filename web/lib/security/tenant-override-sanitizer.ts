import { AsyncLocalStorage } from "node:async_hooks";

const TENANT_OVERRIDE_KEYS = new Set(["orgId", "organizationId", "tenantId"]);

type TenantSecurityContext = {
  userId?: number | null;
  ip?: string | null;
};

const securityContextStorage = new AsyncLocalStorage<TenantSecurityContext>();

let guardsInstalled = false;

function isObjectLike(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function removeTenantKeys(value: unknown): string[] {
  if (!isObjectLike(value)) return [];

  const removed: string[] = [];

  if (Array.isArray(value)) {
    for (const item of value) {
      removed.push(...removeTenantKeys(item));
    }
    return removed;
  }

  for (const key of Object.keys(value)) {
    const nested = value[key];
    if (TENANT_OVERRIDE_KEYS.has(key)) {
      delete value[key];
      removed.push(key);
      continue;
    }
    removed.push(...removeTenantKeys(nested));
  }

  return removed;
}

function logTenantOverrideAttempt(source: "body" | "query", keys: string[]): void {
  if (keys.length === 0) return;

  const context = securityContextStorage.getStore();
  const uniqueKeys = Array.from(new Set(keys));

  console.warn("[SECURITY] TENANT_OVERRIDE_ATTEMPT", {
    source,
    keys: uniqueKeys,
    userId: context?.userId ?? null,
    ip: context?.ip ?? null,
    at: new Date().toISOString(),
  });
}

export function setTenantSecurityContext(context: TenantSecurityContext): void {
  securityContextStorage.enterWith(context);
}

export function sanitizeTenantOverride<T>(input: T): T {
  const removed = removeTenantKeys(input);
  logTenantOverrideAttempt("body", removed);
  return input;
}

export function sanitizeTenantSearchParams(searchParams: URLSearchParams): URLSearchParams {
  const removed: string[] = [];
  const existingKeys = Array.from(searchParams.keys());
  for (const key of existingKeys) {
    if (!TENANT_OVERRIDE_KEYS.has(key)) continue;
    searchParams.delete(key);
    removed.push(key);
  }

  logTenantOverrideAttempt("query", removed);
  return searchParams;
}

export function installTenantOverrideGuards(): void {
  if (guardsInstalled) return;
  guardsInstalled = true;

  const originalJson = Request.prototype.json;
  Request.prototype.json = async function patchedJson(...args: []): Promise<unknown> {
    const parsed = await originalJson.apply(this, args);
    return sanitizeTenantOverride(parsed);
  };

  const originalGet = URLSearchParams.prototype.get;
  URLSearchParams.prototype.get = function patchedGet(name: string): string | null {
    if (TENANT_OVERRIDE_KEYS.has(name)) {
      sanitizeTenantSearchParams(this);
      return null;
    }
    return originalGet.call(this, name);
  };
}
