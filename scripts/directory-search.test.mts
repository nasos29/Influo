import assert from "node:assert/strict";
import test from "node:test";
import { directoryExamplePool, nextDirectoryExample } from "../components/directoryTypewriter.ts";
import { directoryShopExamples } from "../lib/directoryIndustries.ts";
import { parseDirectoryPhrase } from "../lib/directoryPhrase.ts";
import { matchesDirectoryFilters, directorySearchTier, DEFAULT_DIRECTORY_FILTERS, type DirectoryCandidate } from "../lib/directoryQuery.ts";
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
  for (const phrase of ["reel 50 ευρώ", "reel έως 50€", "reel έως 50 €", "reel up to 50 €"]) {
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

test("creator gia kafe and δημιουργός για καφέ filter to food", () => {
  for (const phrase of ["creator gia kafe", "δημιουργός για καφέ"]) {
    const parsed = parseDirectoryPhrase(phrase);
    assert.ok(parsed.categories.includes("Food & Drink"), phrase);
    assert.equal(parsed.remainder, "", phrase);
    const filters = {
      ...DEFAULT_DIRECTORY_FILTERS,
      category: parsed.categories.join(","),
      q: parsed.remainder,
      availability: "all" as const,
    };
    assert.equal(
      matchesDirectoryFilters(person({ categories: ["Food & Drink"], skills: [] }), filters),
      true,
      phrase
    );
    assert.equal(
      matchesDirectoryFilters(person({ categories: ["Tech & Gadgets"], skills: [] }), filters),
      false,
      phrase
    );
  }
});

test("store phrases map in greek, english, greeklish and without accents", () => {
  for (const shop of directoryShopExamples()) {
    const greek = parseDirectoryPhrase(`δημιουργός για ${shop.el}`);
    assert.ok(greek.categories.length > 0, shop.el);
    assert.equal(greek.remainder, "", shop.el);
    const english = parseDirectoryPhrase(`creator for ${shop.en}`);
    assert.ok(english.categories.length > 0, shop.en);
    assert.equal(english.remainder, "", shop.en);
  }
  for (const phrase of [
    "δημιουργοί για γυμναστήριο",
    "dimiourgos gia kommotirio",
    "creator for hotel",
    "creator for gym",
    "influencer για nail salon",
    "καφε",
    "kafe",
    "xenodoxeio",
    "zacharoplastio",
    "fournos",
    "aftokinita",
  ]) {
    const parsed = parseDirectoryPhrase(phrase);
    assert.ok(parsed.categories.length > 0, phrase);
    assert.equal(parsed.remainder, "", phrase);
  }
  assert.deepEqual(parseDirectoryPhrase("καφέ").categories, ["Food & Drink", "Lifestyle"]);
  assert.deepEqual(parseDirectoryPhrase("cafe").categories, ["Food & Drink", "Lifestyle"]);
  assert.ok(parseDirectoryPhrase("barber").categories.includes("Fashion & Style"));
  assert.equal(parseDirectoryPhrase("barber shop").categories.includes("Food & Drink"), false);
  assert.deepEqual(parseDirectoryPhrase("μπαρ").categories, ["Food & Drink", "Lifestyle"]);
  assert.deepEqual(parseDirectoryPhrase("e-shop καλλυντικών").categories, ["Beauty & Makeup", "Lifestyle"]);
  assert.deepEqual(parseDirectoryPhrase("e-shop").categories, ["Lifestyle"]);
  assert.equal(parseDirectoryPhrase("eshop").remainder, "");
});

test("skill phrases stay skills, including greek plurals and greeklish", () => {
  assert.equal(parseDirectoryPhrase("δημιουργός με φωτογραφία προϊόντων").skill, "product_photo");
  assert.equal(parseDirectoryPhrase("φωτογραφια προιοντος").skill, "product_photo");
  assert.equal(parseDirectoryPhrase("creator με video editing").skill, "video_editing");
  assert.equal(parseDirectoryPhrase("influencer με voiceover").skill, "voiceover");
  assert.equal(parseDirectoryPhrase("creator with copywriting").skill, "copywriting");
  assert.equal(parseDirectoryPhrase("dimiourgos me montaz").skill, "video_editing");
  assert.equal(parseDirectoryPhrase("UGC creator").remainder, "");
});

test("fitness Θεσσαλονίκη sets the gym category and the city", () => {
  const parsed = parseDirectoryPhrase("fitness Θεσσαλονίκη");
  assert.deepEqual(parsed.categories, ["Health & Fitness"]);
  assert.equal(parsed.location, "Θεσσαλονίκη");
  assert.equal(parsed.remainder, "");
});

test("a bio-only hit ranks below name and skills", () => {
  const named = person({ name: "Μαρία", bio: "", skills: [] });
  const bioOnly = person({ name: "Νίκος", bio: "Συνεργάζομαι με τη Μαρία", skills: [], socials: {}, slug: "" });
  const skilled = person({ name: "Νίκος", bio: "", skills: ["video_editing"], socials: {}, slug: "" });
  const bioSkill = person({ name: "Νίκος", bio: "Κάνω μοντάζ", skills: [], socials: {}, slug: "" });
  assert.equal(directorySearchTier(named, "maria"), 2);
  assert.equal(directorySearchTier(bioOnly, "maria"), 1);
  assert.equal(directorySearchTier(bioOnly, "maria") < directorySearchTier(named, "maria"), true);
  assert.equal(
    matchesDirectoryFilters(bioOnly, { ...DEFAULT_DIRECTORY_FILTERS, q: "maria", availability: "all" }),
    true
  );
  assert.equal(directorySearchTier(skilled, "μοντάζ"), 2);
  assert.equal(directorySearchTier(bioSkill, "montaz"), 1);
});

test("typewriter examples mix shops, skills and extras without repeating", () => {
  const greek = directoryExamplePool("el");
  const english = directoryExamplePool("en");
  assert.ok(greek.includes("δημιουργός για καφέ"));
  assert.ok(greek.includes("creator με video editing"));
  assert.ok(greek.includes("μαρία"));
  assert.ok(english.includes("creator for hotel"));
  assert.ok(english.includes("creator with copywriting"));
  assert.ok(english.includes("reel up to 50 €"));
  assert.equal(english.some((line) => line.startsWith("δημιουργός")), false);
  let previous = "";
  for (let i = 0; i < 12; i++) {
    const next = nextDirectoryExample("en", previous, () => 0);
    assert.notEqual(next, previous);
    previous = next;
  }
});

test("name, slug and username match across accents and greeklish", () => {
  const filters = { ...DEFAULT_DIRECTORY_FILTERS, q: "maria", availability: "all" as const };
  assert.equal(matchesDirectoryFilters(person({ name: "Μαρία" }), filters), true);
  assert.equal(matchesDirectoryFilters(person({ name: "Νίκος", slug: "maria-studio" }), filters), true);
  assert.equal(matchesDirectoryFilters(person({ name: "Νίκος", slug: "", socials: { instagram: "maria.pap" } }), filters), true);
  assert.equal(matchesDirectoryFilters(person({ name: "Νίκος", slug: "", socials: {} }), filters), false);
});
