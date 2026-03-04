import { prisma } from "@/lib/prisma";

export type OrganizationMode = "SIMPLE" | "PRO";

export function isSimpleMode(input: { mode?: string | null } | string | null | undefined): boolean {
  if (typeof input === "string") {
    return input !== "PRO";
  }
  return (input?.mode ?? "SIMPLE") !== "PRO";
}

export function getSimpleTerm(
  key: "RECEIVABLES" | "LEDGER" | "DEFAULTER_ANALYSIS",
  simple: boolean,
): string {
  if (!simple) {
    if (key === "RECEIVABLES") return "Receivables";
    if (key === "LEDGER") return "Ledger";
    return "Defaulter Analysis";
  }
  if (key === "RECEIVABLES") return "Pending Fees";
  if (key === "LEDGER") return "Payment History";
  return "Fee Reminder List";
}

export async function resolveOrganizationMode(organizationId: string): Promise<{
  mode: OrganizationMode;
  isSimple: boolean;
}> {
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { mode: true },
  });

  const mode = org?.mode === "PRO" ? "PRO" : "SIMPLE";
  return {
    mode,
    isSimple: mode === "SIMPLE",
  };
}

export async function updateOrganizationMode(
  organizationId: string,
  mode: OrganizationMode,
): Promise<OrganizationMode> {
  const updated = await prisma.organization.update({
    where: { id: organizationId },
    data: { mode },
    select: { mode: true },
  });
  return updated.mode === "PRO" ? "PRO" : "SIMPLE";
}
