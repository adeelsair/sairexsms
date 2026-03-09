"use client";

import type { ReactNode } from "react";
import { Component } from "react";
import { usePathname } from "next/navigation";
import { AuthSessionProvider } from "@/components/session-provider";
import { AppQueryProvider } from "@/components/query-provider";
import { ThemeProvider } from "@/components/theme-provider";
import { TenantThemeProvider } from "@/components/tenant-theme-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import type { TenantThemeInput } from "@/lib/theme/applyTenantTheme";

class ProvidersErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean }
> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    console.error("[RootProviders] provider tree failed, using fallback", error);
  }

  render() {
    if (this.state.hasError) {
      return <>{this.props.children}</>;
    }
    return this.props.children;
  }
}

export function RootProviders({
  tenantTheme,
  children,
}: {
  tenantTheme: TenantThemeInput | null;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const isPublicRoute =
    pathname === "/" ||
    pathname.startsWith("/login") ||
    pathname.startsWith("/signup") ||
    pathname.startsWith("/forgot-password") ||
    pathname.startsWith("/reset-password") ||
    pathname.startsWith("/verify-email") ||
    pathname.startsWith("/join");

  const content = isPublicRoute ? (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem disableTransitionOnChange>
      <TooltipProvider delayDuration={300}>
        {children}
        <Toaster richColors position="top-right" />
      </TooltipProvider>
    </ThemeProvider>
  ) : (
    <AuthSessionProvider>
      <AppQueryProvider>
        <TenantThemeProvider tenantTheme={tenantTheme}>
          <ThemeProvider
            attribute="class"
            defaultTheme="light"
            enableSystem
            disableTransitionOnChange
          >
            <TooltipProvider delayDuration={300}>
              {children}
              <Toaster richColors position="top-right" />
            </TooltipProvider>
          </ThemeProvider>
        </TenantThemeProvider>
      </AppQueryProvider>
    </AuthSessionProvider>
  );

  return <ProvidersErrorBoundary>{content}</ProvidersErrorBoundary>;
}

