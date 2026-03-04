"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { SxButton } from "@/components/sx";
import { SidebarNav } from "./SidebarNav";
import type { NavGroup } from "@/lib/config/theme";

interface SidebarScrollNavProps {
  groups: NavGroup[];
}

export function SidebarScrollNav({ groups }: SidebarScrollNavProps) {
  const navRef = useRef<HTMLElement | null>(null);
  const [canScrollUp, setCanScrollUp] = useState(false);
  const [canScrollDown, setCanScrollDown] = useState(false);

  const scrollStep = 96;

  const scrollByAmount = (amount: number) => {
    const navElement = navRef.current;
    if (!navElement) return;
    navElement.scrollBy({ top: amount, behavior: "smooth" });
  };

  useEffect(() => {
    const navElement = navRef.current;
    if (!navElement) return;

    const updateScrollIndicators = () => {
      const atTop = navElement.scrollTop <= 1;
      const atBottom =
        navElement.scrollTop + navElement.clientHeight >= navElement.scrollHeight - 1;

      setCanScrollUp(!atTop);
      setCanScrollDown(!atBottom);
    };

    updateScrollIndicators();
    navElement.addEventListener("scroll", updateScrollIndicators, { passive: true });
    window.addEventListener("resize", updateScrollIndicators);

    return () => {
      navElement.removeEventListener("scroll", updateScrollIndicators);
      window.removeEventListener("resize", updateScrollIndicators);
    };
  }, [groups]);

  return (
    <>
      <div
        className={cn(
          "flex justify-center border-b border-sidebar-border/90 bg-gradient-to-b from-black/25 to-transparent px-3 pt-2 text-sidebar-foreground/90 drop-shadow-[0_0_6px_rgba(255,255,255,0.18)] transition-opacity",
          canScrollUp ? "opacity-100" : "opacity-0",
        )}
      >
        <SxButton
          sxVariant="ghost"
          className="h-6 px-2 text-sidebar-foreground/90 hover:bg-sidebar-accent/40"
          disabled={!canScrollUp}
          aria-label="Scroll navigation up"
          onClick={() => scrollByAmount(-scrollStep)}
        >
          <ChevronUp size={18} strokeWidth={2.5} />
        </SxButton>
      </div>
      <nav ref={navRef} className="sidebar-scrollbar flex-1 overflow-y-auto px-3 py-2">
        <SidebarNav groups={groups} />
      </nav>
      <div
        className={cn(
          "flex justify-center border-t border-sidebar-border/90 bg-gradient-to-t from-black/25 to-transparent px-3 pb-2 text-sidebar-foreground/90 drop-shadow-[0_0_6px_rgba(255,255,255,0.18)] transition-opacity",
          canScrollDown ? "opacity-100" : "opacity-0",
        )}
      >
        <SxButton
          sxVariant="ghost"
          className="h-6 px-2 text-sidebar-foreground/90 hover:bg-sidebar-accent/40"
          disabled={!canScrollDown}
          aria-label="Scroll navigation down"
          onClick={() => scrollByAmount(scrollStep)}
        >
          <ChevronDown size={18} strokeWidth={2.5} />
        </SxButton>
      </div>
    </>
  );
}
