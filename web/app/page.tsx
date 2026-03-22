import type { Metadata } from "next";
import { headers } from "next/headers";
import { AppEntryVariant } from "@/components/landing/app-entry-variant";
import { landingContent } from "@/components/landing/content";
import { LandingFeatures } from "@/components/landing/features";
import { LandingFooter } from "@/components/landing/footer";
import { LandingHero } from "@/components/landing/hero";
import { LandingNavbar } from "@/components/landing/navbar";
import { LandingPricing } from "@/components/landing/pricing";
import { hostnameFromHeaders, isAppEntryHost } from "@/lib/landing-host";

export async function generateMetadata(): Promise<Metadata> {
  const host = hostnameFromHeaders(await headers());
  if (isAppEntryHost(host)) {
    return {
      title: `${landingContent.brand.name} — Sign in`,
      description: landingContent.appEntry.subtitle,
    };
  }
  return {
    title: `${landingContent.brand.name} — ${landingContent.hero.title}`,
    description: landingContent.hero.subtitle,
  };
}

function MarketingHome() {
  return (
    <div
      id="landing-scroll-root"
      className="sidebar-scrollbar h-screen overflow-y-auto overflow-x-hidden bg-background text-foreground"
    >
      <LandingNavbar variant="marketing" />
      <main>
        <LandingHero />
        <LandingFeatures />
        <LandingPricing />
      </main>
      <LandingFooter />
    </div>
  );
}

function AppEntryHome() {
  return (
    <div
      id="landing-scroll-root"
      className="sidebar-scrollbar min-h-screen overflow-x-hidden bg-background text-foreground"
    >
      <LandingNavbar variant="app" />
      <AppEntryVariant />
    </div>
  );
}

export default async function Home() {
  const host = hostnameFromHeaders(await headers());
  if (isAppEntryHost(host)) {
    return <AppEntryHome />;
  }
  return <MarketingHome />;
}
