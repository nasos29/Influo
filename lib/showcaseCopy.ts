/**
 * Shared showcase helper copy (el/en) for consent, deliverable, and email CTAs.
 */

export type ShowcaseLang = "el" | "en";
export type ShowcaseParty = "brand" | "influencer";

export const SHOWCASE_HELPER_CREATOR_EL =
  "Οι συνεργασίες σου εμφανίζονται στην αρχική και στο προφίλ σου. Τα brands βλέπουν τη δουλειά σου, οπότε έχεις περισσότερες πιθανότητες να σε επιλέξουν.";

export const SHOWCASE_HELPER_CREATOR_EN =
  "Your collaborations appear on the homepage and your profile. Brands see your work, so you have a better chance of being chosen.";

export const SHOWCASE_HELPER_BRAND_EL =
  "Η καμπάνια σας προβάλλεται στους δημιουργούς και στους επισκέπτες του Influo, οπότε θα δεχτείτε περισσότερες και καλύτερες αιτήσεις στις επόμενες καμπάνιες σας.";

export const SHOWCASE_HELPER_BRAND_EN =
  "Your campaign is shown to creators and Influo visitors, so you’ll get more and better applications on your next campaigns.";

export const SHOWCASE_ADD_POST_CTA_EL = "Πρόσθεσε το link της ανάρτησης";
export const SHOWCASE_ADD_POST_CTA_EN = "Add the post link";

export const SHOWCASE_MISSING_POST_NOTICE_EL =
  "Λείπει το link της ανάρτησης. Πρόσθεσέ το στο πεδίο «Παραδοτέο» για να εγκρίνει το brand και να μπορεί να εμφανιστεί στις Πρόσφατες συνεργασίες.";

export const SHOWCASE_MISSING_POST_NOTICE_EN =
  "The post link is missing. Add it in the Deliverable field so the brand can approve it and it can appear in Recent collaborations.";

export const SHOWCASE_MISSING_POST_BRAND_NOTICE_EL =
  "Ο δημιουργός δεν έχει προσθέσει ακόμα το link της ανάρτησης. Μόλις το κάνει, μπορείτε να το εγκρίνετε.";

export const SHOWCASE_MISSING_POST_BRAND_NOTICE_EN =
  "The creator hasn’t added the post link yet. Once they do, you can approve it.";

export function showcaseHelperText(party: ShowcaseParty, lang: ShowcaseLang = "el"): string {
  if (party === "brand") {
    return lang === "en" ? SHOWCASE_HELPER_BRAND_EN : SHOWCASE_HELPER_BRAND_EL;
  }
  return lang === "en" ? SHOWCASE_HELPER_CREATOR_EN : SHOWCASE_HELPER_CREATOR_EL;
}

/** Small grey helper paragraph HTML for transactional emails (near CTAs). */
export function showcaseHelperEmailHtml(party: ShowcaseParty): string {
  const el = party === "brand" ? SHOWCASE_HELPER_BRAND_EL : SHOWCASE_HELPER_CREATOR_EL;
  const en = party === "brand" ? SHOWCASE_HELPER_BRAND_EN : SHOWCASE_HELPER_CREATOR_EN;
  return `<p style="margin:8px 0 0;font-size:12px;line-height:1.5;color:#94a3b8;">${el}<br/><span style="color:#94a3b8;">${en}</span></p>`;
}
