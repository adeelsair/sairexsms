import Link from "next/link";
import type { ComponentType } from "react";
import {
  Building2,
  ChartColumnBig,
  CreditCard,
  GraduationCap,
  MessageSquareMore,
  School,
  UserRoundCheck,
} from "lucide-react";
import { SxButton } from "@/components/sx";
import { landingContent, type LandingIconKey } from "./content";
import { getLandingButtonThemeStyles } from "./button-theme";

const iconMap: Record<LandingIconKey, ComponentType<{ className?: string }>> = {
  graduationCap: GraduationCap,
  userRoundCheck: UserRoundCheck,
  creditCard: CreditCard,
  messageSquareMore: MessageSquareMore,
  chartColumnBig: ChartColumnBig,
  building2: Building2,
  school: School,
};

export function LandingHero() {
  const { topBarFilled, bottomBarFilled } = getLandingButtonThemeStyles();

  return (
    <section className="relative overflow-hidden border-b border-border">
      <div className="absolute inset-0 -z-10 bg-gradient-to-b from-primary/10 via-background to-background" />
      <div className="mx-auto grid w-full max-w-7xl gap-10 px-4 py-16 md:px-6 lg:grid-cols-2 lg:items-center lg:py-24">
        <div className="space-y-6">
          <p className="inline-flex rounded-full border border-border bg-card px-3 py-1 text-xs font-semibold text-muted-foreground">
            {landingContent.brand.versionLabel}
          </p>
          <h1 className="text-4xl font-bold tracking-tight md:text-5xl">
            {landingContent.hero.title}
          </h1>
          <p className="max-w-xl text-base text-muted-foreground md:text-lg">
            {landingContent.hero.subtitle}
          </p>
          <div className="flex flex-wrap gap-3">
            <SxButton
              asChild
              sxVariant="primary"
              className="w-full transition-all duration-200 hover:-translate-y-0.5 hover:opacity-90 hover:shadow-md sm:w-auto"
              style={topBarFilled}
            >
              <Link href={landingContent.hero.primaryCta.href}>
                {landingContent.hero.primaryCta.label}
              </Link>
            </SxButton>
            <SxButton
              asChild
              sxVariant="primary"
              className="w-full transition-all duration-200 hover:-translate-y-0.5 hover:opacity-85 hover:shadow-sm sm:w-auto"
              style={bottomBarFilled}
            >
              <a href={landingContent.hero.secondaryCta.href}>
                {landingContent.hero.secondaryCta.label}
              </a>
            </SxButton>
          </div>
          <p className="text-sm text-muted-foreground">
            {landingContent.hero.audienceLine}
          </p>
        </div>

        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-sm font-semibold">{landingContent.hero.previewTitle}</h3>
            <span className="rounded bg-primary/15 px-2 py-0.5 text-xs font-medium text-primary">
              {landingContent.hero.previewBadge}
            </span>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {landingContent.hero.previewCards.map((card) => (
              <PreviewCard
                key={card.title}
                icon={iconMap[card.icon]}
                title={card.title}
                meta={card.meta}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function PreviewCard({
  icon: Icon,
  title,
  meta,
}: {
  icon: ComponentType<{ className?: string }>;
  title: string;
  meta: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-background p-4">
      <Icon className="mb-2 h-4 w-4 text-primary" />
      <p className="text-sm font-semibold">{title}</p>
      <p className="text-xs text-muted-foreground">{meta}</p>
    </div>
  );
}
