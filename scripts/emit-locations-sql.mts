// node --experimental-strip-types --import ./scripts/resolve-ts-imports.mjs scripts/emit-locations-sql.mts
import { writeFileSync } from "node:fs";
import { LOCATION_SEED_RECORDS } from "../lib/locationCatalog.ts";

function sqlString(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

const seen = new Set<string>();
for (const row of LOCATION_SEED_RECORDS) {
  const key = `${row.country}:${row.name_el}`;
  if (seen.has(key)) throw new Error(`duplicate location ${key}`);
  seen.add(key);
}

const values = LOCATION_SEED_RECORDS.map(
  (row) =>
    `  (${[
      sqlString(row.name_el),
      sqlString(row.name_en),
      sqlString(row.region_el),
      sqlString(row.region_en),
      sqlString(row.type),
      sqlString(row.country),
      String(row.popularity),
      sqlString(row.search_el),
      sqlString(row.search_en),
      sqlString(row.search_latin),
    ].join(", ")})`
).join(",\n");

const sql = `-- Generated from lib/locationSeed.ts. Do not edit by hand.
-- Not applied. Creates public.locations and seeds it. Does not touch influencers.

CREATE TABLE IF NOT EXISTS public.locations (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name_el text NOT NULL,
  name_en text NOT NULL,
  region_el text NOT NULL DEFAULT '',
  region_en text NOT NULL DEFAULT '',
  type text NOT NULL CHECK (type IN ('city', 'region', 'island')),
  country text NOT NULL DEFAULT 'GR',
  popularity integer NOT NULL DEFAULT 0,
  search_el text NOT NULL,
  search_en text NOT NULL,
  search_latin text NOT NULL
);

COMMENT ON TABLE public.locations IS
  'Place suggestions for creator location. Browser reads the static catalog; this table is the same seed.';

ALTER TABLE public.locations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS locations_select_public ON public.locations;
CREATE POLICY locations_select_public
  ON public.locations
  FOR SELECT
  TO anon, authenticated
  USING (true);

REVOKE ALL ON TABLE public.locations FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.locations TO anon, authenticated;

INSERT INTO public.locations (
  name_el, name_en, region_el, region_en, type, country, popularity, search_el, search_en, search_latin
) VALUES
${values};
`;

const out = "supabase/migrations/20261031210000_create_locations.sql";
writeFileSync(out, sql);
writeFileSync("data/locations.json", JSON.stringify(LOCATION_SEED_RECORDS, null, 2) + "\n");
console.log(`wrote ${LOCATION_SEED_RECORDS.length} rows to ${out} and data/locations.json`);
