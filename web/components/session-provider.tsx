"use client";

import { SessionProvider } from "next-auth/react";
import type { ReactNode } from "react";
import { Component } from "react";

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
  return (
    <SessionProviderErrorBoundary>
      <SessionProvider>{children}</SessionProvider>
    </SessionProviderErrorBoundary>
  );
}
