// node --experimental-strip-types --import ./scripts/resolve-ts-imports.mjs --test scripts/hero-theme.test.mts
import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_HERO_GRADIENT,
  heroGradientForCategory,
} from "../lib/heroTheme.ts";

test("heroGradientForCategory: known English category", () => {
  assert.equal(
    heroGradientForCategory("Beauty & Makeup"),
    "bg-gradient-to-br from-rose-900 via-fuchsia-900 to-purple-900"
  );
  assert.equal(
    heroGradientForCategory("Health & Fitness"),
    "bg-gradient-to-br from-emerald-900 via-teal-800 to-teal-900"
  );
  assert.equal(
    heroGradientForCategory("Travel"),
    "bg-gradient-to-br from-blue-900 via-sky-800 to-cyan-900"
  );
});

test("heroGradientForCategory: Greek labels", () => {
  assert.equal(
    heroGradientForCategory("Ομορφιά & Μακιγιάζ"),
    "bg-gradient-to-br from-rose-900 via-fuchsia-900 to-purple-900"
  );
  assert.equal(
    heroGradientForCategory("Ταξίδια"),
    "bg-gradient-to-br from-blue-900 via-sky-800 to-cyan-900"
  );
  assert.equal(
    heroGradientForCategory("Φαγητό & Ποτά"),
    "bg-gradient-to-br from-orange-900 via-red-800 to-rose-900"
  );
});

test("heroGradientForCategory: unknown → default Influo gradient", () => {
  assert.equal(heroGradientForCategory("Unboxing"), DEFAULT_HERO_GRADIENT);
  assert.equal(heroGradientForCategory("Something Weird"), DEFAULT_HERO_GRADIENT);
  assert.match(DEFAULT_HERO_GRADIENT, /from-slate-900/);
  assert.match(DEFAULT_HERO_GRADIENT, /via-blue-900/);
  assert.match(DEFAULT_HERO_GRADIENT, /to-indigo-800/);
});

test("heroGradientForCategory: null / empty / first of list", () => {
  assert.equal(heroGradientForCategory(null), DEFAULT_HERO_GRADIENT);
  assert.equal(heroGradientForCategory(undefined), DEFAULT_HERO_GRADIENT);
  assert.equal(heroGradientForCategory(""), DEFAULT_HERO_GRADIENT);
  assert.equal(heroGradientForCategory([]), DEFAULT_HERO_GRADIENT);
  assert.equal(
    heroGradientForCategory(["Gaming & Esports", "Travel"]),
    "bg-gradient-to-br from-indigo-950 via-violet-900 to-purple-900"
  );
  assert.equal(
    heroGradientForCategory("Fashion & Style, Travel"),
    "bg-gradient-to-br from-rose-900 via-fuchsia-900 to-purple-900"
  );
});
