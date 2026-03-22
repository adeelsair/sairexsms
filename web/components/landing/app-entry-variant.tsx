import Link from "next/link";
import { SxButton } from "@/components/sx";
import { landingContent } from "./content";
import { getLandingButtonThemeStyles } from "./button-theme";

/**
 * App host `/` — variant of marketing landing: same hero language, gradient,
 * and button chrome; single focused screen.
 */
export function AppEntryVariant() {
  const { topBarFilled, bottomBarFilled } = getLandingButtonThemeStyles();
  const { appEntry, brand } = landingContent;
  const year = new Date().getFullYear();

  return (
    <main>
      <section className="relative min-h-[calc(100vh-4rem)] overflow-hidden border-b border-border">
        <div className="absolute inset-0 -z-10 bg-gradient-to-b from-primary/10 via-background to-background" />
        <div className="mx-auto flex w-full max-w-7xl flex-col items-center justify-center px-4 py-16 text-center md:px-6 md:py-24">
          <p className="inline-flex rounded-full border border-border bg-card px-3 py-1 text-xs font-semibold text-muted-foreground">
            {brand.versionLabel}
          </p>
          <h1 className="mt-6 max-w-2xl text-4xl font-bold tracking-tight md:text-5xl">
            {appEntry.title}
          </h1>
          <p className="mt-4 max-w-xl text-base text-muted-foreground md:text-lg">
            {appEntry.subtitle}
          </p>
          <div className="mt-10 flex w-full max-w-md flex-col gap-3 sm:flex-row sm:justify-center">
            <SxButton
              asChild
              sxVariant="primary"
              className="w-full transition-all duration-200 hover:-translate-y-0.5 hover:opacity-90 hover:shadow-md sm:w-auto sm:min-w-[10rem]"
              style={topBarFilled}
            >
              <Link href={appEntry.primaryCta.href}>{appEntry.primaryCta.label}</Link>
            </SxButton>
            <SxButton
              asChild
              sxVariant="primary"
              className="w-full transition-all duration-200 hover:-translate-y-0.5 hover:opacity-85 hover:shadow-sm sm:w-auto sm:min-w-[10rem]"
              style={bottomBarFilled}
            >
              <Link href={appEntry.secondaryCta.href}>{appEntry.secondaryCta.label}</Link>
            </SxButton>
          </div>
          <p className="mt-10 max-w-lg text-sm text-muted-foreground">{appEntry.audienceLine}</p>

          <div className="mt-14 w-full max-w-2xl rounded-2xl border border-border bg-card/80 p-6 text-left shadow-sm backdrop-blur-sm md:p-8">
            <p className="text-sm font-semibold text-foreground">Quick links</p>
            <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
              <li>
                <Link href="/login" className="text-primary underline-offset-4 hover:underline">
                  Forgot password?
                </Link>{" "}
                — reset from the login screen.
              </li>
              <li>
                New school? Use{" "}
                <Link href="/signup" className="text-primary underline-offset-4 hover:underline">
                  Start free trial
                </Link>{" "}
                to register.
              </li>
            </ul>
          </div>
        </div>
      </section>

      <footer className="border-t border-border py-6 text-center">
        <p className="text-xs text-muted-foreground">
          © {year} {brand.name} · {brand.versionLabel}
        </p>
      </footer>
    </main>
  );
}
