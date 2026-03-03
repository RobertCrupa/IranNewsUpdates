export const OFFICIAL_CATEGORIES = [
  "airline",
  "government",
  "civil-aviation",
  "embassy",
] as const;

export type OfficialCategory = (typeof OFFICIAL_CATEGORIES)[number];

export const LEGACY_CATEGORIES = ["news", "social"] as const;
export type LegacyCategory = (typeof LEGACY_CATEGORIES)[number];

export type ArticleCategory = OfficialCategory | LegacyCategory;

export const CATEGORY_LABELS: Record<OfficialCategory, string> = {
  airline: "Airlines",
  government: "Governments",
  "civil-aviation": "Civil Aviation",
  embassy: "Embassies",
};

export const OFFICIAL_X_ACCOUNTS: Record<OfficialCategory, string[]> = {
  airline: [
    "emirates",
    "etihad",
    "flydubai",
    "qatarairways",
    "TurkishAirlines",
    "British_Airways",
    "lufthansa",
    "AirFrance",
    "KLM",
  ],
  government: [
    "StateDept",
    "GOVUK",
    "francediplo_EN",
    "AusForeign",
    "CanadasFP",
    "ForeignOfficeAE",
  ],
  "civil-aviation": [
    "icao",
    "EASA",
    "UK_CAA",
    "faa",
    "gcaa_ae",
  ],
  embassy: [
    "USEmbassyIsrael",
    "UKinIsrael",
    "FranceinIsrael",
    "GermanyinIsrael",
    "CanEmbIsrael",
    "USEmbassyQatar",
  ],
};

const accountToCategory = new Map<string, OfficialCategory>();
for (const [category, accounts] of Object.entries(OFFICIAL_X_ACCOUNTS) as Array<[
  OfficialCategory,
  string[],
]>) {
  for (const account of accounts) {
    accountToCategory.set(account.toLowerCase(), category);
  }
}

export function normalizeHandle(input: string): string {
  return input.replace(/^@/, "").trim().toLowerCase();
}

export function resolveCategoryFromHandle(handle?: string | null): OfficialCategory | null {
  if (!handle) return null;
  return accountToCategory.get(normalizeHandle(handle)) ?? null;
}

export function getOfficialAccounts(category?: OfficialCategory): string[] {
  if (!category) {
    return Object.values(OFFICIAL_X_ACCOUNTS).flat();
  }
  return OFFICIAL_X_ACCOUNTS[category];
}
