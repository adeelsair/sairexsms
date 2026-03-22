/**
 * App entry at `/` for `app.*` hosts; full marketing landing for other hosts.
 */

function normalizeHost(raw: string | null): string {
  if (!raw) return "";
  return raw.split(":")[0].trim().toLowerCase();
}

export function hostnameFromHeaders(
  headers: Headers | { get(name: string): string | null },
): string {
  const forwarded = headers.get("x-forwarded-host");
  const host = headers.get("host");
  return normalizeHost(forwarded?.split(",")[0]?.trim() ?? host);
}

function parseHostList(value: string | undefined): string[] {
  if (!value) return [];
  return value
    .split(",")
    .map((h) => normalizeHost(h))
    .filter(Boolean);
}

/** True when `/` should render the app entry variant (not full marketing). */
export function isAppEntryHost(hostname: string): boolean {
  if (!hostname) return false;
  if (hostname.startsWith("app.")) return true;
  return parseHostList(process.env.APP_ENTRY_HOSTS).includes(hostname);
}
