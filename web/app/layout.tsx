import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { AuthSessionProvider } from "@/components/session-provider";
import { AppQueryProvider } from "@/components/query-provider";
import { ThemeProvider } from "@/components/theme-provider";
import { TenantThemeProvider } from "@/components/tenant-theme-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import { resolveOrganizationBrandingCapabilities } from "@/lib/billing/branding-capabilities.service";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "SairexSMS",
  description: "Smart Management System — Enterprise ERP",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  let organizationId: string | null = null;
  let branding: Awaited<ReturnType<typeof resolveOrganizationBrandingCapabilities>> | null = null;
  let resolvedTheme: { primaryColor: string | null; accentColor: string | null } | null = null;

  try {
    const session = await auth();
    const user = session?.user as { organizationId?: string | null } | undefined;
    organizationId = user?.organizationId ?? null;

    if (organizationId) {
      try {
        branding = await resolveOrganizationBrandingCapabilities(organizationId);
      } catch {
        branding = null;
      }

      try {
        resolvedTheme = await prisma.organization.findUnique({
          where: { id: organizationId },
          select: {
            primaryColor: true,
            accentColor: true,
          },
        });
      } catch {
        resolvedTheme = null;
      }
    }
  } catch {
    organizationId = null;
    branding = null;
    resolvedTheme = null;
  }
  const canUseCustomPrimary = branding?.capabilities.customPrimaryColor ?? false;
  const initialPrimary = canUseCustomPrimary
    ? (resolvedTheme?.primaryColor ?? "#1D4E89")
    : "#1D4E89";
  const initialAccent = canUseCustomPrimary
    ? (resolvedTheme?.accentColor ?? "#39B54A")
    : "#39B54A";
  const initialPrimaryForeground = "#FFFFFF";

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <style
          // Pre-inject tenant colors to avoid first-paint flicker.
          dangerouslySetInnerHTML={{
            __html: `:root{--tenant-primary:${initialPrimary};--tenant-accent:${initialAccent};--tenant-primary-foreground:${initialPrimaryForeground};}`,
          }}
        />
      </head>
      <body
        className={`${inter.variable} ${jetbrainsMono.variable} min-h-screen bg-background font-sans text-foreground antialiased`}
        suppressHydrationWarning
      >
        <AuthSessionProvider>
          <AppQueryProvider>
            <TenantThemeProvider
              tenantTheme={
                resolvedTheme
                  ? {
                      ...resolvedTheme,
                      capabilities: { customPrimaryColor: canUseCustomPrimary },
                    }
                  : null
              }
            >
              <ThemeProvider
                attribute="class"
                defaultTheme="light"
                enableSystem
                disableTransitionOnChange
              >
                <TooltipProvider delayDuration={300}>
                  {children}
                  <Toaster richColors position="top-right" />
                </TooltipProvider>
              </ThemeProvider>
            </TenantThemeProvider>
          </AppQueryProvider>
        </AuthSessionProvider>
      </body>
    </html>
  );
}
