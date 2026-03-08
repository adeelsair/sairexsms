import {
  Building2,
  ChartColumnBig,
  CreditCard,
  GraduationCap,
  MessageSquareMore,
  School,
  UserRoundCheck,
} from "lucide-react";
import type { ComponentType } from "react";
import { landingContent, type LandingIconKey } from "./content";

const iconMap: Record<LandingIconKey, ComponentType<{ className?: string }>> = {
  graduationCap: GraduationCap,
  userRoundCheck: UserRoundCheck,
  creditCard: CreditCard,
  messageSquareMore: MessageSquareMore,
  chartColumnBig: ChartColumnBig,
  building2: Building2,
  school: School,
};

export function LandingFeatures() {
  return (
    <>
      <section id="schools" className="border-b border-border py-14">
        <div className="mx-auto w-full max-w-7xl px-4 md:px-6">
          <p className="mb-8 text-center text-sm font-medium text-muted-foreground">
            {landingContent.trust.title}
          </p>
          <div className="grid gap-4 md:grid-cols-3">
            {landingContent.trust.stats.map((item) => (
              <div key={item.label} className="rounded-xl border border-border bg-card p-6 text-center">
                <p className="text-3xl font-bold text-primary">{item.value}</p>
                <p className="mt-1 text-sm text-muted-foreground">{item.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-b border-border py-14">
        <div className="mx-auto grid w-full max-w-7xl gap-6 px-4 md:px-6 lg:grid-cols-2">
          <div className="rounded-2xl border border-border bg-card p-6">
            <h3 className="mb-4 text-xl font-semibold">{landingContent.problemSolution.problemTitle}</h3>
            <ul className="space-y-3 text-sm text-muted-foreground">
              {landingContent.problemSolution.problemPoints.map((point) => (
                <li key={point}>- {point}</li>
              ))}
            </ul>
          </div>
          <div className="rounded-2xl border border-primary/30 bg-primary/10 p-6">
            <h3 className="mb-4 text-xl font-semibold">{landingContent.problemSolution.solutionTitle}</h3>
            <ul className="space-y-3 text-sm text-foreground">
              {landingContent.problemSolution.solutionPoints.map((point) => (
                <li key={point}>- {point}</li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section id="features" className="border-b border-border py-14">
        <div className="mx-auto w-full max-w-7xl px-4 md:px-6">
          <div className="mb-8">
            <h2 className="text-2xl font-bold tracking-tight md:text-3xl">
              {landingContent.features.sectionTitle}
            </h2>
            <p className="mt-2 text-muted-foreground">
              {landingContent.features.sectionSubtitle}
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {landingContent.features.items.map((feature) => {
              const Icon = iconMap[feature.icon];
              return (
              <div key={feature.title} className="rounded-xl border border-border bg-card p-5">
                <Icon className="mb-3 h-5 w-5 text-primary" />
                <h3 className="text-base font-semibold">{feature.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{feature.description}</p>
              </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="border-b border-border py-14">
        <div className="mx-auto w-full max-w-7xl px-4 md:px-6">
          <div className="mb-8">
            <h2 className="text-2xl font-bold tracking-tight md:text-3xl">
              {landingContent.workflow.title}
            </h2>
            <p className="mt-2 text-muted-foreground">{landingContent.workflow.subtitle}</p>
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {landingContent.workflow.steps.map((step, idx) => (
              <div key={step} className="rounded-xl border border-border bg-card p-5">
                <p className="mb-2 text-xs font-semibold text-primary">STEP {idx + 1}</p>
                <p className="text-sm font-medium">{step}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-b border-border py-14">
        <div className="mx-auto w-full max-w-7xl px-4 md:px-6">
          <div className="mb-8">
            <h2 className="text-2xl font-bold tracking-tight md:text-3xl">{landingContent.screens.title}</h2>
            <p className="mt-2 text-muted-foreground">{landingContent.screens.subtitle}</p>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {landingContent.screens.items.map((screen) => (
              <ScreenCard key={screen.title} title={screen.title} subtitle={screen.subtitle} />
            ))}
          </div>
        </div>
      </section>
    </>
  );
}

function ScreenCard({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm font-semibold">{title}</p>
        <School className="h-4 w-4 text-primary" />
      </div>
      <div className="h-36 rounded-lg border border-border bg-muted/60" />
      <p className="mt-3 text-xs text-muted-foreground">{subtitle}</p>
    </div>
  );
}
