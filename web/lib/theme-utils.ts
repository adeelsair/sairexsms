/**
 * Multi-tenant theme utilities
 *
 * Allows organizations to override default CSS variables at runtime.
 * This is the foundation for white-labeling / per-org branding.
 */

export interface OrganizationTheme {
  /** Tenant primary brand color (hex/css) */
  primaryColor?: string;
  /** Tenant accent color (hex/css) */
  accentColor?: string;
  /** Tenant primary foreground (future accessibility support) */
  primaryForeground?: string;
  /** Logo URL override */
  logoUrl?: string;
}

/**
 * Apply organization theme overrides to the document root.
 * Call this after loading org settings from the database.
 *
 * Usage:
 * ```ts
 * const orgTheme = await fetchOrgTheme(organizationId);
 * setCSSVariablesFromDB(orgTheme);
 * ```
 */
export function setCSSVariablesFromDB(theme: OrganizationTheme): void {
  if (typeof document === "undefined") return;

  const root = document.documentElement;

  root.style.setProperty(
    "--tenant-primary",
    theme.primaryColor || "var(--sx-primary)",
  );
  root.style.setProperty(
    "--tenant-accent",
    theme.accentColor || "var(--sx-accent)",
  );
  root.style.setProperty(
    "--tenant-primary-foreground",
    theme.primaryForeground || "var(--sx-primary-foreground)",
  );
}

/**
 * Remove all organization theme overrides, reverting to defaults.
 */
export function resetThemeOverrides(): void {
  if (typeof document === "undefined") return;

  const root = document.documentElement;
  const vars = ["--tenant-primary", "--tenant-accent", "--tenant-primary-foreground"];

  for (const v of vars) {
    root.style.removeProperty(v);
  }
}

/**
 * Convert a hex color to an OKLCH CSS value.
 * Useful when storing org colors as hex in the database
 * and needing to set them as OKLCH CSS variables.
 */
export function hexToOklchCss(hex: string): string {
  // Use CSS color-mix as a passthrough — modern browsers handle conversion
  return `oklch(from ${hex} l c h)`;
}
