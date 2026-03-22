"use client";

import Link from "next/link";
import {
  MARKETING_SITE_HREF,
  marketingHrefIsAbsoluteHttp,
} from "@/lib/config/marketing-site";

type SairexMarketingBrandLinkProps = {
  children: React.ReactNode;
  className?: string;
  ariaLabel?: string;
};

/**
 * Wraps SairexSMS brand content (e.g. logo) so it always navigates to the marketing site.
 */
export function SairexMarketingBrandLink({
  children,
  className,
  ariaLabel = "Go to SairexSMS website",
}: SairexMarketingBrandLinkProps) {
  if (marketingHrefIsAbsoluteHttp(MARKETING_SITE_HREF)) {
    return (
      <a
        href={MARKETING_SITE_HREF}
        className={className}
        aria-label={ariaLabel}
        rel="noopener noreferrer"
      >
        {children}
      </a>
    );
  }
  return (
    <Link href={MARKETING_SITE_HREF || "/"} className={className} aria-label={ariaLabel}>
      {children}
    </Link>
  );
}
