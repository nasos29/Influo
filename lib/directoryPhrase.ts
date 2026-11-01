/**
 * Deterministic directory query parser. No model calls.
 * Recognised pieces become filters; the rest stays text search.
 */

import { EXTRA_LOCATION_SEED, EUROPE_LOCATION_SEED, LOCATION_SEED } from "@/lib/locationSeed";
import { DIRECTORY_INDUSTRIES } from "@/lib/directoryIndustries";
import { searchFold } from "@/lib/searchFold";
import { SKILL_GROUPS, skillLabel, type SkillKey } from "@/lib/skills";
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
    "me",
    "with",
    "δημιουργός",
    "δημιουργοί",
    "δημιουργό",
    "δημιουργούς",
    "δημιουργου",
    "dimiourgos",
    "dimiourgoi",
    "dimiourgo",
    "dimiourgous",
    "shop",
    "store",
    "κατάστημα",
    "katastima",
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

const INDUSTRIES = DIRECTORY_INDUSTRIES;

const EXTRA_SKILL_WORDS: Partial<Record<SkillKey, string[]>> = {
  product_photo: ["φωτογραφία προϊόντων", "φωτογραφιες προιοντων", "product photo", "product photos"],
  video_editing: ["μονταζ", "video edit", "editing"],
  subtitles: ["υποτιτλοι", "captions"],
  drone: ["ληψεις drone", "drone footage"],
  voiceover: ["voice over", "φωνη"],
  social_strategy: ["social media", "στρατηγικη social"],
  event_hosting: ["διοργάνωση events", "παρουσίαση events", "event hosting"],
  on_camera: ["on camera", "παρουσίαση στην κάμερα"],
  short_video: ["reels", "tiktok video", "short video"],
};

const SKILL_ALIASES: { key: SkillKey; phrases: string[] }[] = SKILL_GROUPS.flatMap((group) =>
  group.skills.map((skill) => ({
    key: skill.key,
    phrases: [
      skill.key,
      skill.label.el,
      skill.label.en,
      skill.key.replace(/_/g, " "),
      ...(EXTRA_SKILL_WORDS[skill.key] || []),
    ],
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
  const rawPieceWords = new Set(
    piece
      .toLowerCase()
      .split(/\s+/)
      .map((word) => word.trim())
      .filter(Boolean)
  );
  if (!pieceWords.size && !rawPieceWords.size) return source;
  return source
    .split(/\s+/)
    .filter((word) => {
      if (rawPieceWords.has(word.toLowerCase())) return false;
      const folded = searchFold(word).split(" ").filter(Boolean);
      if (!folded.length || !pieceWords.size) return true;
      return !folded.every((token) => pieceWords.has(token));
    })
    .join(" ")
    .trim();
}

/** One word must be a whole token. Several words must appear in order. */
function phraseHits(foldedText: string, tokens: string[], phrase: string): boolean {
  const folded = searchFold(phrase);
  if (!folded) return false;
  const parts = folded.split(" ").filter(Boolean);
  if (parts.length === 1) return tokens.includes(parts[0]);
  return foldedText.includes(folded);
}

function bestPhrase<T extends { phrases: string[] }>(
  items: T[],
  foldedText: string,
  tokens: string[]
): { item: T; phrase: string } | null {
  let best: { item: T; phrase: string; score: number } | null = null;
  for (const item of items) {
    for (const phrase of item.phrases) {
      if (!phraseHits(foldedText, tokens, phrase)) continue;
      const score = searchFold(phrase).length;
      if (!best || score > best.score) best = { item, phrase, score };
    }
  }
  return best ? { item: best.item, phrase: best.phrase } : null;
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

  const industryHit = bestPhrase(INDUSTRIES, folded(), tokens());
  if (industryHit) {
    categories = industryHit.item.categories;
    working = removeFolded(working, industryHit.phrase);
    labels.push({ id: "industry", el: industryHit.item.el, en: industryHit.item.en });
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

  const skillHit = bestPhrase(SKILL_ALIASES, folded(), tokens());
  if (skillHit) {
    skill = skillHit.item.key;
    working = removeFolded(working, skillHit.phrase);
    const label = skillLabel(skillHit.item.key, "el");
    const labelEn = skillLabel(skillHit.item.key, "en");
    labels.push({
      id: "skill",
      el: label || skillHit.item.key,
      en: labelEn || skillHit.item.key,
    });
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
