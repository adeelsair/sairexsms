import type { ReactNode } from "react";

import { MobileBottomNavLayout } from "@/components/mobile/mobile-bottom-nav-layout";

type MobileGroupLayoutProps = {
  children: ReactNode;
};

export default function MobileGroupLayout({ children }: MobileGroupLayoutProps) {
  return <MobileBottomNavLayout>{children}</MobileBottomNavLayout>;
}
