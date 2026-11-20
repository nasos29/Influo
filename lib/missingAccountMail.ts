import { buttonHtml, shell, siteUrl } from "@/lib/proposalMail";
import { escapeHtml } from "@/lib/proposalParty";

/** Creator email body for a declared social handle the refresh could not find. */
export function buildCreatorMail(name: string, handle: string): { subject: string; html: string } {
  const editUrl = `${siteUrl()}/dashboard`;
  const atHandle = handle.startsWith("@") ? handle : `@${handle}`;
  const body = `<p>Γεια σου ${escapeHtml(name)},</p>
<p>Στο Influo έχεις δηλώσει τον λογαριασμό <strong>${escapeHtml(atHandle)}</strong>, αλλά δεν τον βρίσκουμε στο δίκτυο (λάθος username, αλλαγή handle ή διαγραφή λογαριασμού).</p>
<p>Διόρθωσε το username από το προφίλ σου ώστε οι επιχειρήσεις να βλέπουν τα σωστά στοιχεία.</p>
${buttonHtml(editUrl, "Επεξεργασία προφίλ")}
<p style="font-size:12px;color:#6b7280;margin-top:20px;">Αν το username είναι σωστό, αγνόησε αυτό το email — μπορεί να ήταν προσωρινό σφάλμα.</p>`;
  return {
    subject: `Δεν βρίσκουμε τον λογαριασμό σου ${atHandle}`,
    html: shell("Δεν βρίσκουμε τον λογαριασμό σου", body),
  };
}
