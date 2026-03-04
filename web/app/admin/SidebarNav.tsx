"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useRef, type KeyboardEvent } from "react";
import { cn } from "@/lib/utils";
import type { NavGroup } from "@/lib/config/theme";
import {
  LayoutDashboard,
  Building2,
  Map,
  School,
  CalendarRange,
  Layers,
  ClipboardCheck,
  ClipboardList,
  GraduationCap,
  HandCoins,
  Wallet,
  CalendarClock,
  Users,
  KeyRound,
  ScrollText,
  Activity,
  Wrench,
  BarChart3,
  Settings,
} from "lucide-react";

const ICON_MAP: Record<string, React.ComponentType<{ size?: number }>> = {
  LayoutDashboard,
  Building2,
  Map,
  School,
  CalendarRange,
  Layers,
  ClipboardCheck,
  ClipboardList,
  GraduationCap,
  HandCoins,
  Wallet,
  CalendarClock,
  Users,
  KeyRound,
  ScrollText,
  Activity,
  Wrench,
  BarChart3,
  Settings,
};

interface SidebarNavProps {
  groups: NavGroup[];
}

export function SidebarNav({ groups }: SidebarNavProps) {
  const pathname = usePathname();
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement | null>(null);

  const handleKeyDownCapture = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;

    const container = containerRef.current;
    if (!container) return;

    const links = Array.from(
      container.querySelectorAll<HTMLAnchorElement>('a[href]'),
    );
    if (links.length === 0) return;

    const eventTarget = event.target as HTMLElement | null;
    const currentLink = eventTarget?.closest("a[href]") as HTMLAnchorElement | null;
    const activeIndex = currentLink ? links.findIndex((link) => link === currentLink) : -1;
    if (activeIndex === -1) return;

    event.preventDefault();

    const nextIndex =
      event.key === "ArrowDown"
        ? Math.min(activeIndex + 1, links.length - 1)
        : Math.max(activeIndex - 1, 0);

    const nextLink = links[nextIndex];
    if (!nextLink) return;

    nextLink.focus();
    const href = nextLink.getAttribute("href");
    if (href) {
      router.push(href);
    }
  };

  return (
    <div
      ref={containerRef}
      onKeyDownCapture={handleKeyDownCapture}
      className="space-y-4"
    >
      {groups.map((group, gi) => (
        <div key={gi}>
          {group.label && (
            <p className="mb-2 px-3 text-sm font-semibold uppercase tracking-wider underline decoration-2 underline-offset-4 text-sidebar-foreground/70">
              {group.label}
            </p>
          )}

          <div className="space-y-0.5">
            {group.items.map((item) => {
              const Icon = ICON_MAP[item.icon];
              const isActive =
                pathname === item.href ||
                (item.href !== "/admin/dashboard" &&
                  pathname.startsWith(item.href));

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors",
                    isActive
                      ? "bg-sidebar-accent/40 font-semibold text-sidebar-foreground ring-1 ring-white/25 shadow-[0_0_12px_rgba(255,255,255,0.18)]"
                      : "text-sidebar-foreground/80 hover:bg-sidebar-accent/40 hover:text-sidebar-foreground hover:ring-1 hover:ring-white/25 hover:shadow-[0_0_12px_rgba(255,255,255,0.18)]",
                  )}
                >
                  {Icon && <Icon size={18} />}
                  {item.label}
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
