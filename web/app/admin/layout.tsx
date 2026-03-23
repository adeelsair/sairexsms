import { auth } from "@/auth";
import { redirect } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { SairexMarketingBrandLink } from "@/components/sairex-marketing-brand-link";
import { navigation } from "@/lib/config/theme";
import { isSimpleMode, resolveOrganizationMode } from "@/lib/system/mode.service";
import { prisma } from "@/lib/prisma";
import { SystemSidebar } from "@/components/layout/system-sidebar";
import { resolveOrganizationBrandingCapabilities } from "@/lib/billing/branding-capabilities.service";
import {
  SIDEBAR_MID_COLOR,
  SIDEBAR_BOTTOM_COLOR,
  ADMIN_TOP_BAR_PADDING_Y_PX,
  getAdminChromeColors,
} from "@/lib/theme/chrome-theme";
import { SidebarNav } from "./SidebarNav";
import LogoutButton from "./LogoutButton";
import { MobileSidebar } from "./MobileSidebar";
import { SidebarScrollNav } from "./SidebarScrollNav";
import packageJson from "../../package.json";

const FOOTER_NAV_GROUPS = [
  {
    label: "",
    items: [
      {
        label: "Settings",
        href: "/admin/settings",
        icon: "Settings",
      },
    ],
  },
];

function normalizeExternalUrl(value?: string | null): string | null {
  const raw = value?.trim();
  if (!raw) return null;
  if (raw.startsWith("http://") || raw.startsWith("https://")) return raw;
  return `https://${raw}`;
}

type OrgBrandingRow = {
  logoUrl: string | null;
  displayName: string | null;
  organizationName: string | null;
  websiteUrl: string | null;
  facebookUrl?: string | null;
  instagramUrl?: string | null;
};

async function loadOrganizationBrandingForLayout(
  organizationId: string,
): Promise<OrgBrandingRow | null> {
  try {
    return await prisma.organization.findUnique({
      where: { id: organizationId },
      select: {
        logoUrl: true,
        displayName: true,
        organizationName: true,
        websiteUrl: true,
        facebookUrl: true,
        instagramUrl: true,
      },
    });
  } catch {
    // Prod DB may not have migrated social columns yet (schema/DB drift).
    return await prisma.organization.findUnique({
      where: { id: organizationId },
      select: {
        logoUrl: true,
        displayName: true,
        organizationName: true,
        websiteUrl: true,
      },
    });
  }
}

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const user = session.user as {
    email?: string | null;
    role?: string;
    platformRole?: string | null;
    organizationId?: string | null;
    campusId?: number | null;
  };

  // Redirect to onboarding if user has no org and isn't a platform admin
  if (!user.organizationId && !user.platformRole) {
    redirect("/onboarding/identity");
  }

  const userEmail = user.email || "";
  const displayRole = user.platformRole || user.role;
  const userRole = displayRole?.replace("_", " ") || "Admin";
  const orgMode = user.organizationId
    ? await resolveOrganizationMode(user.organizationId)
    : { mode: "PRO" as const, isSimple: false };

  // Sidebar brand should always use the SAIREX SMS logo.
  const sidebarLogoUrl = "/sairex-logo.png";
  const shouldRoundSairexLogo = true;

  const organizationBranding = user.organizationId
    ? await loadOrganizationBrandingForLayout(user.organizationId)
    : null;
  // Top-bar right logo should use the organization's logo when available,
  // otherwise fall back to the SAIREX SMS logo.
  const topBarLogoUrl = organizationBranding?.logoUrl || "/sairex-logo.png";
  const shouldRoundTopBarLogo = topBarLogoUrl.startsWith("/sairex-logo");
  const websiteUrl = normalizeExternalUrl(organizationBranding?.websiteUrl);
  const facebookUrl = normalizeExternalUrl(organizationBranding?.facebookUrl);
  const instagramUrl = normalizeExternalUrl(organizationBranding?.instagramUrl);

  const tenantName =
    organizationBranding?.displayName?.trim() ||
    organizationBranding?.organizationName?.trim() ||
    "SAIREX SMS";
  const campusName = user.organizationId && user.campusId
    ? (await prisma.campus.findFirst({
        where: {
          id: user.campusId,
          organizationId: user.organizationId,
        },
        select: { name: true },
      }))?.name ?? "All Campuses"
    : user.organizationId
      ? "All Campuses"
      : "Global";
  const simpleMode = isSimpleMode(orgMode.mode);
  const isSuperAdmin = user.platformRole === "SUPER_ADMIN" || user.role === "SUPER_ADMIN";
  const filteredNavigation = simpleMode
    ? navigation
        .map((group) => ({
          ...group,
          items: group.items.filter((item) => isSuperAdmin || !item.proOnly),
        }))
        .filter((group) => group.items.length > 0)
    : navigation;

  const {
    topBarBackgroundColor,
    bottomBarBackgroundColor,
    topBarTextColor,
    bottomBarTextColor,
  } = getAdminChromeColors();

  const appVersion = `v${packageJson.version}`;

  return (
    <div className="flex h-screen flex-col md:flex-row">
      {/* ── Mobile top bar ──────────────────────────────────── */}
      <header className="flex items-center justify-between border-b border-sidebar-border bg-sidebar px-4 py-3 md:hidden">
        <div className="flex items-center">
          <SairexMarketingBrandLink>
            <Image
              src={sidebarLogoUrl}
              alt="SairexSMS"
              width={168}
              height={44}
              className={`h-11 w-auto object-contain ${shouldRoundSairexLogo ? "rounded-md" : ""}`}
              priority
            />
          </SairexMarketingBrandLink>
        </div>
        <MobileSidebar
          groups={filteredNavigation}
          footerGroups={FOOTER_NAV_GROUPS}
          userRole={userRole}
          tenantLogoUrl={sidebarLogoUrl}
          tenantName={tenantName}
        />
      </header>

      {/* ── Desktop sidebar ─────────────────────────────────── */}
      <SystemSidebar className="hidden w-64 flex-col border-r border-sidebar-border md:flex">
        {/* Brand */}
        <div className="border-b border-sidebar-border px-6 py-5">
          <div className="mb-2 w-full">
            <SairexMarketingBrandLink className="block w-full">
              <Image
                src={sidebarLogoUrl}
                alt="SairexSMS"
                width={320}
                height={88}
                className={`h-auto w-full object-contain ${shouldRoundSairexLogo ? "rounded-md" : ""}`}
                priority
              />
            </SairexMarketingBrandLink>
          </div>
          <p className="mt-0.5 text-xs font-semibold" style={{ color: SIDEBAR_BOTTOM_COLOR }}>
            {userRole} Console
          </p>
          <p className="mt-1 truncate text-xs text-sidebar-foreground/80" title={tenantName}>
            {tenantName}
          </p>
        </div>

        {/* Navigation */}
        <SidebarScrollNav groups={filteredNavigation} />

        {/* Footer: user info + actions */}
        <div className="space-y-1 border-t border-sidebar-border p-3">
          <SidebarNav groups={FOOTER_NAV_GROUPS} />
          <LogoutButton />
        </div>
      </SystemSidebar>

      <div className="flex min-h-0 flex-1 flex-col">
        <div
          className="border-b px-4 md:px-6"
          style={{
            backgroundColor: topBarBackgroundColor,
            borderColor: SIDEBAR_MID_COLOR,
            color: topBarTextColor,
            paddingTop: `${ADMIN_TOP_BAR_PADDING_Y_PX}px`,
            paddingBottom: `${ADMIN_TOP_BAR_PADDING_Y_PX}px`,
          }}
        >
          <div className="grid grid-cols-3 items-center gap-2">
            <p className="truncate text-xs md:text-sm">
              Organization: <span className="font-semibold">{tenantName}</span>
            </p>
            <p className="truncate text-center text-xs md:text-sm">
              Campus: <span className="font-semibold">{campusName}</span>
            </p>
            <div className="flex items-center justify-end gap-2">
              {websiteUrl ? (
                <Link
                  href={websiteUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Open website"
                  title="Website"
                  className="inline-flex h-8 w-8 items-center justify-center text-current transition-opacity hover:opacity-85"
                >
                  <Image
                    src="/social-icons/world.png"
                    alt="Website"
                    width={24}
                    height={24}
                    className="h-6 w-6"
                    unoptimized
                  />
                </Link>
              ) : null}
              {facebookUrl ? (
                <Link
                  href={facebookUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Open Facebook"
                  title="Facebook"
                  className="inline-flex h-8 w-8 items-center justify-center transition-opacity hover:opacity-85"
                >
                  <Image
                    src="/social-icons/facebook.png"
                    alt="Facebook"
                    width={20}
                    height={20}
                    className="h-5 w-5"
                    unoptimized
                  />
                </Link>
              ) : null}
              {instagramUrl ? (
                <Link
                  href={instagramUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Open Instagram"
                  title="Instagram"
                  className="inline-flex h-8 w-8 items-center justify-center transition-opacity hover:opacity-85"
                >
                  <Image
                    src="/social-icons/instagram.png"
                    alt="Instagram"
                    width={20}
                    height={20}
                    className="h-5 w-5"
                    unoptimized
                  />
                </Link>
              ) : null}
              {topBarLogoUrl.startsWith("/sairex-logo") ? (
                <SairexMarketingBrandLink>
                  <Image
                    src={topBarLogoUrl}
                    alt="SairexSMS"
                    width={128}
                    height={32}
                    className={`h-8 w-auto object-contain ${
                      shouldRoundTopBarLogo ? "rounded-md" : ""
                    }`}
                  />
                </SairexMarketingBrandLink>
              ) : (
                <Image
                  src={topBarLogoUrl}
                  alt="Organization logo"
                  width={128}
                  height={32}
                  className={`h-8 w-auto object-contain ${
                    shouldRoundTopBarLogo ? "rounded-md" : ""
                  }`}
                />
              )}
            </div>
          </div>
        </div>

        {/* ── Main content area ───────────────────────────────── */}
        <main className="flex-1 overflow-y-auto bg-background p-4 md:p-6">
          {children}
        </main>

        <footer
          className="border-t border-sidebar-border px-4 py-2 text-xs font-semibold md:px-6"
          style={{ backgroundColor: bottomBarBackgroundColor, color: bottomBarTextColor }}
        >
          <div className="flex items-center justify-between gap-4">
            <p className="truncate">
              User: <span>{userEmail}</span>
            </p>
            <p className="text-center">Powered by SAIR Techonolgies</p>
            <p className="shrink-0 text-right">{appVersion}</p>
          </div>
        </footer>
      </div>
    </div>
  );
}
