/** Campaign emails: same shell, summary block, blue button and short tips as the proposal emails. Greek only. */
import { emailNextSteps } from "@/lib/emailNextSteps";
import { formatDate } from "@/lib/formatDateTime";
import { escapeHtml } from "@/lib/proposalParty";
import { brandLink, buttonHtml, intEuro, shell, siteUrl, tipsHtml, todayAthens } from "@/lib/proposalMail";

export type Mail = { subject: string; html: string };

type Row = [label: string, value: string | null | undefined];

function clip(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

/** Summary block; rows with an empty value are skipped. Values are plain text. */
export function campaignSummaryHtml(rows: Row[]): string {
  const lines = rows
    .filter(([, value]) => value != null && String(value).trim() !== "")
    .map(([label, value]) => `<strong>${escapeHtml(label)}:</strong> ${escapeHtml(String(value))}`);
  return `<p style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px 14px;">${lines.join("<br/>")}</p>`;
}

function euroOrNull(amount: unknown): string | null {
  if (amount == null || String(amount).trim() === "") return null;
  const value = intEuro(amount);
  return value ? value : null;
}

function quoteHtml(label: string, text: string | null | undefined): string {
  const clean = String(text || "").trim();
  if (!clean) return "";
  return `<p><strong>${escapeHtml(label)}</strong></p><blockquote style="margin: 0; padding-left: 12px; border-left: 3px solid #e2e8f0; color: #475569; white-space: pre-wrap;">${escapeHtml(clean).replace(/\n/g, "<br/>")}</blockquote>`;
}

export function campaignUrl(campaignId?: string | null): string {
  const id = String(campaignId || "");
  return /^[0-9a-f-]{36}$/i.test(id) ? `${siteUrl()}/campaigns/${id}` : `${siteUrl()}/campaigns`;
}

export function campaignsUrl(): string {
  return `${siteUrl()}/campaigns`;
}

function brandCampaignsLink(email: string, hasAccount = true): string {
  if (!hasAccount) return brandLink(email, false);
  return `${siteUrl()}/login?redirect=${encodeURIComponent("/brand/dashboard?tab=campaigns")}&email=${encodeURIComponent(email)}`;
}

const creatorCampaignsTab = () => `${siteUrl()}/dashboard?tab=campaigns`;
const creatorProposalsTab = () => `${siteUrl()}/dashboard?tab=proposals`;

/** Brand: a creator applied to the campaign. */
export function applicationToBrand(input: {
  brandEmail: string;
  brandName: string;
  campaignTitle: string;
  influencerName: string;
  message?: string | null;
  proposedPrice?: unknown;
  workLinks?: string | null;
  brandHasAccount?: boolean;
}): Mail {
  return {
    subject: `Νέα αίτηση από ${input.influencerName}: ${clip(input.campaignTitle, 55)}`,
    html: shell(
      "Νέα αίτηση στην καμπάνια σας",
      `<p>Γεια σας ${escapeHtml(input.brandName)},</p>
       <p>Ο/Η <strong>${escapeHtml(input.influencerName)}</strong> έκανε αίτηση στην καμπάνια σας.</p>
       ${campaignSummaryHtml([
         ["Καμπάνια", input.campaignTitle],
         ["Δημιουργός", input.influencerName],
         ["Προτεινόμενη τιμή", euroOrNull(input.proposedPrice)],
         ["Ημερομηνία", todayAthens()],
       ])}
       ${quoteHtml("Μήνυμα του δημιουργού:", input.message)}
       ${quoteHtml("Δείγματα δουλειάς:", input.workLinks)}
       ${buttonHtml(brandCampaignsLink(input.brandEmail, input.brandHasAccount ?? true), "Δείτε την αίτηση")}
       ${emailNextSteps("campaign_application_brand")}
       ${tipsHtml([
         "Απαντήστε όσο πιο γρήγορα μπορείτε· οι δημιουργοί κάνουν αιτήσεις και σε άλλες καμπάνιες.",
         "Βάλτε στη λίστα (shortlist) όσους σας ενδιαφέρουν και αποφασίστε όταν μαζευτούν οι αιτήσεις.",
       ])}`
    ),
  };
}

/** Creator: confirmation that the application was sent. */
export function applicationToCreator(input: {
  influencerName: string;
  campaignTitle: string;
  brandName: string;
  campaignId: string;
  proposedPrice?: unknown;
}): Mail {
  return {
    subject: `Η αίτησή σου στάλθηκε: ${clip(input.campaignTitle, 55)}`,
    html: shell(
      "Η αίτησή σου στάλθηκε",
      `<p>Γεια σου ${escapeHtml(input.influencerName)},</p>
       <p>Η αίτησή σου για την καμπάνια της <strong>${escapeHtml(input.brandName)}</strong> στάλθηκε.</p>
       ${campaignSummaryHtml([
         ["Καμπάνια", input.campaignTitle],
         ["Επιχείρηση", input.brandName],
         ["Προτεινόμενη τιμή", euroOrNull(input.proposedPrice)],
         ["Ημερομηνία", todayAthens()],
       ])}
       <p><strong>Τι ακολουθεί:</strong> η επιχείρηση θα δει την αίτησή σου. Θα ενημερωθείς με email όταν αλλάξει η κατάστασή της.</p>
       ${buttonHtml(creatorCampaignsTab(), "Δες τις αιτήσεις σου")}
       ${emailNextSteps("campaign_application_creator")}
       ${tipsHtml([
         "Κράτα το προφίλ σου ενημερωμένο (στατιστικά, πακέτα, δείγματα) — είναι το πρώτο που βλέπει η επιχείρηση.",
         "Για απορίες, γράψε στην επιχείρηση από τα μηνύματα του Influo.",
       ])}`
    ),
  };
}

/** Brand: the campaign is now published. */
export function publishedToBrand(input: {
  brandEmail: string;
  brandName: string;
  campaignTitle: string;
  campaignId: string;
  budget?: unknown;
  closesAt?: string | null;
}): Mail {
  return {
    subject: `Η καμπάνια δημοσιεύτηκε: ${clip(input.campaignTitle, 55)}`,
    html: shell(
      "Η καμπάνια σας δημοσιεύτηκε",
      `<p>Γεια σας ${escapeHtml(input.brandName)},</p>
       <p>Η καμπάνια σας είναι πλέον ανοιχτή και οι δημιουργοί που ταιριάζουν ενημερώνονται.</p>
       ${campaignSummaryHtml([
         ["Καμπάνια", input.campaignTitle],
         ["Προϋπολογισμός", euroOrNull(input.budget)],
         ["Ημερομηνία", todayAthens()],
         ["Λήξη", input.closesAt ? formatDate(input.closesAt, "el") : null],
       ])}
       ${buttonHtml(brandCampaignsLink(input.brandEmail), "Δείτε την καμπάνια")}
       ${emailNextSteps("campaign_published_brand")}
       ${tipsHtml([
         "Θα λάβετε email για κάθε νέα αίτηση.",
         "Μπορείτε να προσκαλέσετε και μόνοι σας δημιουργούς από τον κατάλογο.",
       ])}`
    ),
  };
}

/** Admin: a campaign was published. */
export function publishedToAdmin(input: { campaignTitle: string; brandName: string; campaignId: string; budget?: unknown }): Mail {
  return {
    subject: `Νέα ανοιχτή καμπάνια: ${input.brandName} — ${clip(input.campaignTitle, 42)}`,
    html: shell(
      "Νέα ανοιχτή καμπάνια",
      `${campaignSummaryHtml([
         ["Brand", input.brandName],
         ["Καμπάνια", input.campaignTitle],
         ["Προϋπολογισμός", euroOrNull(input.budget) || "—"],
         ["Ημερομηνία", todayAthens()],
         ["Campaign ID", input.campaignId],
       ])}
       ${buttonHtml(`${siteUrl()}/admin`, "Άνοιγμα διαχείρισης")}
       ${emailNextSteps("campaign_published_admin")}`
    ),
  };
}

/** Creator: a new campaign matches the profile. */
export function newCampaignToCreator(input: { influencerName: string; brandName: string; campaignTitle: string; campaignId: string }): Mail {
  return {
    subject: `Νέα καμπάνια: ${clip(input.campaignTitle, 60)}`,
    html: shell(
      "Νέα καμπάνια για σένα",
      `<p>Γεια σου ${escapeHtml(input.influencerName)},</p>
       <p>Η <strong>${escapeHtml(input.brandName)}</strong> δημοσίευσε καμπάνια που ταιριάζει με το προφίλ σου.</p>
       ${campaignSummaryHtml([
         ["Καμπάνια", input.campaignTitle],
         ["Επιχείρηση", input.brandName],
         ["Ημερομηνία", todayAthens()],
       ])}
       ${buttonHtml(campaignUrl(input.campaignId), "Δες την καμπάνια")}
       ${emailNextSteps("campaign_new_creator")}
       ${tipsHtml([
         "Κάνε αίτηση νωρίς· οι επιχειρήσεις συχνά επιλέγουν από τις πρώτες αιτήσεις.",
         "Γράψε στο μήνυμα γιατί ταιριάζεις και τι θα δημιουργούσες.",
       ])}`
    ),
  };
}

/** Creator: application shortlisted or rejected (accepted has its own email with the proposal). */
export function applicationStatusToCreator(input: {
  influencerName: string;
  campaignTitle: string;
  campaignId: string;
  status: "shortlisted" | "rejected";
}): Mail {
  const shortlisted = input.status === "shortlisted";
  return {
    subject: shortlisted
      ? `Μπήκες στη λίστα: ${clip(input.campaignTitle, 55)}`
      : `Ενημέρωση για την αίτησή σου: ${clip(input.campaignTitle, 50)}`,
    html: shell(
      shortlisted ? "Μπήκες στη λίστα της επιχείρησης" : "Ενημέρωση για την αίτησή σου",
      `<p>Γεια σου ${escapeHtml(input.influencerName)},</p>
       <p>${
         shortlisted
           ? "Η επιχείρηση έβαλε την αίτησή σου στη λίστα με όσους την ενδιαφέρουν. Η τελική επιλογή γίνεται σύντομα."
           : "Η επιχείρηση δεν σε επέλεξε αυτή τη φορά για αυτή την καμπάνια. Σε ευχαριστούμε για το ενδιαφέρον!"
       }</p>
       ${campaignSummaryHtml([
         ["Καμπάνια", input.campaignTitle],
         ["Ημερομηνία", todayAthens()],
       ])}
       ${shortlisted ? buttonHtml(campaignUrl(input.campaignId), "Δες την καμπάνια") : buttonHtml(campaignsUrl(), "Δες ανοιχτές καμπάνιες")}
       ${emailNextSteps(shortlisted ? "campaign_shortlisted_creator" : "campaign_rejected_creator")}
       ${tipsHtml(
         shortlisted
           ? ["Έλεγξε τα μηνύματά σου· η επιχείρηση μπορεί να σου γράψει."]
           : ["Υπάρχουν κι άλλες ανοιχτές καμπάνιες — κάνε αίτηση σε όσες σου ταιριάζουν."]
       )}`
    ),
  };
}

/** Creator: application accepted, proposal created. */
export function acceptedToCreator(input: {
  influencerName: string;
  brandName: string;
  campaignTitle: string;
  budget: unknown;
  proposalId?: string | number | null;
}): Mail {
  return {
    subject: `Η αίτησή σου έγινε αποδεκτή: ${clip(input.campaignTitle, 45)} – ${intEuro(input.budget)}`,
    html: shell(
      "Η αίτησή σου έγινε αποδεκτή",
      `<p>Γεια σου ${escapeHtml(input.influencerName)},</p>
       <p>Η <strong>${escapeHtml(input.brandName)}</strong> αποδέχτηκε την αίτησή σου. Δημιουργήθηκε η συνεργασία σας στο Influo.</p>
       ${campaignSummaryHtml([
         ["Αριθμός", input.proposalId != null && input.proposalId !== "" ? `#${input.proposalId}` : null],
         ["Καμπάνια", input.campaignTitle],
         ["Επιχείρηση", input.brandName],
         ["Ποσό", intEuro(input.budget)],
         ["Ημερομηνία", todayAthens()],
       ])}
       <p><strong>Τι ακολουθεί:</strong> συμφωνήστε στα μηνύματα τις λεπτομέρειες και επιβεβαιώστε τη συμφωνία από τον πίνακά σου.</p>
       ${buttonHtml(creatorProposalsTab(), "Δες τη συνεργασία")}
       ${emailNextSteps("campaign_accepted_creator")}
       ${tipsHtml([
         "Ζήτα από την επιχείρηση ένα σύντομο brief (στόχος, βασικό μήνυμα, hashtags/tags).",
         "Συμφωνήστε από την αρχή ημερομηνία δημοσίευσης και παραδοτέα.",
       ])}`
    ),
  };
}

/** Brand: confirmation after accepting an application. */
export function acceptedToBrand(input: {
  brandEmail: string;
  brandName: string;
  influencerName: string;
  campaignTitle: string;
  budget: unknown;
  proposalId?: string | number | null;
}): Mail {
  return {
    subject: `Αποδεχτήκατε την αίτηση του/της ${input.influencerName} – ${intEuro(input.budget)}`,
    html: shell(
      "Η συνεργασία δημιουργήθηκε",
      `<p>Γεια σας ${escapeHtml(input.brandName)},</p>
       <p>Αποδεχτήκατε την αίτηση του/της <strong>${escapeHtml(input.influencerName)}</strong>. Η συνεργασία σας δημιουργήθηκε.</p>
       ${campaignSummaryHtml([
         ["Αριθμός", input.proposalId != null && input.proposalId !== "" ? `#${input.proposalId}` : null],
         ["Καμπάνια", input.campaignTitle],
         ["Δημιουργός", input.influencerName],
         ["Ποσό", intEuro(input.budget)],
         ["Ημερομηνία", todayAthens()],
       ])}
       ${buttonHtml(brandLink(input.brandEmail, true), "Δείτε τη συνεργασία")}
       ${emailNextSteps("campaign_accepted_brand")}
       ${tipsHtml([
         "Στείλτε στα μηνύματα ένα σύντομο brief (στόχος, βασικό μήνυμα, hashtags/tags, do &amp; don'ts), ώστε το περιεχόμενο να βγει όπως το θέλετε.",
       ])}`
    ),
  };
}

/** Creator: a brand left a review. */
export function reviewToCreator(input: {
  influencerName: string;
  brandName: string;
  rating: number;
  reviewText?: string | null;
  profileUrl: string;
}): Mail {
  const stars = "★".repeat(Math.max(0, Math.min(5, Math.round(input.rating))));
  return {
    subject: `Νέα αξιολόγηση από ${input.brandName}: ${stars}`,
    html: shell(
      "Νέα αξιολόγηση",
      `<p>Γεια σου ${escapeHtml(input.influencerName)},</p>
       <p>Η <strong>${escapeHtml(input.brandName)}</strong> άφησε αξιολόγηση για τη συνεργασία σας.</p>
       ${campaignSummaryHtml([
         ["Επιχείρηση", input.brandName],
         ["Βαθμολογία", `${stars} (${input.rating}/5)`],
         ["Ημερομηνία", todayAthens()],
       ])}
       ${quoteHtml("Σχόλιο:", input.reviewText)}
       ${buttonHtml(input.profileUrl, "Δες την αξιολόγηση")}
       ${emailNextSteps("campaign_review_creator")}
       ${tipsHtml(["Οι αξιολογήσεις εμφανίζονται στο δημόσιο προφίλ σου και βοηθούν νέες επιχειρήσεις να σε επιλέξουν."])}`
    ),
  };
}

/** Creator: the campaign they applied to was removed. */
export function removedToCreator(input: { influencerName: string; campaignTitle: string }): Mail {
  return {
    subject: `Η καμπάνια αφαιρέθηκε: ${clip(input.campaignTitle, 55)}`,
    html: shell(
      "Η καμπάνια αφαιρέθηκε",
      `<p>Γεια σου ${escapeHtml(input.influencerName)},</p>
       <p>Η επιχείρηση αφαίρεσε την καμπάνια στην οποία είχες κάνει αίτηση. Η αίτησή σου δεν είναι πλέον ενεργή.</p>
       ${campaignSummaryHtml([
         ["Καμπάνια", input.campaignTitle],
         ["Ημερομηνία", todayAthens()],
       ])}
       ${buttonHtml(campaignsUrl(), "Δες ανοιχτές καμπάνιες")}
       ${emailNextSteps("campaign_removed_creator")}`
    ),
  };
}

/** Brand: campaign closed automatically. */
export function closedToBrand(input: { brandEmail: string; brandName: string; campaignTitle: string; applicationsCount: number }): Mail {
  return {
    subject: `Η καμπάνια έκλεισε: ${clip(input.campaignTitle, 50)}`,
    html: shell(
      "Η καμπάνια έκλεισε",
      `<p>Γεια σας ${escapeHtml(input.brandName)},</p>
       <p>Η καμπάνια σας έκλεισε αυτόματα (προθεσμία ή αυτόματη διάρκεια από το άνοιγμα).</p>
       ${campaignSummaryHtml([
         ["Καμπάνια", input.campaignTitle],
         ["Αιτήσεις", String(Number.isFinite(input.applicationsCount) ? input.applicationsCount : 0)],
         ["Ημερομηνία", todayAthens()],
       ])}
       ${buttonHtml(brandCampaignsLink(input.brandEmail), "Δείτε τις καμπάνιες")}
       ${emailNextSteps("campaign_closed_brand")}
       ${tipsHtml([
         "Όσοι δεν επιλέχθηκαν ενημερώνονται αυτόματα.",
         "Μπορείτε να ανοίξετε νέα καμπάνια ή να προσκαλέσετε δημιουργούς απευθείας.",
       ])}`
    ),
  };
}

/** Creator: campaign closed and they were not selected. */
export function notSelectedToCreator(input: { influencerName: string; campaignTitle: string; brandName: string }): Mail {
  return {
    subject: `Δεν επιλέχθηκες αυτή τη φορά: ${clip(input.campaignTitle, 45)}`,
    html: shell(
      "Δεν επιλέχθηκες αυτή τη φορά",
      `<p>Γεια σου ${escapeHtml(input.influencerName)},</p>
       <p>Η καμπάνια της <strong>${escapeHtml(input.brandName)}</strong> έκλεισε και δεν επιλέχθηκες αυτή τη φορά. Σε ευχαριστούμε πολύ για την αίτησή σου!</p>
       ${campaignSummaryHtml([
         ["Καμπάνια", input.campaignTitle],
         ["Επιχείρηση", input.brandName],
         ["Ημερομηνία", todayAthens()],
       ])}
       ${buttonHtml(campaignsUrl(), "Δες ανοιχτές καμπάνιες")}
       ${emailNextSteps("campaign_not_selected_creator")}
       ${tipsHtml([
         "Νέες καμπάνιες ανοίγουν συχνά — κάνε αίτηση σε όσες σου ταιριάζουν.",
         "Ένα ενημερωμένο προφίλ με πρόσφατα δείγματα αυξάνει τις πιθανότητές σου.",
       ])}`
    ),
  };
}

/** Brand: campaign closes soon. */
export function closingSoonToBrand(input: {
  brandEmail: string;
  brandName: string;
  campaignTitle: string;
  closesAt: string;
  applicationsCount: number;
}): Mail {
  const closes = formatDate(input.closesAt, "el") || "—";
  return {
    subject: `Η καμπάνια κλείνει σύντομα: ${clip(input.campaignTitle, 45)}`,
    html: shell(
      "Η καμπάνια κλείνει σύντομα",
      `<p>Γεια σας ${escapeHtml(input.brandName)},</p>
       <p>Η καμπάνια σας κλείνει στις <strong>${escapeHtml(closes)}</strong>.</p>
       ${campaignSummaryHtml([
         ["Καμπάνια", input.campaignTitle],
         ["Λήξη", closes],
         ["Αιτήσεις", String(Number.isFinite(input.applicationsCount) ? input.applicationsCount : 0)],
       ])}
       ${buttonHtml(brandCampaignsLink(input.brandEmail), "Δείτε τις αιτήσεις")}
       ${emailNextSteps("campaign_closing_soon_brand")}
       ${tipsHtml(["Απαντήστε στις αιτήσεις πριν κλείσει η καμπάνια, ώστε οι δημιουργοί να ξέρουν πού βρίσκονται."])}`
    ),
  };
}

/** Brand: unanswered applications older than 3 days. */
export function pendingAppsReminderToBrand(input: {
  brandEmail: string;
  brandName: string;
  campaignTitle: string;
  pendingCount: number;
  oldestDays: number;
}): Mail {
  return {
    subject: `Αναπάντητες αιτήσεις: ${clip(input.campaignTitle, 45)}`,
    html: shell(
      "Αναπάντητες αιτήσεις στην καμπάνια σας",
      `<p>Γεια σας ${escapeHtml(input.brandName)},</p>
       <p>Έχετε <strong>${input.pendingCount}</strong> αναπάντητες αιτήσεις στην καμπάνια σας. Η παλαιότερη περιμένει περίπου <strong>${input.oldestDays}</strong> ημέρες.</p>
       <p style="color:#64748b;font-size:13px;">You have <strong>${input.pendingCount}</strong> unanswered application(s); the oldest is about <strong>${input.oldestDays}</strong> day(s) old.</p>
       ${campaignSummaryHtml([
         ["Καμπάνια", input.campaignTitle],
         ["Αναπάντητες", String(input.pendingCount)],
         ["Παλαιότερη (ημέρες)", String(input.oldestDays)],
         ["Ημερομηνία", todayAthens()],
       ])}
       ${buttonHtml(brandCampaignsLink(input.brandEmail), "Δείτε τις αιτήσεις")}
       ${emailNextSteps("campaign_pending_apps_brand")}
       ${tipsHtml([
         "Απαντήστε σύντομα· οι δημιουργοί κάνουν αιτήσεις και σε άλλες καμπάνιες.",
         "Μπορείτε να βάλετε στη λίστα (shortlist) όσους σας ενδιαφέρουν και να αποφασίσετε μετά.",
       ])}`
    ),
  };
}

/** Brand: creator submitted a deliverable. */
export function deliverableSubmittedToBrand(input: {
  brandEmail: string;
  brandName: string;
  campaignTitle: string;
  influencerName: string;
  deliverableUrl?: string | null;
}): Mail {
  return {
    subject: `Νέα παράδοση: ${input.influencerName} — ${clip(input.campaignTitle, 40)}`,
    html: shell(
      "Υποβλήθηκε παράδοση",
      `<p>Γεια σας ${escapeHtml(input.brandName)},</p>
       <p>Ο/Η <strong>${escapeHtml(input.influencerName)}</strong> υπέβαλε παράδοση για την καμπάνια σας.</p>
       <p style="color:#64748b;font-size:13px;">A creator submitted a deliverable for your campaign.</p>
       ${campaignSummaryHtml([
         ["Καμπάνια", input.campaignTitle],
         ["Δημιουργός", input.influencerName],
         ["Link", input.deliverableUrl || null],
         ["Ημερομηνία", todayAthens()],
       ])}
       ${buttonHtml(brandCampaignsLink(input.brandEmail), "Δείτε την παράδοση")}
       ${emailNextSteps("campaign_deliverable_brand")}
       ${tipsHtml(["Εγκρίνετε ή ζητήστε αλλαγές από τις Καμπάνιες του dashboard."])}`
    ),
  };
}

/** Creator: brand approved deliverable or requested changes. */
export function deliverableReviewToCreator(input: {
  influencerName: string;
  brandName: string;
  campaignTitle: string;
  status: "approved" | "changes_requested";
  reviewNote?: string | null;
}): Mail {
  const approved = input.status === "approved";
  return {
    subject: approved
      ? `Η παράδοσή σου εγκρίθηκε: ${clip(input.campaignTitle, 45)}`
      : `Ζητήθηκαν αλλαγές: ${clip(input.campaignTitle, 50)}`,
    html: shell(
      approved ? "Η παράδοσή σου εγκρίθηκε" : "Ζητήθηκαν αλλαγές στην παράδοση",
      `<p>Γεια σου ${escapeHtml(input.influencerName)},</p>
       <p>${
         approved
           ? `Η <strong>${escapeHtml(input.brandName)}</strong> ενέκρινε την παράδοσή σου.`
           : `Η <strong>${escapeHtml(input.brandName)}</strong> ζήτησε αλλαγές στην παράδοσή σου.`
       }</p>
       <p style="color:#64748b;font-size:13px;">${
         approved ? "Your deliverable was approved." : "The brand requested changes to your deliverable."
       }</p>
       ${campaignSummaryHtml([
         ["Καμπάνια", input.campaignTitle],
         ["Επιχείρηση", input.brandName],
         ["Κατάσταση", approved ? "Εγκρίθηκε / Approved" : "Αλλαγές / Changes requested"],
         ["Ημερομηνία", todayAthens()],
       ])}
       ${quoteHtml(approved ? "Σχόλιο:" : "Τι ζητήθηκε:", input.reviewNote)}
       ${buttonHtml(creatorCampaignsTab(), "Δες τις καμπάνιες σου")}
       ${emailNextSteps(approved ? "campaign_deliverable_approved_creator" : "campaign_deliverable_changes_creator")}`
    ),
  };
}
