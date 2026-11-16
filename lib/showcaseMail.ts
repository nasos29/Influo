/**
 * Showcase notice copy.
 * Live path: short bilingual line inside existing transactional emails (consent-gated).
 * Past path: dedicated backfill mail (script, dry-run by default).
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

/**
 * Short EL/EN notice + one-click opt-out for existing transactional emails.
 * Only callers should include this when that recipient's showcase consent is currently true.
 */
export function showcaseInlineNoticeHtml(optOutUrl: string): string {
  const href = escapeHtml(optOutUrl);
  return `<p style="margin:16px 0;padding:12px 14px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;font-size:13px;line-height:1.55;">Η συνεργασία μπορεί να εμφανιστεί στις <strong>Πρόσφατες συνεργασίες</strong>. <a href="${href}" style="color:#2563eb;font-weight:600;text-decoration:underline;">Δεν θέλω να εμφανιστεί</a><br/><span style="color:#64748b;font-size:12px;">This collaboration may appear in <strong>Recent collaborations</strong>. <a href="${href}" style="color:#2563eb;font-weight:600;text-decoration:underline;">I don&apos;t want it shown</a></span></p>`;
}

/** @deprecated Separate live appearance notify removed — use showcaseInlineNoticeHtml in existing mails. */
export function showcaseAppearanceNotifyMail(_input: {
  party: ShowcaseParty;
  recipientName: string;
  otherPartyName: string;
  collabLabel: string;
  source: ShowcaseSource;
  id: string;
}): ShowcaseMail {
  return { subject: "", html: "" };
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
