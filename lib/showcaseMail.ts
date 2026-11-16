/**
 * Showcase appearance notice emails (Greek primary).
 * Used for live deliverable notify (flagged) and backfill (script).
 */

import { escapeHtml } from "@/lib/proposalParty";
import { buttonHtml, shell, tipsHtml } from "@/lib/proposalMail";
import {
  showcaseOptOutUrl,
  type ShowcaseParty,
  type ShowcaseSource,
} from "@/lib/showcaseOptOut";

export type ShowcaseMail = { subject: string; html: string };

function clip(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

function greeting(party: ShowcaseParty, name: string): string {
  return party === "brand" ? `Γεια σας ${escapeHtml(name)},` : `Γεια σου ${escapeHtml(name)},`;
}

/** Live path: collaboration may appear in Πρόσφατες συνεργασίες; one-click opt-out. */
export function showcaseAppearanceNotifyMail(input: {
  party: ShowcaseParty;
  recipientName: string;
  otherPartyName: string;
  collabLabel: string;
  source: ShowcaseSource;
  id: string;
}): ShowcaseMail {
  const optOut = showcaseOptOutUrl(input.source, input.id, input.party, "el");
  const who =
    input.party === "brand"
      ? `με τον/την creator <strong>${escapeHtml(input.otherPartyName)}</strong>`
      : `με το brand <strong>${escapeHtml(input.otherPartyName)}</strong>`;
  return {
    subject: `Η συνεργασία σας θα εμφανιστεί στις Πρόσφατες συνεργασίες`,
    html: shell(
      "Πρόσφατες συνεργασίες",
      `${greeting(input.party, input.recipientName)}
       <p>Η ολοκληρωμένη συνεργασία σας ${who}${
         input.collabLabel ? ` («${escapeHtml(clip(input.collabLabel, 60))}»)` : ""
       } θα εμφανιστεί στην ενότητα <strong>Πρόσφατες συνεργασίες</strong> στο influo.gr — ως social proof για brands.</p>
       <p>Αν προτιμάτε να μην εμφανίζεται δημόσια, μπορείτε να εξαιρεθείτε με ένα κλικ:</p>
       ${buttonHtml(optOut, "Εξαίρεση από τις Πρόσφατες συνεργασίες")}
       <p style="font-size:12px;color:#64748b;margin-top:16px;">Μπορείτε επίσης να αλλάξετε την επιλογή αργότερα από τη σελίδα της συνεργασίας στο dashboard.</p>
       ${tipsHtml([
         "Εμφανίζονται μόνο συνεργασίες με συναίνεση και από τις δύο πλευρές.",
         "Δεν αποθηκεύουμε αρχεία βίντεο — μόνο δημόσιο link του post.",
       ])}`
    ),
  };
}

/** Backfill: 7-day soft consent unless they opt out. */
export function showcaseBackfillNoticeMail(input: {
  party: ShowcaseParty;
  recipientName: string;
  otherPartyName: string;
  collabLabel: string;
  source: ShowcaseSource;
  id: string;
  deadlineLabel: string;
}): ShowcaseMail {
  const optOut = showcaseOptOutUrl(input.source, input.id, input.party, "el");
  const who =
    input.party === "brand"
      ? `με τον/την creator <strong>${escapeHtml(input.otherPartyName)}</strong>`
      : `με το brand <strong>${escapeHtml(input.otherPartyName)}</strong>`;
  return {
    subject: `Θα προβάλουμε τη συνεργασία σας στις Πρόσφατες συνεργασίες (έχετε 7 ημέρες)`,
    html: shell(
      "Πρόσφατες συνεργασίες — ειδοποίηση",
      `${greeting(input.party, input.recipientName)}
       <p>Θέλουμε να προβάλουμε την ολοκληρωμένη συνεργασία σας ${who}${
         input.collabLabel ? ` («${escapeHtml(clip(input.collabLabel, 60))}»)` : ""
       } στην ενότητα <strong>Πρόσφατες συνεργασίες</strong> στο influo.gr.</p>
       <p>Αν δεν επιθυμείτε δημόσια προβολή, πατήστε τον παρακάτω σύνδεσμο έως τις <strong>${escapeHtml(
         input.deadlineLabel
       )}</strong>. Μετά από αυτή την ημερομηνία, θεωρούμε ότι συμφωνείτε και η συνεργασία μπορεί να εμφανιστεί.</p>
       ${buttonHtml(optOut, "Δεν θέλω δημόσια προβολή")}
       <p style="font-size:12px;color:#64748b;margin-top:16px;">Ακόμα και μετά, μπορείτε να απενεργοποιήσετε την εμφάνιση από το dashboard της συνεργασίας.</p>
       ${tipsHtml([
         "Προβάλλουμε μόνο το δημόσιο post (Instagram / TikTok / YouTube) — χωρίς αρχεία.",
         "Στόχος είναι επαγγελματικό social proof για brands, με σεβασμό στη συναίνεσή σας.",
       ])}`
    ),
  };
}
