import { buttonHtml, shell, siteUrl } from "@/lib/proposalMail";
import { escapeHtml } from "@/lib/proposalParty";

/** Creator email body for a declared social handle the refresh could not find. */
export function buildCreatorMail(name: string, handle: string): { subject: string; html: string } {
  const editUrl = `${siteUrl()}/dashboard`;
  const atHandle = handle.startsWith("@") ? handle : `@${handle}`;
  const body = `<p>Γεια σου ${escapeHtml(name)},</p>
<p>Στο Influo έχεις δηλώσει τον λογαριασμό <strong>${escapeHtml(atHandle)}</strong>, αλλά δεν τον βρίσκουμε στο δίκτυο (λάθος username, αλλαγή handle ή διαγραφή λογαριασμού).</p>
<p>Διόρθωσε το username από το προφίλ σου ώστε οι επιχειρήσεις να βλέπουν τα σωστά στοιχεία.</p>
<hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;" />
<p>Hi ${escapeHtml(name)},</p>
<p>On Influo you listed the account <strong>${escapeHtml(atHandle)}</strong>, but we can't find it on the network (wrong username, changed handle or deleted account).</p>
<p>Please correct the username in your profile so businesses see the right details.</p>
${buttonHtml(editUrl, "Επεξεργασία προφίλ / Edit profile")}
<p style="font-size:12px;color:#6b7280;margin-top:20px;">Αν το username είναι σωστό, αγνόησε αυτό το email — μπορεί να ήταν προσωρινό σφάλμα.<br />If the username is correct, ignore this email — it may have been a temporary error.</p>`;
  return {
    subject: `Δεν βρίσκουμε τον λογαριασμό σου ${atHandle} / We can't find your account ${atHandle}`,
    html: shell(
      "Δεν βρίσκουμε τον λογαριασμό σου / We can't find your account",
      body,
    ),
  };
}
