import type { ReactNode } from "react";

import { MobileBottomNavLayout } from "@/components/mobile/mobile-bottom-nav-layout";

type MobileLayoutProps = {
  children: ReactNode;
};

export default function MobileLayout({ children }: MobileLayoutProps) {
  return <MobileBottomNavLayout>{children}</MobileBottomNavLayout>;
}
