/**
 * Public HTML body for Zoho weekly brand “no open campaign” nudge (content_url).
 * Generic (not per-brand) — Zoho sends one body to the whole list.
 */

import { emailNextSteps } from "@/lib/emailNextSteps";
import { buttonHtml, shell, siteUrl, tipsHtml } from "@/lib/proposalMail";

export const BRAND_WEEKLY_NUDGE_SUBJECT =
  "Ξεκινήστε μια καμπάνια στο Influo — σε λίγα βήματα";

export function brandWeeklyNudgeContentUrl(baseSiteUrl?: string): string {
  const base = (baseSiteUrl || siteUrl()).replace(/\/$/, "");
  return `${base}/api/public/zoho-brand-nudge-content`;
}

export function brandWeeklyNudgeEmailHtml(opts?: { siteUrl?: string }): string {
  const base = (opts?.siteUrl || siteUrl()).replace(/\/$/, "");
  const newCampaignHref = `${base}/login?redirect=${encodeURIComponent("/brand/dashboard?tab=campaigns&new=1")}`;
  return shell(
    "Δημιουργήστε την επόμενη καμπάνια σας",
    `<p>Γεια σας,</p>
     <p>Δεν έχετε ενεργή ανοιχτή καμπάνια αυτή τη στιγμή. Με μια καμπάνια στο Influo μπορείτε να λάβετε αιτήσεις από creators που ταιριάζουν στο brand σας — χωρίς να κυνηγάτε χειροκίνητα profiles.</p>
     <p><strong>Τι κερδίζετε</strong></p>
     <ul style="margin: 8px 0 16px; padding-left: 18px; color: #334155;">
       <li>Αιτήσεις από creators που βλέπουν την ανοιχτή σας καμπάνια</li>
       <li>Συγκεντρωμένη αξιολόγηση (shortlist / αποδοχή) στο brand dashboard</li>
       <li>Συμφωνίες και παράδοση μέσα στην πλατφόρμα</li>
     </ul>
     <p><strong>Πώς (σύντομα)</strong></p>
     <ol style="margin: 8px 0 16px; padding-left: 18px; color: #334155;">
       <li>Ανοίξτε Καμπάνιες στο brand dashboard</li>
       <li>Συμπληρώστε τίτλο, περιγραφή, θέσεις και προθεσμία</li>
       <li>Πατήστε Δημοσίευση — οι creators μπορούν να κάνουν αίτηση</li>
     </ol>
     ${buttonHtml(newCampaignHref, "Δημιουργία καμπάνιας")}
     ${emailNextSteps("brand_reminder_no_campaign")}
     ${tipsHtml([
       "Αν δεν σας ενδιαφέρουν πλέον αυτές οι υπενθυμίσεις, χρησιμοποιήστε τον σύνδεσμο διαγραφής (unsubscribe) στο κάτω μέρος του email.",
     ])}
     <p style="margin-top: 28px; font-size: 11px; color: #94a3b8; line-height: 1.5;">
       Λάβατε αυτό το μήνυμα ως υπενθύμιση καμπάνιας από το Influo.
       Η διαγραφή μέσω Zoho ενημερώνει και το Influo ώστε να σταματήσουν οι υπενθυμίσεις.
     </p>`
  );
}
