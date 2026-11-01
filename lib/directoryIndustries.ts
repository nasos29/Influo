/**
 * Store and business phrases for directory search.
 * Matching is accent-insensitive through searchFold, so a Greek word and the
 * greeklish spelling that folds to the same key are one phrase. Extra
 * spellings are only the ones that fold differently (cafe / καφέ, yoga / γιόγκα,
 * club / κλαμπ, hotel / ξενοδοχείο, e-shop / eshop, αυτοκίνητα / aftokinita).
 * Single-word phrases match a whole token. Longer phrases win.
 */

import type { CategoryKey } from "@/lib/categories";

export type DirectoryIndustry = {
  phrases: string[];
  categories: CategoryKey[];
  /** Nominative label. */
  el: string;
  /** Accusative used after «για» in search examples. Defaults to el. */
  elFor?: string;
  en: string;
};

const food = ["Food & Drink"] as const satisfies readonly CategoryKey[];
const foodLife = ["Food & Drink", "Lifestyle"] as const satisfies readonly CategoryKey[];
const beautyLife = ["Beauty & Makeup", "Lifestyle"] as const satisfies readonly CategoryKey[];
const beautyFashion = ["Beauty & Makeup", "Fashion & Style", "Lifestyle"] as const satisfies readonly CategoryKey[];
const beautyHealth = ["Beauty & Makeup", "Health & Fitness"] as const satisfies readonly CategoryKey[];
const fashionLife = ["Fashion & Style", "Lifestyle"] as const satisfies readonly CategoryKey[];
const travelLife = ["Travel", "Lifestyle"] as const satisfies readonly CategoryKey[];
const health = ["Health & Fitness"] as const satisfies readonly CategoryKey[];
const tech = ["Tech & Gadgets"] as const satisfies readonly CategoryKey[];
const home = ["Home & Decor"] as const satisfies readonly CategoryKey[];
const pets = ["Pets & Animals"] as const satisfies readonly CategoryKey[];
const family = ["Parenting & Family"] as const satisfies readonly CategoryKey[];
const familyEdu = ["Parenting & Family", "Education & Coaching"] as const satisfies readonly CategoryKey[];
const games = ["Gaming & Esports"] as const satisfies readonly CategoryKey[];
const edu = ["Education & Coaching"] as const satisfies readonly CategoryKey[];
const music = ["Music & Dance"] as const satisfies readonly CategoryKey[];
const musicEdu = ["Music & Dance", "Education & Coaching"] as const satisfies readonly CategoryKey[];
const fun = ["Comedy & Entertainment"] as const satisfies readonly CategoryKey[];
const funMusic = ["Comedy & Entertainment", "Music & Dance"] as const satisfies readonly CategoryKey[];
const business = ["Business & Finance"] as const satisfies readonly CategoryKey[];
const cars = ["Cars & Automotive"] as const satisfies readonly CategoryKey[];
const sportsFashion = ["Sports & Athletes", "Fashion & Style"] as const satisfies readonly CategoryKey[];
const art = ["Art & Photography"] as const satisfies readonly CategoryKey[];
const ecoFood = ["Sustainability & Eco", "Food & Drink"] as const satisfies readonly CategoryKey[];
const diy = ["DIY & Crafts"] as const satisfies readonly CategoryKey[];
const life = ["Lifestyle"] as const satisfies readonly CategoryKey[];

export const DIRECTORY_INDUSTRIES: DirectoryIndustry[] = [
  {
    phrases: [
      "εστιατόριο", "εστιατόρια", "εστιατοριο", "restaurant", "restaurants",
      "ταβέρνα", "ταβέρνες", "taverna", "μεζεδοπωλείο", "ουζερί", "ouzeri",
      "ψητοπωλείο", "ψησταριά", "σουβλάκι", "σουβλατζίδικο", "souvlaki",
      "πιτσαρία", "pizza", "pizzeria", "burger", "fast food", "steakhouse",
      "sushi", "grill house", "street food", "food truck", "brunch",
      "catering", "κέτερινγκ", "creperie", "κρέπα",
    ],
    categories: [...food],
    el: "εστιατόριο",
    en: "restaurant",
  },
  {
    phrases: [
      "καφέ", "καφές", "καφετέρια", "καφετέριες", "καφενείο", "καφεκοπτείο",
      "cafe", "cafeteria", "coffee", "coffee shop", "coffee bar", "espresso bar",
      "μπαρ", "bar", "cocktail bar", "wine bar", "pub", "beach bar", "cafe bar", "rooftop bar",
    ],
    categories: [...foodLife],
    el: "καφέ",
    en: "cafe",
  },
  {
    phrases: ["φούρνος", "φούρνοι", "αρτοποιείο", "αρτοποιεία", "bakery", "bakeries", "bakehouse", "baker"],
    categories: [...food],
    el: "φούρνος",
    elFor: "φούρνο",
    en: "bakery",
  },
  {
    phrases: [
      "ζαχαροπλαστείο", "ζαχαροπλαστεία", "pastry", "pastry shop", "patisserie",
      "cupcake", "donut", "doughnut", "cake shop", "ζαχαρωτά",
    ],
    categories: [...foodLife],
    el: "ζαχαροπλαστείο",
    en: "pastry shop",
  },
  {
    phrases: ["παγωτό", "παγωτατζίδικο", "gelato", "ice cream", "ice cream shop"],
    categories: [...foodLife],
    el: "παγωτό",
    en: "ice cream",
  },
  {
    phrases: [
      "κάβα", "κάβες", "wine", "wine shop", "wine store", "wines", "κρασί", "κρασιά",
      "οινοποιείο", "winery", "ζυθοποιείο", "brewery", "beer shop",
    ],
    categories: [...food],
    el: "κάβα",
    en: "wine shop",
  },
  {
    phrases: [
      "σούπερ μάρκετ", "σουπερ μαρκετ", "supermarket", "super market", "minimarket",
      "μίνι μάρκετ", "παντοπωλείο", "grocery", "grocery store", "μανάβικο",
      "κρεοπωλείο", "ιχθυοπωλείο", "deli",
    ],
    categories: [...foodLife],
    el: "σούπερ μάρκετ",
    en: "supermarket",
  },
  {
    phrases: ["βιολογικά", "βιολογικό κατάστημα", "organic store", "organic shop", "zero waste"],
    categories: [...ecoFood],
    el: "βιολογικά",
    en: "organic store",
  },
  {
    phrases: [
      "κομμωτήριο", "κομμωτήρια", "hair salon", "hairdresser", "hair studio", "hair stylist",
    ],
    categories: [...beautyLife],
    el: "κομμωτήριο",
    en: "hair salon",
  },
  {
    phrases: [
      "barber shop", "barbershop", "barber", "barbers", "κουρείο", "κουρεία", "κουρέας",
      "barberiko", "mens hair", "men hair", "grooming",
    ],
    categories: [...beautyFashion],
    el: "κουρείο",
    en: "barber shop",
  },
  {
    phrases: [
      "nail salon", "nails salon", "nail bar", "nails", "nail", "μανικιούρ", "πεντικιούρ",
      "manicure", "pedicure",
    ],
    categories: [...beautyLife],
    el: "μανικιούρ",
    en: "nail salon",
  },
  {
    phrases: [
      "καλλωπιστήριο", "beauty salon", "ινστιτούτο αισθητικής", "spa", "day spa",
      "wellness", "wellness center", "μασάζ", "massage", "χαμάμ", "hammam",
    ],
    categories: [...beautyLife],
    el: "καλλωπιστήριο",
    en: "spa",
  },
  {
    phrases: ["tattoo studio", "tattoo", "τατουάζ", "tatuaz"],
    categories: [...beautyLife],
    el: "τατουάζ",
    en: "tattoo studio",
  },
  {
    phrases: [
      "e-shop καλλυντικών", "eshop καλλυντικών", "e shop καλλυντικών",
      "κατάστημα καλλυντικών", "καλλυντικά", "cosmetics", "cosmetic store",
      "cosmetics shop", "cosmetics e-shop",
      "beauty shop", "perfume", "perfumery", "αρώματα", "αρωματοπωλείο",
    ],
    categories: [...beautyLife],
    el: "καλλυντικά",
    en: "cosmetics",
  },
  {
    phrases: [
      "ιατρείο αισθητικής", "κέντρο αισθητικής", "αισθητική", "aesthetic clinic",
      "aesthetics clinic", "dermatologist", "δερματολόγος", "δερματολογικό",
      "πλαστικός χειρουργός", "plastic surgery",
    ],
    categories: [...beautyHealth],
    el: "αισθητική",
    en: "aesthetic clinic",
  },
  {
    phrases: [
      "γυμναστήριο", "γυμναστήρια", "gym", "fitness", "fitness studio",
      "crossfit", "personal trainer", "γυμναστής", "γυμναστρια",
    ],
    categories: [...health],
    el: "γυμναστήριο",
    en: "gym",
  },
  {
    phrases: ["pilates", "πιλάτες", "pilates studio"],
    categories: [...health],
    el: "pilates",
    en: "pilates",
  },
  {
    phrases: ["yoga", "γιόγκα", "yoga studio"],
    categories: [...health],
    el: "γιόγκα",
    en: "yoga",
  },
  {
    phrases: ["φαρμακείο", "φαρμακεία", "pharmacy", "pharmacies", "drugstore"],
    categories: [...health],
    el: "φαρμακείο",
    en: "pharmacy",
  },
  {
    phrases: [
      "οδοντίατρος", "οδοντίατροι", "οδοντιατρείο", "dentist", "dentists",
      "dental clinic", "dental",
    ],
    categories: [...health],
    el: "οδοντίατρος",
    elFor: "οδοντίατρο",
    en: "dentist",
  },
  {
    phrases: [
      "ιατρείο", "ιατρεία", "clinic", "doctor", "γιατρός", "ιατρός",
      "polyclinic", "διαγνωστικό", "διαγνωστικό κέντρο", "medical center",
    ],
    categories: [...health],
    el: "ιατρείο",
    en: "clinic",
  },
  {
    phrases: ["φυσικοθεραπεία", "φυσικοθεραπευτήριο", "physio", "physiotherapy", "physiotherapist"],
    categories: [...health],
    el: "φυσικοθεραπεία",
    en: "physiotherapy",
  },
  {
    phrases: ["διατροφολόγος", "διατροφολόγοι", "nutritionist", "dietitian"],
    categories: [...health],
    el: "διατροφολόγος",
    elFor: "διατροφολόγο",
    en: "nutritionist",
  },
  {
    phrases: ["ψυχολόγος", "ψυχολόγοι", "psychologist", "therapy practice"],
    categories: [...health],
    el: "ψυχολόγος",
    elFor: "ψυχολόγο",
    en: "psychologist",
  },
  {
    phrases: [
      "κατάστημα ρούχων", "ρούχα", "ρουχα", "clothing store", "clothes shop", "clothing", "clothes",
      "fashion store", "boutique", "apparel", "ένδυση",
    ],
    categories: [...fashionLife],
    el: "ρούχα",
    en: "clothing store",
  },
  {
    phrases: ["παπούτσια", "shoe store", "shoes", "footwear", "υποδήματα"],
    categories: [...fashionLife],
    el: "παπούτσια",
    en: "shoe store",
  },
  {
    phrases: ["κοσμήματα", "κοσμηματοπωλείο", "jewelry", "jewellery", "jeweler", "jeweller"],
    categories: [...fashionLife],
    el: "κοσμήματα",
    en: "jewelry",
  },
  {
    phrases: ["οπτικά", "οπτικός", "optician", "optical", "optical store", "glasses", "γυαλιά", "γυαλια ηλιου"],
    categories: [...fashionLife],
    el: "οπτικά",
    en: "optician",
  },
  {
    phrases: ["ρολόγια", "watches", "watch store"],
    categories: [...fashionLife],
    el: "ρολόγια",
    en: "watch store",
  },
  {
    phrases: ["αθλητικά είδη", "αθλητικά", "sports store", "sports shop", "sporting goods"],
    categories: [...sportsFashion],
    el: "αθλητικά",
    en: "sports store",
  },
  {
    phrases: ["ποδήλατο", "ποδήλατα", "bike shop", "bicycle shop"],
    categories: ["Sports & Athletes"],
    el: "ποδήλατα",
    en: "bike shop",
  },
  {
    phrases: [
      "ξενοδοχείο", "ξενοδοχεία", "hotel", "hotels", "resort", "boutique hotel",
    ],
    categories: [...travelLife],
    el: "ξενοδοχείο",
    en: "hotel",
  },
  {
    phrases: [
      "ενοικιαζόμενα δωμάτια", "ενοικιαζόμενα", "ενοικιαζομενα", "κατάλυμα",
      "apartments", "apartment rental", "airbnb", "vacation rental",
    ],
    categories: [...travelLife],
    el: "ενοικιαζόμενα",
    en: "vacation rental",
  },
  {
    phrases: [
      "ταξιδιωτικό γραφείο", "ταξιδιωτικό", "travel agency", "travel agent",
      "τουριστικό γραφείο", "tourist office",
    ],
    categories: [...travelLife],
    el: "ταξιδιωτικό",
    en: "travel agency",
  },
  {
    phrases: ["pet shop", "petshop", "pet store", "κατάστημα κατοικιδίων", "κατοικίδια", "pet supplies"],
    categories: [...pets],
    el: "pet shop",
    elFor: "κομμωτήριο σκύλων",
    en: "pet shop",
  },
  {
    phrases: ["κτηνίατρος", "κτηνίατροι", "κτηνιατρείο", "vet", "veterinary", "veterinary clinic"],
    categories: [...pets],
    el: "κτηνίατρος",
    elFor: "κτηνίατρο",
    en: "vet",
  },
  {
    phrases: ["παιχνίδια", "παιχνιδάδικο", "toy store", "toy shop", "toys"],
    categories: [...family],
    el: "παιχνίδια",
    en: "toy store",
  },
  {
    phrases: ["βρεφικά είδη", "βρεφικά", "βρεφικο", "baby store", "baby shop", "παιδικά ρούχα", "kids store"],
    categories: [...family],
    el: "βρεφικά",
    en: "baby store",
  },
  {
    phrases: ["παιδικός σταθμός", "βρεφονηπιακός", "kindergarten", "nursery school"],
    categories: [...familyEdu],
    el: "παιδικός σταθμός",
    elFor: "παιδικό σταθμό",
    en: "kindergarten",
  },
  {
    phrases: ["ηλεκτρονικά", "electronics", "electronics store", "gadget store"],
    categories: [...tech],
    el: "ηλεκτρονικά",
    en: "electronics",
  },
  {
    phrases: [
      "κινητά", "κινητό", "κινητή τηλεφωνία", "mobile phones", "phone store",
      "phone", "phones", "smartphone",
    ],
    categories: [...tech],
    el: "κινητά",
    en: "phone store",
  },
  {
    phrases: ["εφαρμογή", "application", "mobile app", "startup", "start up", "start-up", "app"],
    categories: [...tech],
    el: "εφαρμογή",
    en: "app",
  },
  {
    phrases: [
      "ηλεκτρονικό κατάστημα", "online store", "web shop", "webshop",
      "e-shop", "eshop", "e shop",
    ],
    categories: [...life],
    el: "e-shop",
    en: "e-shop",
  },
  {
    phrases: ["gaming store", "game store", "video games", "κατάστημα gaming", "games shop", "gaming", "esports"],
    categories: [...games],
    el: "gaming",
    en: "gaming store",
  },
  {
    phrases: ["έπιπλα", "επιπλα", "furniture", "furniture store"],
    categories: [...home],
    el: "έπιπλα",
    en: "furniture",
  },
  {
    phrases: ["διακόσμηση", "home decor", "decoration", "interior design", "interior studio"],
    categories: [...home],
    el: "διακόσμηση",
    en: "home decor",
  },
  {
    phrases: ["ανθοπωλείο", "ανθοπωλεία", "florist", "flower shop", "λουλούδια", "άνθη"],
    categories: [...home],
    el: "ανθοπωλείο",
    en: "florist",
  },
  {
    phrases: ["βιβλιοπωλείο", "βιβλιοπωλεία", "bookstore", "book shop", "book store", "βιβλία"],
    categories: [...edu],
    el: "βιβλιοπωλείο",
    en: "bookstore",
  },
  {
    phrases: [
      "φροντιστήριο", "φροντιστήρια", "σχολή", "tutoring", "tutor", "school",
      "language school", "φροντιστήριο ξένων γλωσσών", "ιδιωτική σχολή",
    ],
    categories: [...edu],
    el: "φροντιστήριο",
    en: "school",
  },
  {
    phrases: ["σχολή χορού", "dance school", "dance studio", "σχολή μπαλέτου"],
    categories: [...musicEdu],
    el: "σχολή χορού",
    en: "dance school",
  },
  {
    phrases: ["ωδείο", "music school", "μουσική σχολή"],
    categories: [...musicEdu],
    el: "ωδείο",
    en: "music school",
  },
  {
    phrases: ["σχολή μαγειρικής", "cooking school", "cooking class"],
    categories: ["Food & Drink", "Education & Coaching"],
    el: "σχολή μαγειρικής",
    en: "cooking school",
  },
  {
    phrases: [
      "αυτοκίνητα", "αυτοκίνητο", "aftokinita", "autokinita", "car dealer",
      "cars", "car", "auto", "συνεργείο", "βενζινάδικο", "car rental",
      "ενοικίαση αυτοκινήτων", "σχολή οδηγών", "driving school",
    ],
    categories: [...cars],
    el: "αυτοκίνητα",
    en: "cars",
  },
  {
    phrases: ["κλαμπ", "club", "nightclub", "night club", "μπουζούκια", "bouzoukia"],
    categories: [...funMusic],
    el: "κλαμπ",
    en: "nightclub",
  },
  {
    phrases: [
      "γάμος", "γάμοι", "wedding", "weddings", "wedding planner", "δεξίωση",
      "αίθουσα δεξιώσεων", "event venue", "events", "event planner",
    ],
    categories: [...fun],
    el: "γάμος",
    elFor: "γάμο",
    en: "wedding",
  },
  {
    phrases: ["σινεμά", "cinema", "movie theater", "θέατρο", "theater", "theatre", "escape room"],
    categories: [...fun],
    el: "σινεμά",
    en: "cinema",
  },
  {
    phrases: ["συναυλία", "concert venue", "live venue", "music venue"],
    categories: [...music],
    el: "συναυλία",
    en: "concert venue",
  },
  {
    phrases: ["τράπεζα", "τράπεζες", "bank", "banking"],
    categories: [...business],
    el: "τράπεζα",
    en: "bank",
  },
  {
    phrases: ["fintech", "financial app", "χρηματοοικονομικά"],
    categories: [...business],
    el: "fintech",
    en: "fintech",
  },
  {
    phrases: ["real estate", "μεσιτικό", "μεσιτης", "μεσίτης", "ακίνητα", "realestate"],
    categories: [...business],
    el: "μεσιτικό",
    en: "real estate",
  },
  {
    phrases: ["law firm", "δικηγόρος", "δικηγορικό", "lawyer", "lawyers"],
    categories: [...business],
    el: "δικηγόρος",
    elFor: "δικηγόρο",
    en: "law firm",
  },
  {
    phrases: ["ασφάλειες", "ασφαλιστικό", "insurance", "insurance agency"],
    categories: [...business],
    el: "ασφάλειες",
    en: "insurance",
  },
  {
    phrases: ["λογιστής", "λογιστικό", "λογιστήριο", "accountant", "accounting"],
    categories: [...business],
    el: "λογιστής",
    elFor: "λογιστή",
    en: "accountant",
  },
  {
    phrases: ["φωτογραφείο", "photo studio", "photography studio"],
    categories: [...art],
    el: "φωτογραφείο",
    en: "photo studio",
  },
  {
    phrases: ["είδη χειροτεχνίας", "χειροτεχνία", "craft store", "hobby shop", "hobby store"],
    categories: [...diy],
    el: "χειροτεχνία",
    en: "craft store",
  },
];

for (const industry of DIRECTORY_INDUSTRIES) {
  const spoken = industry.elFor;
  if (!spoken) continue;
  const folded = spoken.toLocaleLowerCase("el");
  if (!industry.phrases.some((phrase) => phrase.toLocaleLowerCase("el") === folded)) {
    industry.phrases.push(spoken);
  }
}

export function directoryShopExamples(): { el: string; en: string }[] {
  const seen = new Set<string>();
  const out: { el: string; en: string }[] = [];
  for (const industry of DIRECTORY_INDUSTRIES) {
    const el = industry.elFor || industry.el;
    const key = `${el}|${industry.en}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ el, en: industry.en });
  }
  return out;
}
