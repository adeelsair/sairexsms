"use client";

import { SessionProvider } from "next-auth/react";
import type { ReactNode } from "react";
import { Component } from "react";
import { usePathname } from "next/navigation";

class SessionProviderErrorBoundary extends Component<
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
    console.error("[AuthSessionProvider] failed, rendering without session context", error);
  }

  render() {
    if (this.state.hasError) {
      return <>{this.props.children}</>;
    }
    return this.props.children;
  }
}

export function AuthSessionProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isPublicRoute =
    pathname === "/" ||
    pathname.startsWith("/login") ||
    pathname.startsWith("/signup") ||
    pathname.startsWith("/forgot-password") ||
    pathname.startsWith("/reset-password") ||
    pathname.startsWith("/verify-email") ||
    pathname.startsWith("/join");

  if (isPublicRoute) {
    return <>{children}</>;
  }

  return (
    <SessionProviderErrorBoundary>
      <SessionProvider>{children}</SessionProvider>
    </SessionProviderErrorBoundary>
  );
}
