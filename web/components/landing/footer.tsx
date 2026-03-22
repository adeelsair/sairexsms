import Link from "next/link";
import Image from "next/image";
import { SairexMarketingBrandLink } from "@/components/sairex-marketing-brand-link";
import { getAdminChromeColors, SIDEBAR_MID_COLOR } from "@/lib/theme/chrome-theme";
import { landingContent } from "./content";

export function LandingFooter() {
  const { bottomBarBackgroundColor, bottomBarTextColor } = getAdminChromeColors();

  return (
    <footer
      className="border-t"
      style={{
        backgroundColor: bottomBarBackgroundColor,
        borderColor: SIDEBAR_MID_COLOR,
        color: bottomBarTextColor,
      }}
    >
      <div className="mx-auto grid w-full max-w-7xl gap-10 px-4 py-14 md:px-6 lg:grid-cols-12">
        <div className="lg:col-span-4">
          <div className="rounded-2xl p-1">
            <SairexMarketingBrandLink className="inline-block">
              <Image
                src={landingContent.brand.logoSrc}
                alt={landingContent.brand.logoAlt}
                width={152}
                height={40}
                className="h-10 w-auto rounded-md object-contain"
              />
            </SairexMarketingBrandLink>
            <p className="mt-4 max-w-sm text-sm opacity-85">
              School management and SMS automation for admissions, attendance, fee operations, and
              parent communication.
            </p>
            <p className="mt-3 text-xs font-semibold opacity-95">{landingContent.brand.versionLabel}</p>
          </div>
        </div>

        <div className="grid gap-8 sm:grid-cols-2 lg:col-span-8 lg:grid-cols-4">
          {landingContent.footer.columns.map((column) => (
            <FooterColumn key={column.title} title={column.title} links={column.links} />
          ))}
        </div>
      </div>

      <div className="border-t" style={{ borderColor: SIDEBAR_MID_COLOR }}>
        <div className="mx-auto flex w-full max-w-7xl flex-col items-start gap-2 px-4 py-4 text-xs opacity-85 md:flex-row md:items-center md:justify-between md:px-6">
          <p className="font-semibold opacity-100">{landingContent.brand.name}</p>
          <p>{landingContent.footer.rightLabel}</p>
        </div>
      </div>
    </footer>
  );
}

function FooterColumn({
  title,
  links,
}: {
  title: string;
  links: readonly { label: string; href: string }[];
}) {
  return (
    <div>
      <h3 className="mb-3 text-sm font-semibold opacity-100">{title}</h3>
      <ul className="space-y-2">
        {links.map((item) => (
          <li key={item.label}>
            <Link
              href={item.href}
              className="text-sm opacity-80 transition-opacity hover:opacity-100"
            >
              {item.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
