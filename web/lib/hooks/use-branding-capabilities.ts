"use client";

import { useMemo } from "react";
import { usePlanUsage } from "@/lib/billing/use-plan-limit";

export function useBrandingCapabilities() {
  const { usage, loading, refresh } = usePlanUsage();

  return useMemo(() => {
    const branding = usage?.branding ?? {
      customLogo: false,
      customPrimaryColor: false,
      customLoginTheme: false,
      removePoweredBy: false,
    };

    return {
      plan: usage?.plan ?? "STARTER",
      branding,
      loading,
      refresh,
      canCustomizeLogo: branding.customLogo,
      canCustomizePrimaryColor: branding.customPrimaryColor,
      canCustomizeLoginTheme: branding.customLoginTheme,
      canRemovePoweredBy: branding.removePoweredBy,
    };
  }, [usage, loading, refresh]);
}

