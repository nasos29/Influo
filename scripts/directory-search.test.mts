import assert from "node:assert/strict";
import test from "node:test";
import { parseDirectoryPhrase } from "../lib/directoryPhrase.ts";
import { matchesDirectoryFilters, DEFAULT_DIRECTORY_FILTERS, type DirectoryCandidate } from "../lib/directoryQuery.ts";
import { searchFold, searchIncludes } from "../lib/searchFold.ts";

test("maria, μαρία and μαρια fold together", () => {
  const key = searchFold("Μαρία");
  assert.equal(searchFold("μαρια"), key);
  assert.equal(searchFold("maria"), key);
  assert.equal(searchIncludes("Μαρία Παπαδοπούλου", "maria"), true);
});

test("greeklish variants share one key", () => {
  assert.equal(searchFold("θάνος"), searchFold("thanos"));
  assert.equal(searchFold("8anos"), searchFold("thanos"));
  assert.equal(searchFold("χάρης"), searchFold("charis"));
  assert.equal(searchFold("xaris"), searchFold("haris"));
  assert.equal(searchFold("ψάρι"), searchFold("psari"));
  assert.equal(searchFold("άλεξ"), searchFold("aleks"));
  assert.equal(searchFold("alex"), searchFold("aleks"));
  assert.equal(searchFold("βασίλης"), searchFold("vasilis"));
  assert.equal(searchFold("basilis"), searchFold("vasilis"));
  assert.equal(searchFold("μπαμπάς"), searchFold("mpampas"));
  assert.equal(searchFold("bampas"), searchFold("mpampas"));
  assert.equal(searchFold("ντίνα"), searchFold("ntina"));
  assert.equal(searchFold("dina"), searchFold("ntina"));
  assert.equal(searchFold("γκρέκα"), searchFold("gkreka"));
  assert.equal(searchFold("greka"), searchFold("gkreka"));
  assert.equal(searchFold("ουρανία"), searchFold("ourania"));
  assert.equal(searchFold("urania"), searchFold("ourania"));
  assert.equal(searchFold("αιμιλία"), searchFold("aimilia"));
  assert.equal(searchFold("emilia"), searchFold("aimilia"));
  assert.equal(searchFold("είμαι"), searchFold("imai"));
});

function person(overrides: Partial<DirectoryCandidate> = {}): DirectoryCandidate {
  return {
    id: "1",
    name: "Μαρία",
    bio: "",
    categories: ["Beauty & Makeup"],
    gender: "Female",
    location: "Αθήνα",
    languages: ["Ελληνικά"],
    skills: ["ugc"],
    socials: { instagram: "maria.pap" },
    followers: { instagram: 1000 },
    price_tier: "100",
    avg_rating: 0,
    total_reviews: 0,
    past_brands: [],
    age: 30,
    verified: false,
    slug: "maria-pap",
    offers: [{ type: "reel", price: 40 }],
    ...overrides,
  };
}

test("UGC creator becomes the ugc skill and drops the filler word", () => {
  const parsed = parseDirectoryPhrase("UGC creator");
  assert.equal(parsed.skill, "ugc");
  assert.equal(parsed.remainder, "");
  assert.equal(
    matchesDirectoryFilters(person(), { ...DEFAULT_DIRECTORY_FILTERS, skills: ["ugc"], availability: "all" }),
    true
  );
  assert.equal(
    matchesDirectoryFilters(person({ skills: [] }), { ...DEFAULT_DIRECTORY_FILTERS, skills: ["ugc"], availability: "all" }),
    false
  );
});

test("reel 50 ευρώ and reel έως 50€ cap the reel package at 50", () => {
  for (const phrase of ["reel 50 ευρώ", "reel έως 50€"]) {
    const parsed = parseDirectoryPhrase(phrase);
    assert.equal(parsed.packageType, "reel", phrase);
    assert.equal(parsed.maxPrice, 50, phrase);
    assert.equal(parsed.remainder, "", phrase);
  }
  const filters = { ...DEFAULT_DIRECTORY_FILTERS, packageType: "reel", maxPackagePrice: "50", availability: "all" as const };
  assert.equal(matchesDirectoryFilters(person(), filters), true);
  assert.equal(matchesDirectoryFilters(person({ offers: [{ type: "reel", price: 80 }] }), filters), false);
  assert.equal(matchesDirectoryFilters(person({ offers: [{ type: "story", price: 20 }] }), filters), false);
  assert.equal(
    matchesDirectoryFilters(person({ offers: [{ type: "reel", price: 60 }] }), { ...filters, maxPackagePrice: "60" }),
    true
  );
});

test("influencer για barber shop maps to beauty, fashion and lifestyle", () => {
  const parsed = parseDirectoryPhrase("influencer για barber shop");
  assert.deepEqual(parsed.categories, ["Beauty & Makeup", "Fashion & Style", "Lifestyle"]);
  assert.equal(parsed.remainder, "");
  const filters = {
    ...DEFAULT_DIRECTORY_FILTERS,
    category: parsed.categories.join(","),
    availability: "all" as const,
  };
  assert.equal(matchesDirectoryFilters(person({ categories: ["Lifestyle"], skills: [] }), filters), true);
  assert.equal(matchesDirectoryFilters(person({ categories: ["Tech & Gadgets"], skills: [] }), filters), false);
});

test("store phrases map to site categories, with or without accents and in greeklish", () => {
  const expectCats = (phrase: string, categories: string[]) => {
    const parsed = parseDirectoryPhrase(phrase);
    assert.deepEqual(parsed.categories, categories, phrase);
    assert.equal(parsed.remainder, "", phrase);
  };
  expectCats("influencer για καφέ", ["Food & Drink", "Lifestyle"]);
  expectCats("gia kafe", ["Food & Drink", "Lifestyle"]);
  expectCats("για εστιατόριο", ["Food & Drink"]);
  expectCats("gia estiatorio", ["Food & Drink"]);
  expectCats("για κομμωτήριο", ["Beauty & Makeup", "Lifestyle"]);
  expectCats("gia kommotirio", ["Beauty & Makeup", "Lifestyle"]);
  expectCats("για γυμναστήριο", ["Health & Fitness"]);
  expectCats("gia gymnastirio", ["Health & Fitness"]);
  expectCats("για κατάστημα ρούχων", ["Fashion & Style", "Lifestyle"]);
  expectCats("gia katastima rouxon", ["Fashion & Style", "Lifestyle"]);
  expectCats("για ξενοδοχείο", ["Travel", "Lifestyle"]);
  expectCats("gia xenodoxeio", ["Travel", "Lifestyle"]);
  expectCats("για e-shop καλλυντικών", ["Beauty & Makeup", "Lifestyle"]);
  expectCats("για nail salon", ["Beauty & Makeup", "Lifestyle"]);
  expectCats("για ζαχαροπλαστείο", ["Food & Drink", "Lifestyle"]);
  expectCats("gia zacharoplastio", ["Food & Drink", "Lifestyle"]);
});

test("name, slug and username match across accents and greeklish", () => {
  const filters = { ...DEFAULT_DIRECTORY_FILTERS, q: "maria", availability: "all" as const };
  assert.equal(matchesDirectoryFilters(person({ name: "Μαρία" }), filters), true);
  assert.equal(matchesDirectoryFilters(person({ name: "Νίκος", slug: "maria-studio" }), filters), true);
  assert.equal(matchesDirectoryFilters(person({ name: "Νίκος", slug: "", socials: { instagram: "maria.pap" } }), filters), true);
  assert.equal(matchesDirectoryFilters(person({ name: "Νίκος", slug: "", socials: {} }), filters), false);
});
