import { LandingFeatures } from "@/components/landing/features";
import { LandingFooter } from "@/components/landing/footer";
import { LandingHero } from "@/components/landing/hero";
import { LandingNavbar } from "@/components/landing/navbar";
import { LandingPricing } from "@/components/landing/pricing";

export default function Home() {
  return (
    <div
      id="landing-scroll-root"
      className="sidebar-scrollbar h-screen overflow-y-auto overflow-x-hidden bg-background text-foreground"
    >
      <LandingNavbar />
      <main>
        <LandingHero />
        <LandingFeatures />
        <LandingPricing />
      </main>
      <LandingFooter />
    </div>
  );
}

