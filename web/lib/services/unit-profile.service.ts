import { prisma } from "@/lib/prisma";
import type { UnitScopeType } from "@/lib/generated/prisma";
import type { UpdateUnitProfileInput } from "@/lib/validations/unit-profile";
import type { CreateUnitContactInput, UpdateUnitContactInput } from "@/lib/validations/unit-contact";
import type { CreateUnitAddressInput, UpdateUnitAddressInput } from "@/lib/validations/unit-address";
import type { CreateUnitBankInput, UpdateUnitBankInput } from "@/lib/validations/unit-bank";

/* ── Profile ──────────────────────────────────────────────── */

export async function getUnitProfile(unitType: UnitScopeType, unitId: string) {
  return prisma.unitProfile.findUnique({
    where: { unitType_unitId: { unitType, unitId } },
    include: { contacts: { orderBy: { isPrimary: "desc" } }, addresses: { orderBy: { isPrimary: "desc" } } },
  });
}

export async function updateUnitProfile(data: UpdateUnitProfileInput) {
  const { unitType, unitId, ...fields } = data;

  const cleaned: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(fields)) {
    if (val !== undefined) cleaned[key] = val === "" ? null : val;
  }

  return prisma.unitProfile.update({
    where: { unitType_unitId: { unitType: unitType as UnitScopeType, unitId } },
    data: cleaned,
    include: { contacts: { orderBy: { isPrimary: "desc" } }, addresses: { orderBy: { isPrimary: "desc" } } },
  });
}

/* ── Contacts ─────────────────────────────────────────────── */

export async function listContacts(profileId: string) {
  return prisma.unitContact.findMany({
    where: { unitProfileId: profileId },
    orderBy: [{ isPrimary: "desc" }, { name: "asc" }],
  });
}

export async function createContact(profileId: string, data: Omit<CreateUnitContactInput, "unitType" | "unitId">) {
  return prisma.$transaction(async (tx) => {
    if (data.isPrimary) {
      await tx.unitContact.updateMany({
        where: { unitProfileId: profileId, isPrimary: true },
        data: { isPrimary: false },
      });
    }
    return tx.unitContact.create({
      data: { ...data, unitProfileId: profileId },
    });
  });
}

export async function updateContact(contactId: string, profileId: string, data: UpdateUnitContactInput) {
  return prisma.$transaction(async (tx) => {
    if (data.isPrimary) {
      await tx.unitContact.updateMany({
        where: { unitProfileId: profileId, isPrimary: true, id: { not: contactId } },
        data: { isPrimary: false },
      });
    }
    return tx.unitContact.update({
      where: { id: contactId },
      data,
    });
  });
}

export async function deleteContact(contactId: string) {
  return prisma.unitContact.delete({ where: { id: contactId } });
}

/* ── Addresses ────────────────────────────────────────────── */

export async function listAddresses(profileId: string) {
  return prisma.unitAddress.findMany({
    where: { unitProfileId: profileId },
    orderBy: [{ isPrimary: "desc" }, { city: "asc" }],
  });
}

export async function createAddress(profileId: string, data: Omit<CreateUnitAddressInput, "unitType" | "unitId">) {
  return prisma.$transaction(async (tx) => {
    if (data.isPrimary) {
      await tx.unitAddress.updateMany({
        where: { unitProfileId: profileId, isPrimary: true },
        data: { isPrimary: false },
      });
    }
    return tx.unitAddress.create({
      data: { ...data, unitProfileId: profileId },
    });
  });
}

export async function updateAddress(addressId: string, profileId: string, data: UpdateUnitAddressInput) {
  return prisma.$transaction(async (tx) => {
    if (data.isPrimary) {
      await tx.unitAddress.updateMany({
        where: { unitProfileId: profileId, isPrimary: true, id: { not: addressId } },
        data: { isPrimary: false },
      });
    }
    return tx.unitAddress.update({
      where: { id: addressId },
      data,
    });
  });
}

export async function deleteAddress(addressId: string) {
  return prisma.unitAddress.delete({ where: { id: addressId } });
}

/* ── Bank Accounts ───────────────────────────────────────── */

export async function listBankAccounts(profileId: string) {
  return prisma.unitBankAccount.findMany({
    where: { unitProfileId: profileId, status: { not: "ARCHIVED" } },
    orderBy: [{ isPrimary: "desc" }, { bankName: "asc" }],
  });
}

export async function createBankAccount(
  profileId: string,
  data: Omit<CreateUnitBankInput, "unitType" | "unitId">,
) {
  return prisma.$transaction(async (tx) => {
    const profile = await tx.unitProfile.findUnique({
      where: { id: profileId },
      select: { organizationId: true },
    });
    if (!profile) {
      throw new Error("Unit profile not found");
    }

    if (data.isPrimary) {
      await tx.unitBankAccount.updateMany({
        where: { unitProfileId: profileId, isPrimary: true },
        data: { isPrimary: false },
      });
    }
    return tx.unitBankAccount.create({
      data: {
        ...data,
        unitProfileId: profileId,
        organizationId: profile.organizationId,
      },
    });
  });
}

export async function updateBankAccount(
  accountId: string,
  profileId: string,
  data: UpdateUnitBankInput,
) {
  return prisma.$transaction(async (tx) => {
    if (data.isPrimary) {
      await tx.unitBankAccount.updateMany({
        where: { unitProfileId: profileId, isPrimary: true, id: { not: accountId } },
        data: { isPrimary: false },
      });
    }
    return tx.unitBankAccount.update({
      where: { id: accountId },
      data,
    });
  });
}

export async function archiveBankAccount(accountId: string) {
  return prisma.unitBankAccount.update({
    where: { id: accountId },
    data: { status: "ARCHIVED", isPrimary: false },
  });
}
