"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Menu } from "lucide-react";
import { SairexMarketingBrandLink } from "@/components/sairex-marketing-brand-link";
import { SxButton } from "@/components/sx";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { getAdminChromeColors, SIDEBAR_MID_COLOR } from "@/lib/theme/chrome-theme";
import { landingContent } from "./content";
import { getLandingButtonThemeStyles } from "./button-theme";

export type LandingNavbarVariant = "marketing" | "app";

export function LandingNavbar({ variant = "marketing" }: { variant?: LandingNavbarVariant }) {
  const [scrolled, setScrolled] = useState(false);
  const [mounted, setMounted] = useState(false);
  const { topBarBackgroundColor, topBarTextColor, bottomBarBackgroundColor } = getAdminChromeColors();
  const { bottomBarFilled } = getLandingButtonThemeStyles();

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const scrollRoot = document.getElementById("landing-scroll-root");
    const onScroll = () => {
      const currentScroll = scrollRoot ? scrollRoot.scrollTop : window.scrollY;
      setScrolled(currentScroll > 12);
    };

    onScroll();
    if (scrollRoot) {
      scrollRoot.addEventListener("scroll", onScroll, { passive: true });
      return () => scrollRoot.removeEventListener("scroll", onScroll);
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`sticky top-0 z-50 overflow-x-hidden border-b transition-all ${
        scrolled ? "shadow-sm backdrop-blur supports-[backdrop-filter]:bg-background/0" : ""
      }`}
      style={{
        backgroundColor: topBarBackgroundColor,
        borderColor: SIDEBAR_MID_COLOR,
        color: topBarTextColor,
      }}
    >
      <nav className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between gap-3 px-4 md:px-6">
        <div className="flex items-center gap-4">
          <SairexMarketingBrandLink className="flex items-center gap-3">
            <Image
              src={landingContent.brand.logoSrc}
              alt={landingContent.brand.logoAlt}
              width={184}
              height={48}
              className="h-10 w-auto rounded-md object-contain sm:h-11 md:h-12"
              priority
            />
          </SairexMarketingBrandLink>
        </div>

        {variant === "marketing" ? (
          <div className="hidden items-center gap-6 md:flex">
            {landingContent.nav.items.map((item) => (
              <a
                key={item.label}
                href={item.href}
                className="text-sm opacity-80 transition-opacity hover:opacity-100"
              >
                {item.label}
              </a>
            ))}
          </div>
        ) : null}

        <div className="hidden items-center gap-2 md:flex">
          <SxButton
            asChild
            sxVariant="outline"
            className="transition-all duration-200 hover:-translate-y-0.5 hover:opacity-85 hover:shadow-sm"
            style={{
              color: bottomBarBackgroundColor,
              borderColor: "currentColor",
              backgroundColor: "transparent",
            }}
          >
            <Link href={landingContent.nav.actions.loginHref}>Login</Link>
          </SxButton>
          <SxButton
            asChild
            sxVariant="primary"
            className="transition-all duration-200 hover:-translate-y-0.5 hover:opacity-90 hover:shadow-md"
            style={bottomBarFilled}
          >
            <Link href={landingContent.nav.actions.signupHref}>
              {landingContent.nav.actions.signupLabel}
            </Link>
          </SxButton>
        </div>

        {mounted ? (
          <Sheet>
            <SheetTrigger asChild>
              <SxButton
                sxVariant="outline"
                className="px-2.5 md:hidden"
                style={{
                  color: topBarTextColor,
                  borderColor: "currentColor",
                  backgroundColor: "transparent",
                }}
                aria-label="Open navigation menu"
              >
                <Menu className="h-5 w-5" />
              </SxButton>
            </SheetTrigger>
            <SheetContent side="right" className="w-[85vw] border-border p-0 sm:max-w-sm">
              <SheetHeader className="border-b border-border p-4">
                <SheetTitle>Menu</SheetTitle>
                <SheetDescription>
                  {variant === "app"
                    ? "Sign in or create your school account."
                    : "Navigate SairexSMS and start your free trial."}
                </SheetDescription>
              </SheetHeader>

              {variant === "marketing" ? (
                <div className="space-y-1 p-4">
                  {landingContent.nav.items.map((item) => (
                    <SheetClose key={item.label} asChild>
                      <a
                        href={item.href}
                        className="block rounded-md px-3 py-2 text-sm font-medium text-foreground hover:bg-muted"
                      >
                        {item.label}
                      </a>
                    </SheetClose>
                  ))}
                </div>
              ) : null}

              <div className="mt-auto space-y-3 border-t border-border p-4">
                <SheetClose asChild>
                  <SxButton
                    asChild
                    sxVariant="outline"
                    className="w-full"
                    style={{
                      color: bottomBarBackgroundColor,
                      borderColor: "currentColor",
                      backgroundColor: "transparent",
                    }}
                  >
                    <Link href={landingContent.nav.actions.loginHref}>Login</Link>
                  </SxButton>
                </SheetClose>
                <SheetClose asChild>
                  <SxButton asChild sxVariant="primary" className="w-full" style={bottomBarFilled}>
                    <Link href={landingContent.nav.actions.signupHref}>
                      {landingContent.nav.actions.signupLabel}
                    </Link>
                  </SxButton>
                </SheetClose>
              </div>
            </SheetContent>
          </Sheet>
        ) : (
          <SxButton
            sxVariant="outline"
            className="px-2.5 md:hidden"
            style={{
              color: topBarTextColor,
              borderColor: "currentColor",
              backgroundColor: "transparent",
            }}
            aria-label="Open navigation menu"
            disabled
          >
            <Menu className="h-5 w-5" />
          </SxButton>
        )}
      </nav>
    </header>
  );
}
