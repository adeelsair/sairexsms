"use client";

import { useEffect } from "react";
import {
  applyTenantTheme,
  type TenantThemeInput,
} from "@/lib/theme/applyTenantTheme";

export function TenantThemeProvider(props: {
  tenantTheme: TenantThemeInput | null;
  children: React.ReactNode;
}) {
  useEffect(() => {
    applyTenantTheme(props.tenantTheme);
  }, [props.tenantTheme]);

  return <>{props.children}</>;
}

