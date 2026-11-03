/**
 * QA brand account ids (client-safe). Their campaigns are never shown publicly:
 * only the owning brand (its dashboard) and admin see them.
 * Override with NEXT_PUBLIC_TEST_BRAND_IDS (comma list).
 */
export const TEST_BRAND_IDS: ReadonlySet<string> = new Set(
  (process.env.NEXT_PUBLIC_TEST_BRAND_IDS || "9a4cf748-5b1c-40ab-976f-a24386fe5e67")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
);

export function isTestBrandId(brandId: unknown): boolean {
  return typeof brandId === "string" && TEST_BRAND_IDS.has(brandId.toLowerCase());
}

/** PostgREST filter value: `.not("brand_id", "in", testBrandIdsFilter())`. */
export function testBrandIdsFilter(): string {
  return `(${[...TEST_BRAND_IDS].join(",")})`;
}

/** QA creator accounts that test brands may invite. Override with NEXT_PUBLIC_TEST_CREATOR_IDS. */
export const TEST_CREATOR_IDS: ReadonlySet<string> = new Set(
  (process.env.NEXT_PUBLIC_TEST_CREATOR_IDS || "996325e4-29fd-405f-9401-01a54ea664d0")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
);
