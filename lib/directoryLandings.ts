import { DEFAULT_DIRECTORY_FILTERS, type DirectoryFilters } from "@/lib/directoryQuery";

export type DirectoryLanding = {
  slug: string;
  title: string;
  description: string;
  h1: string;
  subtitle: string;
  filters: DirectoryFilters;
};

function landing(partial: Omit<DirectoryLanding, "filters"> & { filters: Partial<DirectoryFilters> }): DirectoryLanding {
  return { ...partial, filters: { ...DEFAULT_DIRECTORY_FILTERS, ...partial.filters } };
}

/** A short public set. Sitemap includes a page only when at least three creators match. */
export const DIRECTORY_LANDINGS: DirectoryLanding[] = [
  landing({
    slug: "ugc",
    title: "UGC creators Ελλάδα | Influo",
    description: "Creators που φτιάχνουν UGC για διαφημίσεις και social. Δες προφίλ, τιμή και κάλεσέ τους σε συνεργασία.",
    h1: "UGC creators",
    subtitle: "Δημιουργοί που παράγουν περιεχόμενο για brands.",
    filters: { skills: ["ugc"] },
  }),
  landing({
    slug: "athina",
    title: "Influencers στην Αθήνα | Influo",
    description: "Influencers με έδρα την Αθήνα, σε Instagram, TikTok και YouTube. Φίλτραρε κατηγορία και τιμή.",
    h1: "Influencers στην Αθήνα",
    subtitle: "Creators που δηλώνουν Αθήνα ως τοποθεσία.",
    filters: { location: "Αθήνα" },
  }),
  landing({
    slug: "thessaloniki",
    title: "Influencers στη Θεσσαλονίκη | Influo",
    description: "Influencers με έδρα τη Θεσσαλονίκη. Δες στατιστικά, κατηγορία και τιμή συνεργασίας.",
    h1: "Influencers στη Θεσσαλονίκη",
    subtitle: "Creators που δηλώνουν Θεσσαλονίκη ως τοποθεσία.",
    filters: { location: "Θεσσαλονίκη" },
  }),
  landing({
    slug: "instagram",
    title: "Instagram influencers Ελλάδα | Influo",
    description: "Έλληνες Instagram creators με ελεγμένα στατιστικά. Διάλεξε κατηγορία, πόλη και budget.",
    h1: "Instagram influencers",
    subtitle: "Προφίλ με συνδεδεμένο λογαριασμό Instagram.",
    filters: { platform: "Instagram" },
  }),
  landing({
    slug: "tiktok",
    title: "TikTok influencers Ελλάδα | Influo",
    description: "TikTok creators στην Ελλάδα. Δες followers, engagement και τιμή.",
    h1: "TikTok influencers",
    subtitle: "Προφίλ με συνδεδεμένο λογαριασμό TikTok.",
    filters: { platform: "TikTok" },
  }),
  landing({
    slug: "youtube",
    title: "YouTube influencers Ελλάδα | Influo",
    description: "YouTube creators στην Ελλάδα. Δες κανάλι, κατηγορία και τιμή συνεργασίας.",
    h1: "YouTube influencers",
    subtitle: "Προφίλ με συνδεδεμένο κανάλι YouTube.",
    filters: { platform: "YouTube" },
  }),
  landing({
    slug: "moda",
    title: "Influencers μόδας | Influo",
    description: "Creators μόδας και στυλ. Βρες προφίλ για καμπάνιες ρούχων και αξεσουάρ.",
    h1: "Influencers μόδας",
    subtitle: "Κατηγορία Μόδα & Στυλ.",
    filters: { category: "Fashion & Style" },
  }),
  landing({
    slug: "omorfia",
    title: "Influencers ομορφιάς | Influo",
    description: "Creators ομορφιάς και μακιγιάζ. Δες προφίλ για beauty καμπάνιες.",
    h1: "Influencers ομορφιάς",
    subtitle: "Κατηγορία Ομορφιά & Μακιγιάζ.",
    filters: { category: "Beauty & Makeup" },
  }),
];

export function landingBySlug(slug: string): DirectoryLanding | null {
  return DIRECTORY_LANDINGS.find((item) => item.slug === slug) || null;
}
