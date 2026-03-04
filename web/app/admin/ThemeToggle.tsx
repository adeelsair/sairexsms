"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { Sun, Moon, Monitor } from "lucide-react";
import { cn } from "@/lib/utils";
import { SxButton } from "@/components/sx";

/* ── Mode definitions ─────────────────────────────────────── */

const modes = [
  { value: "light", icon: Sun, label: "Light" },
  { value: "dark", icon: Moon, label: "Dark" },
  { value: "system", icon: Monitor, label: "System" },
] as const;

/* ── Component ────────────────────────────────────────────── */

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  if (!mounted) {
    return (
      <div className="flex items-center gap-0.5 rounded-lg bg-sidebar-accent/50 p-1">
        <div className="h-7 w-full animate-pulse rounded-md bg-sidebar-accent" />
      </div>
    );
  }

  return (
    <div className="flex items-center gap-0.5 rounded-lg bg-sidebar-accent/50 p-1">
      {modes.map(({ value, icon: Icon, label }) => {
        const isActive = theme === value;

        return (
          <SxButton
            key={value}
            sxVariant="ghost"
            onClick={() => setTheme(value)}
            aria-label={`Switch to ${label} theme`}
            aria-pressed={isActive}
            className={cn(
              "h-7 flex-1 gap-1.5 rounded-md px-2 text-xs font-medium transition-all",
              isActive
                ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-sm hover:bg-sidebar-primary/90"
                : "text-sidebar-foreground/50 hover:bg-sidebar-accent hover:text-sidebar-foreground",
            )}
          >
            <Icon size={14} />
            {label}
          </SxButton>
        );
      })}
    </div>
  );
}
