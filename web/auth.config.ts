import type { NextAuthConfig } from "next-auth";

/**
 * Edge-compatible auth config (no Prisma / Node.js imports).
 * Used by proxy.ts for route protection.
 */
export const authConfig = {
  pages: {
    signIn: "/login",
  },
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const isOnAdmin = nextUrl.pathname.startsWith("/admin");
      const isOnOnboarding = nextUrl.pathname.startsWith("/onboarding");

      if (isOnAdmin || isOnOnboarding) {
        return isLoggedIn;
      }

      return true;
    },
  },
  providers: [],
} satisfies NextAuthConfig;
