import { type NextRequest, NextResponse } from "next/server";
import { SECURITY_HEADERS } from "@/lib/security";
import { readSessionTokenFromCookieHeader } from "@/lib/auth/session-cookie";

export default function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const sessionToken = readSessionTokenFromCookieHeader(
    request.headers.get("cookie"),
  );
  const isOnAdmin = pathname === "/admin" || pathname.startsWith("/admin/");
  const isOnOnboarding = pathname === "/onboarding" || pathname.startsWith("/onboarding/");
  if (!sessionToken && (isOnAdmin || isOnOnboarding)) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("callbackUrl", request.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  const isImpersonating = request.cookies.get("sx_impersonation")?.value === "1";
  if (isImpersonating) {
    const isBlockedPage =
      pathname === "/admin" ||
      pathname.startsWith("/admin/") ||
      pathname === "/superadmin" ||
      pathname.startsWith("/superadmin/") ||
      pathname === "/billing" ||
      pathname.startsWith("/billing/");
    const isBlockedApi =
      pathname === "/api/billing" ||
      pathname.startsWith("/api/billing/") ||
      (pathname.startsWith("/api/superadmin") &&
        pathname !== "/api/superadmin/exit-impersonation");

    if (isBlockedPage || isBlockedApi) {
      return new NextResponse("Forbidden during impersonation", { status: 403 });
    }
  }

  const response = NextResponse.next();

  for (const [header, value] of Object.entries(SECURITY_HEADERS)) {
    response.headers.set(header, value);
  }

  return response;
}

export const config = {
  // Apply auth guard + security headers to all app/API routes except static assets.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)"],
};
