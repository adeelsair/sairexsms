import Link from "next/link";
import { SxButton } from "@/components/sx";
import { landingContent } from "./content";
import { getLandingButtonThemeStyles } from "./button-theme";

export function LandingPricing() {
  const { topBarFilled, bottomBarFilled } = getLandingButtonThemeStyles();

  return (
    <>
      <section id="pricing" className="border-b border-border py-14">
        <div className="mx-auto w-full max-w-7xl px-4 md:px-6">
          <div className="mb-8">
            <h2 className="text-2xl font-bold tracking-tight md:text-3xl">{landingContent.pricing.title}</h2>
            <p className="mt-2 text-muted-foreground">{landingContent.pricing.subtitle}</p>
          </div>
          <div className="grid gap-4 lg:grid-cols-3">
            {landingContent.pricing.plans.map((plan, idx) => (
              <div
                key={plan.name}
                className={`rounded-2xl border p-6 ${
                  plan.highlighted
                    ? "border-primary bg-primary/10 shadow-sm"
                    : "border-border bg-card"
                }`}
              >
                <p className="text-lg font-semibold">{plan.name}</p>
                <p className="text-sm text-muted-foreground">{plan.subtitle}</p>
                <p className="mt-3 text-sm font-medium text-primary">{plan.students}</p>
                <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
                  {plan.points.map((point) => (
                    <li key={point}>- {point}</li>
                  ))}
                </ul>
                <div className="mt-6">
                  <SxButton
                    asChild
                    sxVariant="primary"
                    className="w-full transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
                    style={idx % 2 === 0 ? topBarFilled : bottomBarFilled}
                  >
                    <Link href={landingContent.pricing.trialHref}>
                      {landingContent.pricing.trialLabel}
                    </Link>
                  </SxButton>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-b border-border py-14">
        <div className="mx-auto w-full max-w-7xl px-4 md:px-6">
          <div className="mb-8">
            <h2 className="text-2xl font-bold tracking-tight md:text-3xl">
              {landingContent.testimonials.title}
            </h2>
            <p className="mt-2 text-muted-foreground">{landingContent.testimonials.subtitle}</p>
          </div>
          <div className="rounded-2xl border border-border bg-card p-6">
            <p className="text-base">&ldquo;{landingContent.testimonials.quote}&rdquo;</p>
            <p className="mt-3 text-sm text-muted-foreground">{landingContent.testimonials.author}</p>
          </div>
        </div>
      </section>

      <section id={landingContent.cta.sectionId} className="py-16">
        <div className="mx-auto w-full max-w-4xl rounded-2xl border border-border bg-card px-6 py-10 text-center md:px-10">
          <h2 className="text-3xl font-bold tracking-tight">{landingContent.cta.title}</h2>
          <p className="mx-auto mt-3 max-w-2xl text-muted-foreground">{landingContent.cta.subtitle}</p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <SxButton
              asChild
              sxVariant="primary"
              className="w-full transition-all duration-200 hover:-translate-y-0.5 hover:opacity-90 hover:shadow-md sm:w-auto"
              style={topBarFilled}
            >
              <Link href={landingContent.cta.primary.href}>{landingContent.cta.primary.label}</Link>
            </SxButton>
            <SxButton
              asChild
              sxVariant="primary"
              className="w-full transition-all duration-200 hover:-translate-y-0.5 hover:opacity-85 hover:shadow-sm sm:w-auto"
              style={bottomBarFilled}
            >
              <a href={landingContent.cta.secondary.href}>{landingContent.cta.secondary.label}</a>
            </SxButton>
          </div>
        </div>
      </section>
    </>
  );
}
