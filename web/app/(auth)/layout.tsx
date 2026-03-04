import { brand } from "@/lib/config/theme";

/**
 * Shared layout for all authentication pages.
 * Provides the dark gradient background, SAIREX branding, and centered card.
 */
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 py-12">
      {/* Background glow */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -right-40 -top-40 h-80 w-80 rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 h-80 w-80 rounded-full bg-primary/5 blur-3xl" />
      </div>

      <div className="relative mx-4 w-full max-w-md">
        {/* Brand header */}
        <div className="mb-8 text-center">
          <h1 className="text-4xl font-bold tracking-tight text-white">
            SAIREX <span className="text-primary">SMS</span>
          </h1>
          <p className="mt-2 text-sm text-slate-400">{brand.tagline}</p>
        </div>

        {/* Page content (cards) */}
        {children}

        {/* Footer */}
        <p className="mt-6 text-center text-xs text-slate-500">
          Powered by {brand.company}
        </p>
      </div>
    </div>
  );
}
