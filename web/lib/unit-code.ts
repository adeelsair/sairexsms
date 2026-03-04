/**
 * Unit Code Generation — race-safe, hierarchy-aware auto-increment.
 *
 * Uses the UnitCodeSequence table for atomic increment per (scopeType, scopeId).
 * City codes use a special 3-letter abbreviation derived from the city name.
 *
 * Format:
 *   Region    → R01, R02, ...
 *   SubRegion → S01, S02, ... (scoped per parent region)
 *   City      → LHR, ISB, KHI (3-letter abbreviation, unique)
 *   Zone      → Z01, Z02, ... (scoped per parent city)
 *   Campus    → C01, C02, ... (scoped per zone or city)
 */

type TransactionClient = Parameters<Parameters<typeof import("@/lib/prisma").prisma.$transaction>[0]>[0];

const SCOPE_PREFIX: Record<string, string> = {
  REGION: "R",
  SUBREGION: "S",
  ZONE: "Z",
  CAMPUS: "C",
};

/**
 * Generate a sequential unit code (R01, S01, Z01, C01) via atomic DB increment.
 * Scoped per organization for true multi-tenant isolation.
 * Must be called inside a Prisma $transaction.
 */
export async function generateUnitCode(
  scopeType: "REGION" | "SUBREGION" | "ZONE" | "CAMPUS",
  scopeId: string | null,
  organizationId: string,
  tx: TransactionClient,
): Promise<string> {
  const prefix = SCOPE_PREFIX[scopeType];
  const key = scopeId ?? "__ROOT__";

  const sequence = await tx.unitCodeSequence.upsert({
    where: {
      organizationId_scopeType_scopeId: { organizationId, scopeType, scopeId: key },
    },
    create: {
      scopeType,
      scopeId: key,
      organizationId,
      lastValue: 1,
    },
    update: {
      lastValue: { increment: 1 },
    },
  });

  return `${prefix}${String(sequence.lastValue).padStart(2, "0")}`;
}

/**
 * Generate a 3-letter city code from the city name.
 * Scoped per organization — each org gets its own code namespace.
 * Must be called inside a Prisma $transaction.
 */
export async function generateCityCode(
  cityName: string,
  organizationId: string,
  tx: TransactionClient,
): Promise<string> {
  const base = deriveCityAbbreviation(cityName);

  const existing = await tx.city.findFirst({
    where: { unitCode: base, organizationId },
  });

  if (!existing) return base;

  let suffix = 2;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const candidate = `${base}${suffix}`;
    const taken = await tx.city.findFirst({
      where: { unitCode: candidate, organizationId },
    });
    if (!taken) return candidate;
    suffix++;
    if (suffix > 99) break;
  }

  return `${base}${Date.now() % 1000}`;
}

/**
 * Build the materialized fullUnitPath for a campus by walking up the hierarchy.
 * Skips missing optional levels (Region, SubRegion, Zone).
 * Must be called inside a Prisma $transaction.
 *
 * Result example: "R01-S02-LHR-Z01-C03"
 */
export async function buildFullUnitPath(
  cityId: string,
  zoneId: string | null,
  campusUnitCode: string,
  tx: TransactionClient,
): Promise<string> {
  const city = await tx.city.findUniqueOrThrow({
    where: { id: cityId },
    select: {
      unitCode: true,
      regionId: true,
      subRegionId: true,
      region: { select: { unitCode: true } },
      subRegion: { select: { unitCode: true } },
    },
  });

  let zoneCode: string | null = null;
  if (zoneId) {
    const zone = await tx.zone.findUnique({
      where: { id: zoneId },
      select: { unitCode: true },
    });
    zoneCode = zone?.unitCode ?? null;
  }

  const parts = [
    city.region?.unitCode,
    city.subRegion?.unitCode,
    city.unitCode,
    zoneCode,
    campusUnitCode,
  ].filter(Boolean);

  return parts.join("-");
}

const KNOWN_CITIES: Record<string, string> = {
  lahore: "LHR",
  karachi: "KHI",
  islamabad: "ISB",
  rawalpindi: "RWP",
  faisalabad: "FSD",
  multan: "MUL",
  peshawar: "PSH",
  quetta: "QTA",
  sialkot: "SKT",
  gujranwala: "GRW",
  hyderabad: "HYD",
  bahawalpur: "BWP",
  sargodha: "SGD",
  sukkur: "SUK",
  larkana: "LRK",
  abbottabad: "ATD",
  mardan: "MDN",
  muzaffarabad: "MZD",
  mirpur: "MRP",
  gilgit: "GIT",
  chitral: "CTL",
  swat: "SWT",
  dera_ismail_khan: "DIK",
  dera_ghazi_khan: "DGK",
  sahiwal: "SWL",
  jhelum: "JHL",
  gujrat: "GJT",
  okara: "OKR",
  kasur: "KSR",
  sheikhupura: "SHP",
  rahim_yar_khan: "RYK",
  khairpur: "KHP",
  nawabshah: "NWS",
  jacobabad: "JCB",
  zhob: "ZHB",
  turbat: "TBT",
  gwadar: "GWD",
  kohat: "KOH",
  bannu: "BNU",
  mingora: "MNG",
  mansehra: "MNS",
  haripur: "HRP",
  wah_cantt: "WAH",
  taxila: "TXL",
  attock: "ATK",
  chakwal: "CKW",
  mianwali: "MWI",
  bhakkar: "BKR",
  khushab: "KSB",
  toba_tek_singh: "TTS",
  chiniot: "CNT",
  hafizabad: "HFD",
  mandi_bahauddin: "MBD",
  narowal: "NRW",
  lodhran: "LDN",
  vehari: "VHR",
  khanewal: "KNW",
  pakpattan: "PKP",
  muzaffargarh: "MZG",
  rajanpur: "RJP",
  layyah: "LYH",
};

function deriveCityAbbreviation(name: string): string {
  const normalized = name.toLowerCase().trim().replace(/[\s-]+/g, "_");

  if (KNOWN_CITIES[normalized]) {
    return KNOWN_CITIES[normalized];
  }

  const clean = name.replace(/[^a-zA-Z]/g, "").toUpperCase();
  if (clean.length <= 3) return clean.padEnd(3, "X");

  const consonants = clean.replace(/[AEIOU]/g, "");
  if (consonants.length >= 3) {
    return consonants.slice(0, 3);
  }

  return clean.slice(0, 3);
}
