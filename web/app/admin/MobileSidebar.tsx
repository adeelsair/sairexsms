"use client";

import { useState } from "react";
import Image from "next/image";
import { Menu } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetDescription,
} from "@/components/ui/sheet";
import { SidebarNav } from "./SidebarNav";
import LogoutButton from "./LogoutButton";
import { SxButton } from "@/components/sx";
import type { NavGroup } from "@/lib/config/theme";
import { SIDEBAR_BOTTOM_COLOR } from "@/lib/theme/chrome-theme";

interface MobileSidebarProps {
  groups: NavGroup[];
  footerGroups: NavGroup[];
  userRole: string;
  tenantLogoUrl: string;
  tenantName: string;
}

export function MobileSidebar({
  groups,
  footerGroups,
  userRole,
  tenantLogoUrl,
  tenantName,
}: MobileSidebarProps) {
  const [open, setOpen] = useState(false);
  const shouldRoundSairexLogo = tenantLogoUrl.startsWith("/sairex-logo");

  return (
    <>
      {/* Hamburger trigger — visible only on mobile */}
      <SxButton
        sxVariant="ghost"
        onClick={() => setOpen(true)}
        className="inline-flex items-center justify-center rounded-lg p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground md:hidden"
        aria-label="Open navigation menu"
      >
        <Menu size={22} />
      </SxButton>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="left"
          className="w-72 bg-sidebar p-0 text-sidebar-foreground"
          showCloseButton={false}
        >
          {/* Brand */}
          <SheetHeader className="border-b border-sidebar-border px-6 py-5">
            <div className="w-full">
              <Image
                src={tenantLogoUrl}
                alt="Tenant logo"
                width={320}
                height={88}
                className={`h-auto w-full object-contain ${shouldRoundSairexLogo ? "rounded-md" : ""}`}
                priority
              />
            </div>
            <SheetDescription className="text-xs font-semibold" style={{ color: SIDEBAR_BOTTOM_COLOR }}>
              {userRole.replace("_", " ")} Console
            </SheetDescription>
            <p className="truncate text-xs text-sidebar-foreground/80" title={tenantName}>
              {tenantName}
            </p>
          </SheetHeader>

          {/* Navigation — close sheet on link click */}
          <nav
            className="sidebar-scrollbar flex-1 overflow-y-auto px-3 py-4"
            onClick={() => setOpen(false)}
          >
            <SidebarNav groups={groups} />
          </nav>

          {/* Footer */}
          <div className="space-y-1 border-t border-sidebar-border p-3">
            <div onClick={() => setOpen(false)}>
              <SidebarNav groups={footerGroups} />
            </div>
            <LogoutButton />
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
