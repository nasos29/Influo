// node --experimental-strip-types --import ./scripts/resolve-ts-imports.mjs --test scripts/locations.test.mts
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { LOCATION_SEED_RECORDS, searchLocations } from "../lib/locationCatalog.ts";

const json = JSON.parse(readFileSync(new URL("../data/locations.json", import.meta.url), "utf8"));
const sql = readFileSync(
  new URL("../supabase/migrations/20261031210000_create_locations.sql", import.meta.url),
  "utf8"
);

test("static catalog matches the seed and the unapplied migration", () => {
  assert.equal(json.length, 176);
  assert.equal(LOCATION_SEED_RECORDS.length, json.length);
  assert.deepEqual(json, LOCATION_SEED_RECORDS);
  const inserts = sql.split("\n").filter((line) => line.trim().startsWith("('"));
  assert.equal(inserts.length, json.length);
  assert.match(sql, /FOR SELECT/);
  assert.equal(/FOR INSERT|FOR UPDATE|FOR DELETE/i.test(sql), false);
  const body = sql.replace(/^--.*$/gm, "");
  assert.equal(/influencers/i.test(body), false);
  assert.equal(json.some((row: { name_el: string }) => row.name_el === "Αθήνα"), true);
  assert.equal(json.some((row: { name_en: string }) => row.name_en === "Nicosia"), true);
});

test("typeahead matches Greek, greeklish, and English without tones", () => {
  assert.equal(searchLocations("ΑΘΗΝΑ", "el", 8, json)[0]?.name_en, "Athens");
  assert.equal(searchLocations("αθηνα", "el", 8, json)[0]?.name_el, "Αθήνα");
  assert.equal(searchLocations("athina", "en", 8, json)[0]?.name_el, "Αθήνα");
  assert.equal(searchLocations("Athens", "en", 8, json)[0]?.name_el, "Αθήνα");
  assert.equal(searchLocations("salonika", "el", 8, json)[0]?.name_el, "Θεσσαλονίκη");
  assert.equal(searchLocations("πελοπόννησος", "el", 8, json)[0]?.type, "region");
  assert.equal(searchLocations("kolonaki", "el", 8, json).length, 0);
  assert.equal(searchLocations("", "el", 8, json).length, 0);
});
