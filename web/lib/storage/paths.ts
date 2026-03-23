/**
 * Multi-tenant object key layout (S3-compatible).
 *
 *   tenants/{tenantId}/uploads/...
 *   tenants/{tenantId}/invoices/...
 *   tenants/{tenantId}/exports/...
 *   tenants/{tenantId}/certificates/...
 *   tenants/{tenantId}/branding/...
 *
 * `tenantId` is the Organization id (e.g. cuid).
 */
export type StorageCategory = "uploads" | "invoices" | "exports" | "certificates" | "branding";

export function tenantObjectKey(
  tenantId: string,
  category: StorageCategory,
  ...pathSegments: string[]
): string {
  const safeTenant = tenantId.replace(/^\/+|\/+$/g, "");
  const rest = pathSegments
    .map((s) => s.replace(/^\/+|\/+$/g, ""))
    .filter(Boolean)
    .join("/");
  return rest ? `tenants/${safeTenant}/${category}/${rest}` : `tenants/${safeTenant}/${category}`;
}

/** Pre-tenant onboarding assets (no org id yet). */
export function onboardingUserBrandingPrefix(userId: string): string {
  const id = userId.replace(/^\/+|\/+$/g, "");
  return `onboarding/users/${id}/branding`;
}
