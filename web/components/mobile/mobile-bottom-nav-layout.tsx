"use client";

import type { ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";

import { cn } from "@/lib/utils";

type MobileBottomNavLayoutProps = {
  children: ReactNode;
};

type NavItem = {
  href: string;
  icon: string;
  label: string;
};

const NAV_ITEMS: NavItem[] = [
  { href: "/mobile/dashboard", icon: "🏠", label: "Dashboard" },
  { href: "/mobile/insights", icon: "📊", label: "Insights" },
  { href: "/mobile/profile", icon: "👤", label: "Profile" },
];

export function MobileBottomNavLayout({ children }: MobileBottomNavLayoutProps) {
  const router = useRouter();
  const pathname = usePathname();

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <main className="flex-1">{children}</main>

      <nav className="sticky bottom-0 z-30 border-t border-border bg-background/95 backdrop-blur">
        <div className="flex items-center">
          {NAV_ITEMS.map((item) => {
            const isActive = pathname === item.href;
            return (
              <button
                key={item.href}
                type="button"
                aria-label={item.label}
                onClick={() => router.push(item.href)}
                className={cn(
                  "flex flex-1 flex-col items-center gap-1 py-3 text-xs transition",
                  isActive ? "text-primary" : "text-muted-foreground",
                )}
              >
                <span className="text-base leading-none">{item.icon}</span>
                <span className={cn(isActive ? "font-semibold" : "font-medium")}>
                  {item.label}
                </span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
