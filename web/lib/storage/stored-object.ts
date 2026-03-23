/**
 * Values in DB may be legacy public HTTPS URLs, data URLs (dev), or object keys (tenants/...).
 */
export type ParsedStoredObject =
  | { kind: "object-key"; key: string }
  | { kind: "legacy-https"; href: string }
  | { kind: "legacy-data"; href: string };

export function parseStoredObjectRef(value: string | null | undefined): ParsedStoredObject | null {
  if (value == null || typeof value !== "string") return null;
  const v = value.trim();
  if (!v) return null;
  if (v.startsWith("data:")) return { kind: "legacy-data", href: v };
  if (v.startsWith("https://") || v.startsWith("http://")) return { kind: "legacy-https", href: v };
  return { kind: "object-key", key: v };
}

export function isProbablyObjectKey(value: string): boolean {
  const p = parseStoredObjectRef(value);
  return p?.kind === "object-key";
}
