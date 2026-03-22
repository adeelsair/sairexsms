"use client";

import Image from "next/image";
import { SairexMarketingBrandLink } from "@/components/sairex-marketing-brand-link";
import { brand } from "@/lib/config/theme";
import { getAdminChromeColors, SIDEBAR_MID_COLOR } from "@/lib/theme/chrome-theme";

/**
 * Shared shell for all onboarding flows.
 * Matches auth/landing: chrome header (logo + tagline), main with blur orbs, centered content, chrome footer.
 */
export function OnboardingShell({
  children,
  progressNode,
  maxWidth = "max-w-md",
}: {
  children: React.ReactNode;
  progressNode?: React.ReactNode;
  maxWidth?: "max-w-md" | "max-w-2xl" | "max-w-3xl";
}) {
  const { topBarBackgroundColor, topBarTextColor, bottomBarBackgroundColor, bottomBarTextColor } =
    getAdminChromeColors();

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background text-foreground">
      <header
        className="border-b px-4 py-3"
        style={{
          backgroundColor: topBarBackgroundColor,
          borderColor: SIDEBAR_MID_COLOR,
          color: topBarTextColor,
        }}
      >
        <div className="mx-auto flex w-full max-w-6xl items-center gap-4">
          <SairexMarketingBrandLink aria-label="Go to SairexSMS website" className="shrink-0">
            <Image
              src="/sairex-logo.png"
              alt="SairexSMS"
              width={224}
              height={58}
              className="h-10 w-auto rounded-md object-contain sm:h-11 md:h-14"
              priority
            />
          </SairexMarketingBrandLink>
          {progressNode ? (
            <div className="flex min-w-0 flex-1 items-center">
              <div className={maxWidth}>{progressNode}</div>
            </div>
          ) : null}
          <p className="hidden shrink-0 text-xs font-medium opacity-90 sm:block">{brand.tagline}</p>
        </div>
      </header>

      <div className="relative flex flex-1 overflow-y-auto overflow-x-hidden px-4 py-8">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -right-32 -top-28 h-72 w-72 rounded-full bg-primary/10 blur-3xl" />
          <div className="absolute -left-28 bottom-0 h-72 w-72 rounded-full bg-primary/5 blur-3xl" />
        </div>
        <div className={`relative mx-auto my-auto w-full ${maxWidth}`}>{children}</div>
      </div>

      <footer
        className="border-t px-4 py-2 text-center text-xs"
        style={{
          backgroundColor: bottomBarBackgroundColor,
          borderColor: SIDEBAR_MID_COLOR,
          color: bottomBarTextColor,
        }}
      >
        Powered by {brand.company}
      </footer>
    </div>
  );
}
