export type TenantThemeInput = {
  primaryColor?: string | null;
  accentColor?: string | null;
  primaryForeground?: string | null;
  capabilities?: {
    customPrimaryColor?: boolean;
  } | null;
};

export function applyTenantTheme(tenant: TenantThemeInput | null | undefined) {
  if (typeof document === "undefined") return;

  const root = document.documentElement;
  const allowCustomPrimary = tenant?.capabilities?.customPrimaryColor ?? true;

  root.style.setProperty(
    "--tenant-primary",
    allowCustomPrimary ? (tenant?.primaryColor ?? "var(--sx-primary)") : "var(--sx-primary)",
  );
  root.style.setProperty(
    "--tenant-accent",
    allowCustomPrimary ? (tenant?.accentColor ?? "var(--sx-accent)") : "var(--sx-accent)",
  );
  root.style.setProperty(
    "--tenant-primary-foreground",
    tenant?.primaryForeground || "var(--sx-primary-foreground)",
  );
}

