/** Shared EL/EN copy for bidirectional collaboration reviews. */

export const REVIEW_HELPER_CREATOR_EL =
  "Οι αξιολογήσεις ανεβάζουν το προφίλ σου στις αναζητήσεις και χτίζουν εμπιστοσύνη με τα brands.";
export const REVIEW_HELPER_CREATOR_EN =
  "Reviews raise your profile in search and build trust with brands.";

export const REVIEW_HELPER_BRAND_EL =
  "Οι αξιολογήσεις σας βοηθούν να έρχονται καλύτεροι δημιουργοί στις καμπάνιες σας και δείχνουν ότι είστε αξιόπιστος συνεργάτης.";
export const REVIEW_HELPER_BRAND_EN =
  "Reviews help better creators find your campaigns and show you are a reliable partner.";

export const REVIEW_HELPER_BRAND_SHOWCASE_NOTE_EL =
  "Το βίντεο του δημιουργού θα εμφανιστεί στις «Πρόσφατες συνεργασίες» όταν είναι διαθέσιμο.";
export const REVIEW_HELPER_BRAND_SHOWCASE_NOTE_EN =
  "The creator’s video will appear in “Recent collaborations” when available.";

export const REVIEW_DECLINE_LABEL_EL = "Όχι, ευχαριστώ";
export const REVIEW_DECLINE_LABEL_EN = "No thanks";

export const REVIEW_DECLINE_HINT_EL = "Δεν θα σας ξαναρωτήσουμε για αυτή τη συνεργασία.";
export const REVIEW_DECLINE_HINT_EN = "We won’t ask again about this collaboration.";

export function reviewHelperText(party: "brand" | "influencer", lang: "el" | "en"): string {
  if (party === "brand") {
    return lang === "en" ? REVIEW_HELPER_BRAND_EN : REVIEW_HELPER_BRAND_EL;
  }
  return lang === "en" ? REVIEW_HELPER_CREATOR_EN : REVIEW_HELPER_CREATOR_EL;
}
