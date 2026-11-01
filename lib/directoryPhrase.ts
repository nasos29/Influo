/**
 * Deterministic directory query parser. No model calls.
 * Recognised pieces become filters; the rest stays text search.
 */

import { EXTRA_LOCATION_SEED, EUROPE_LOCATION_SEED, LOCATION_SEED } from "@/lib/locationSeed";
import { searchFold } from "@/lib/searchFold";
import { SKILL_GROUPS, type SkillKey } from "@/lib/skills";
import type { CategoryKey } from "@/lib/categories";

export type ParsedDirectoryPhrase = {
  remainder: string;
  skill: SkillKey | null;
  categories: CategoryKey[];
  /** Greek place name, matched through the locations catalog. */
  location: string | null;
  /** Instagram, TikTok, or YouTube. */
  platform: "Instagram" | "TikTok" | "YouTube" | null;
  language: string | null;
  packageType: "reel" | "story" | "post" | null;
  maxPrice: number | null;
  /** Chip labels in Greek, for the pieces that were removed from the text. */
  labels: { id: string; el: string; en: string }[];
};

const LOCATION_ROWS = [...LOCATION_SEED, ...EUROPE_LOCATION_SEED, ...EXTRA_LOCATION_SEED];

const STOPWORDS = new Set(
  [
    "creator",
    "creators",
    "influencer",
    "influencers",
    "για",
    "gia",
    "for",
    "στο",
    "στη",
    "στην",
    "στον",
    "the",
    "and",
    "και",
    "με",
    "ena",
    "enas",
    "mia",
  ].map((word) => searchFold(word))
);

const PACKAGE_ALIASES: { type: "reel" | "story" | "post"; words: string[] }[] = [
  { type: "reel", words: ["reel", "reels", "ριλ", "ριλς"] },
  { type: "story", words: ["story", "stories", "ιστορια", "ιστοριες", "στορι"] },
  { type: "post", words: ["post", "posts", "ποστ"] },
];

const PLATFORMS: { value: "Instagram" | "TikTok" | "YouTube"; words: string[] }[] = [
  { value: "Instagram", words: ["instagram", "insta", "ινσταγκραμ", "ινστα"] },
  { value: "TikTok", words: ["tiktok", "tik tok", "τικτοκ", "τικ τοκ"] },
  { value: "YouTube", words: ["youtube", "yt", "γιουτιουμπ", "γιουτιουμ"] },
];

const LANGUAGES: { code: string; words: string[] }[] = [
  { code: "el", words: ["ελληνικα", "greek", "ellinika"] },
  { code: "en", words: ["αγγλικα", "english", "agglika"] },
  { code: "de", words: ["γερμανικα", "german"] },
  { code: "fr", words: ["γαλλικα", "french"] },
  { code: "es", words: ["ισπανικα", "spanish"] },
  { code: "it", words: ["ιταλικα", "italian"] },
];

type Industry = { phrases: string[]; categories: CategoryKey[]; el: string; en: string };

const INDUSTRIES: Industry[] = [
  {
    phrases: ["barber shop", "barber", "barbershop", "κουρειο", "κουρεας", "barberiko", "grooming", "mens hair"],
    categories: ["Beauty & Makeup", "Fashion & Style", "Lifestyle"],
    el: "Κουρείο",
    en: "Barber shop",
  },
  {
    phrases: ["cafe", "coffee shop", "καφετερια", "kafeneio", "cafeteria"],
    categories: ["Food & Drink", "Lifestyle"],
    el: "Καφετέρια",
    en: "Cafe",
  },
  {
    phrases: ["restaurant", "εστιατοριο", "estiatorio", "taverna", "ταβερνα"],
    categories: ["Food & Drink"],
    el: "Εστιατόριο",
    en: "Restaurant",
  },
  {
    phrases: ["gym", "γυμναστηριο", "gymnastirio", "fitness"],
    categories: ["Health & Fitness"],
    el: "Γυμναστήριο",
    en: "Gym",
  },
  {
    phrases: ["hotel", "ξενοδοχειο", "xenodoxeio"],
    categories: ["Travel", "Lifestyle"],
    el: "Ξενοδοχείο",
    en: "Hotel",
  },
  {
    phrases: ["real estate", "μεσιτικο", "mesitiko"],
    categories: ["Business & Finance"],
    el: "Μεσιτικό",
    en: "Real estate",
  },
  {
    phrases: ["dentist", "οδοντιατρος", "odontiatros"],
    categories: ["Health & Fitness"],
    el: "Οδοντίατρος",
    en: "Dentist",
  },
  {
    phrases: ["law firm", "δικηγορος", "dikigoros", "lawyer"],
    categories: ["Business & Finance"],
    el: "Δικηγορικό",
    en: "Law firm",
  },
];

const SKILL_ALIASES: { key: SkillKey; words: string[] }[] = SKILL_GROUPS.flatMap((group) =>
  group.skills.map((skill) => ({
    key: skill.key,
    words: [skill.key, skill.label.el, skill.label.en, skill.key.replace(/_/g, " ")],
  }))
);

type CityHit = { nameEl: string; token: string; popularity: number };

const CITY_INDEX: CityHit[] = [];
for (const row of LOCATION_ROWS) {
  if (row.type !== "city") continue;
  const region = new Set(searchFold(`${row.regionEl} ${row.regionEn}`).split(" ").filter((word) => word.length >= 4));
  const bag = searchFold([row.nameEl, row.nameEn, ...row.aliases].join(" "));
  for (const token of bag.split(" ")) {
    if (token.length < 4 || region.has(token)) continue;
    CITY_INDEX.push({ nameEl: row.nameEl, token, popularity: row.popularity });
  }
}
CITY_INDEX.sort((a, b) => b.token.length - a.token.length || b.popularity - a.popularity);

function findPrice(raw: string): { value: number; text: string } | null {
  const match =
    raw.match(/(?:έως|εως|mexri|under|up to|max(?:imum)?)\s*(\d+(?:[.,]\d+)?)\s*(?:€|ευρώ|ευρω|euro|eur)?/i) ||
    raw.match(/(\d+(?:[.,]\d+)?)\s*(?:€|ευρώ|ευρω|euro|eur)(?!\p{L})/iu);
  if (!match || match.index == null) return null;
  const value = Number(match[1].replace(",", "."));
  if (!Number.isFinite(value) || value <= 0) return null;
  return { value, text: match[0] };
}

function removeFolded(source: string, piece: string): string {
  const pieceWords = new Set(searchFold(piece).split(" ").filter(Boolean));
  if (!pieceWords.size) return source;
  return source
    .split(/\s+/)
    .filter((word) => !pieceWords.has(searchFold(word)))
    .join(" ")
    .trim();
}

export function parseDirectoryPhrase(raw: string): ParsedDirectoryPhrase {
  const original = String(raw || "").replace(/\s+/g, " ").trim();
  const empty: ParsedDirectoryPhrase = {
    remainder: original,
    skill: null,
    categories: [],
    location: null,
    platform: null,
    language: null,
    packageType: null,
    maxPrice: null,
    labels: [],
  };
  if (!original) return empty;

  let working = original;
  const labels: ParsedDirectoryPhrase["labels"] = [];
  let packageType: ParsedDirectoryPhrase["packageType"] = null;
  let maxPrice: number | null = null;
  let skill: SkillKey | null = null;
  let categories: CategoryKey[] = [];
  let location: string | null = null;
  let platform: ParsedDirectoryPhrase["platform"] = null;
  let language: string | null = null;

  const folded = () => searchFold(working);
  const tokens = () => folded().split(" ").filter(Boolean);

  const price = findPrice(working);
  const packageHit = PACKAGE_ALIASES.find((item) =>
    item.words.some((word) => tokens().includes(searchFold(word)))
  );
  if (packageHit && price) {
    packageType = packageHit.type;
    maxPrice = price.value;
    working = removeFolded(working, price.text);
    const word = packageHit.words.find((item) => tokens().includes(searchFold(item))) || packageHit.words[0];
    working = removeFolded(working, word);
    labels.push({
      id: "package",
      el: `${packageHit.type} έως ${maxPrice} €`,
      en: `${packageHit.type} up to ${maxPrice} €`,
    });
  }

  const industry = INDUSTRIES.find((item) =>
    item.phrases.some((phrase) => folded().includes(searchFold(phrase)))
  );
  if (industry) {
    categories = industry.categories;
    const phrase = [...industry.phrases].sort((a, b) => searchFold(b).length - searchFold(a).length).find((item) =>
      folded().includes(searchFold(item))
    );
    if (phrase) working = removeFolded(working, phrase);
    labels.push({ id: "industry", el: industry.el, en: industry.en });
  }

  const city = CITY_INDEX.find((item) => tokens().includes(item.token));
  if (city) {
    location = city.nameEl;
    working = removeFolded(working, city.token);
    labels.push({ id: "location", el: city.nameEl, en: city.nameEl });
  }

  const platformHit = PLATFORMS.find((item) => item.words.some((word) => folded().includes(searchFold(word))));
  if (platformHit) {
    platform = platformHit.value;
    const word = platformHit.words.find((item) => folded().includes(searchFold(item))) || platformHit.value;
    working = removeFolded(working, word);
    labels.push({ id: "platform", el: platformHit.value, en: platformHit.value });
  }

  const languageHit = LANGUAGES.find((item) => item.words.some((word) => tokens().includes(searchFold(word))));
  if (languageHit) {
    language = languageHit.code;
    const word = languageHit.words.find((item) => tokens().includes(searchFold(item))) || languageHit.code;
    working = removeFolded(working, word);
    labels.push({ id: "language", el: languageHit.code, en: languageHit.code });
  }

  const skillHit = SKILL_ALIASES.find((item) => item.words.some((word) => tokens().includes(searchFold(word))));
  if (skillHit) {
    skill = skillHit.key;
    const word = skillHit.words.find((item) => tokens().includes(searchFold(item))) || skillHit.key;
    working = removeFolded(working, word);
    labels.push({ id: "skill", el: skillHit.key, en: skillHit.key });
  }

  const extracted = labels.length > 0;
  const remainder = working
    .split(/\s+/)
    .filter(Boolean)
    .filter((word) => !extracted || !STOPWORDS.has(searchFold(word)))
    .join(" ")
    .trim();

  return { remainder, skill, categories, location, platform, language, packageType, maxPrice, labels };
}
