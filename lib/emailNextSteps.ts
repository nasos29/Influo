/**
 * Shared «Τι κάνω τώρα;» / «What to do next» box for all Influo emails.
 * Greek-primary with muted EN under each step (same pattern as newer campaign mails).
 */

export type NextStep = { el: string; en: string };

export type EmailNextStepsKey =
  | "campaign_new_creator"
  | "campaign_category_bulk"
  | "campaign_application_brand"
  | "campaign_application_creator"
  | "campaign_published_brand"
  | "campaign_published_admin"
  | "campaign_shortlisted_creator"
  | "campaign_rejected_creator"
  | "campaign_accepted_creator"
  | "campaign_accepted_brand"
  | "campaign_review_creator"
  | "campaign_removed_creator"
  | "campaign_closed_brand"
  | "campaign_not_selected_creator"
  | "campaign_closing_soon_brand"
  | "campaign_pending_apps_brand"
  | "campaign_deliverable_brand"
  | "campaign_deliverable_approved_creator"
  | "campaign_deliverable_changes_creator"
  | "proposal_new_creator"
  | "proposal_brand_confirmation"
  | "proposal_accepted_brand"
  | "proposal_rejected_brand"
  | "counter_new_brand"
  | "counter_accepted_creator"
  | "counter_rejected_creator"
  | "agreement_waiting"
  | "agreement_reminder"
  | "collaboration_complete_creator"
  | "deal_complete_creator"
  | "deal_complete_brand"
  | "review_reminder_brand"
  | "review_reminder_creator"
  | "agreement_complete_admin"
  | "admin_event"
  | "message_summary"
  | "admin_message_summary"
  | "password_reset"
  | "announcement"
  | "stats_update"
  | "top10_congrats"
  | "brand_weekly_digest"
  | "signup_influencer"
  | "signup_admin"
  | "signup_brand_admin"
  | "profile_approved"
  | "brand_verified"
  | "account_deleted"
  | "account_deleted_admin"
  | "unapproved_admin_alert"
  | "ticket_user_autoreply"
  | "ticket_admin_new"
  | "ticket_admin_reply"
  | "ticket_user_reply"
  | "contact_admin"
  | "data_quality_creator"
  | "profile_edit_admin";

/** Catalog of short practical next steps per email case + recipient. */
export const EMAIL_NEXT_STEPS: Record<EmailNextStepsKey, NextStep[]> = {
  campaign_new_creator: [
    { el: "Άνοιξε τον σύνδεσμο της καμπάνιας.", en: "Open the campaign link." },
    { el: "Πάτα «Αίτηση», γράψε ένα σύντομο μήνυμα και (αν ζητείται) τιμή/δείγματα.", en: "Tap Apply, add a short message and price/samples if asked." },
    { el: "Η επιχείρηση θα δει την αίτησή σου· θα λάβεις email όταν αλλάξει κατάσταση.", en: "The brand will review it; you’ll get an email when status changes." },
  ],
  campaign_category_bulk: [
    { el: "Άνοιξε τον σύνδεσμο της καμπάνιας.", en: "Open the campaign link." },
    { el: "Αν σου ταιριάζει, πάτα «Αίτηση» και γράψε γιατί ταιριάζεις.", en: "If it’s a fit, tap Apply and say why you’re a match." },
    { el: "Θα ενημερωθείς με email όταν η επιχείρηση απαντήσει.", en: "You’ll get an email when the brand replies." },
  ],
  campaign_application_brand: [
    { el: "Άνοιξε τις Καμπάνιες στο brand dashboard και δες την αίτηση.", en: "Open Campaigns in your brand dashboard and review the application." },
    { el: "Βάλε στη λίστα (shortlist), αποδέξου ή απόρριψε.", en: "Shortlist, accept, or reject." },
    { el: "Για ερωτήσεις, γράψε στον δημιουργό από τα Μηνύματα.", en: "For questions, message the creator in Chat." },
    { el: "Αν αποδεχτείς, μετράει στις διαθέσιμες θέσεις (slots) της καμπάνιας.", en: "Accepting uses one of the campaign slots." },
  ],
  campaign_application_creator: [
    { el: "Δες την αίτησή σου στο dashboard → Καμπάνιες.", en: "Check your application under Dashboard → Campaigns." },
    { el: "Περίμενε απάντηση της επιχείρησης· θα έρθει email σε shortlist/αποδοχή/απόρριψη.", en: "Wait for the brand; you’ll get email on shortlist/accept/reject." },
    { el: "Κράτα προφίλ και δείγματα ενημερωμένα όσο περιμένεις.", en: "Keep your profile and samples up to date meanwhile." },
  ],
  campaign_published_brand: [
    { el: "Άνοιξε τις Καμπάνιες και έλεγξε ότι όλα φαίνονται σωστά.", en: "Open Campaigns and confirm everything looks right." },
    { el: "Θα λαμβάνεις email για κάθε νέα αίτηση.", en: "You’ll get an email for each new application." },
    { el: "Μπορείς να προσκαλέσεις δημιουργούς και από τον κατάλογο.", en: "You can also invite creators from the directory." },
  ],
  campaign_published_admin: [
    { el: "Άνοιξε τη διαχείριση και έλεγξε την καμπάνια.", en: "Open admin and review the campaign." },
    { el: "Επιβεβαίωσε ότι στάλθηκαν ειδοποιήσεις στους matched δημιουργούς.", en: "Confirm matching creators were notified." },
  ],
  campaign_shortlisted_creator: [
    { el: "Άνοιξε την καμπάνια και τα Μηνύματα — η επιχείρηση μπορεί να σου γράψει.", en: "Open the campaign and Messages — the brand may write you." },
    { el: "Κράτα προφίλ/δείγματα έτοιμα μέχρι την τελική επιλογή.", en: "Keep profile/samples ready until the final decision." },
  ],
  campaign_rejected_creator: [
    { el: "Δες άλλες ανοιχτές καμπάνιες και κάνε αίτηση όπου ταιριάζεις.", en: "Browse other open campaigns and apply where you fit." },
    { el: "Ενημέρωσε στατιστικά και δείγματα στο προφίλ σου.", en: "Refresh your stats and samples on your profile." },
  ],
  campaign_accepted_creator: [
    { el: "Άνοιξε τη συνεργασία στο dashboard → Προτάσεις.", en: "Open the collaboration under Dashboard → Proposals." },
    { el: "Συζήτησε λεπτομέρειες στο chat και συμφωνήστε brief/ημερομηνίες.", en: "Align details in chat (brief, dates)." },
    { el: "Όταν είσαι έτοιμος, υπέβαλε το link παράδοσης από τις Καμπάνιες.", en: "When ready, submit the deliverable link from Campaigns." },
  ],
  campaign_accepted_brand: [
    { el: "Άνοιξε τη συνεργασία από Προτάσεις/Καμπάνιες.", en: "Open the collaboration from Proposals/Campaigns." },
    { el: "Στείλε brief στο chat (στόχος, μήνυμα, hashtags, do & don’ts).", en: "Send a brief in chat (goal, message, hashtags, do & don’ts)." },
    { el: "Όταν ο δημιουργός υποβάλει παράδοση, ενέκρινε ή ζήτησε αλλαγές.", en: "When they submit a deliverable, approve or request changes." },
  ],
  campaign_review_creator: [
    { el: "Δες την αξιολόγηση στο δημόσιο προφίλ σου.", en: "View the review on your public profile." },
    { el: "Συνέχισε με ανοιχτές καμπάνιες ή νέες προτάσεις.", en: "Keep applying to open campaigns or new proposals." },
  ],
  campaign_removed_creator: [
    { el: "Η συγκεκριμένη αίτηση δεν είναι πλέον ενεργή.", en: "That application is no longer active." },
    { el: "Δες άλλες ανοιχτές καμπάνιες και κάνε αίτηση.", en: "Browse other open campaigns and apply." },
  ],
  campaign_closed_brand: [
    { el: "Δες τις αιτήσεις/συνεργασίες που έμειναν ενεργές.", en: "Review remaining applications/collaborations." },
    { el: "Όσοι δεν επιλέχθηκαν ενημερώνονται αυτόματα.", en: "Non-selected creators are notified automatically." },
    { el: "Άνοιξε νέα καμπάνια ή προσκάλεσε δημιουργούς από τον κατάλογο.", en: "Open a new campaign or invite from the directory." },
  ],
  campaign_not_selected_creator: [
    { el: "Δες άλλες ανοιχτές καμπάνιες στο Influo.", en: "Browse other open campaigns on Influo." },
    { el: "Κάνε αίτηση όπου ταιριάζει το προφίλ σου.", en: "Apply where your profile fits." },
  ],
  campaign_closing_soon_brand: [
    { el: "Άνοιξε τις αιτήσεις πριν κλείσει η καμπάνια.", en: "Open applications before the campaign closes." },
    { el: "Shortlist / αποδοχή / απόρριψη ώστε να ξέρουν οι δημιουργοί.", en: "Shortlist, accept, or reject so creators know where they stand." },
    { el: "Αν χρειάζεσαι χρόνο, απάντησε τουλάχιστον με shortlist.", en: "If you need time, at least shortlist promising ones." },
  ],
  campaign_pending_apps_brand: [
    { el: "Άνοιξε τις Καμπάνιες και δες τις αναπάντητες αιτήσεις.", en: "Open Campaigns and review unanswered applications." },
    { el: "Shortlist, αποδοχή ή απόρριψη — οι δημιουργοί περιμένουν.", en: "Shortlist, accept, or reject — creators are waiting." },
    { el: "Για διευκρινίσεις, χρησιμοποίησε το chat.", en: "Use chat for clarifications." },
  ],
  campaign_deliverable_brand: [
    { el: "Άνοιξε τις Καμπάνιες και δες το link παράδοσης.", en: "Open Campaigns and check the deliverable link." },
    { el: "Εγκρίνε ή ζήτησε αλλαγές με σύντομο σχόλιο.", en: "Approve or request changes with a short note." },
    { el: "Ο δημιουργός ενημερώνεται αυτόματα με email.", en: "The creator is notified by email automatically." },
  ],
  campaign_deliverable_approved_creator: [
    { el: "Δες την ενημέρωση στις Καμπάνιες του dashboard.", en: "Check the update under Dashboard → Campaigns." },
    { el: "Ολοκλήρωσε τυχόν υπόλοιπα βήματα της συνεργασίας (chat/αξιολόγηση).", en: "Finish any remaining steps (chat/review)." },
  ],
  campaign_deliverable_changes_creator: [
    { el: "Διάβασε τι ζητήθηκε στις Καμπάνιες / στο σχόλιο.", en: "Read the requested changes in Campaigns / the note." },
    { el: "Κάνε τις αλλαγές και υπέβαλε ξανά το link παράδοσης.", en: "Make the changes and resubmit the deliverable link." },
    { el: "Για απορίες, γράψε στην επιχείρηση από τα Μηνύματα.", en: "Ask the brand in Messages if anything is unclear." },
  ],
  proposal_new_creator: [
    { el: "Άνοιξε την πρόταση από dashboard → Προτάσεις.", en: "Open the proposal under Dashboard → Proposals." },
    { el: "Αποδέξου, απόρριψε ή στείλε αντιπρόταση.", en: "Accept, reject, or send a counter-offer." },
    { el: "Για απορίες, γράψε στην επιχείρηση από τα Μηνύματα.", en: "Ask questions in Messages." },
  ],
  proposal_brand_confirmation: [
    { el: "Περίμενε απάντηση του δημιουργού (αποδοχή / απόρριψη / αντιπρόταση).", en: "Wait for the creator (accept / reject / counter)." },
    { el: "Μπορείς να δεις την πρόταση και να στείλεις brief από τα Μηνύματα.", en: "You can view the proposal and send a brief in Messages." },
  ],
  proposal_accepted_brand: [
    { el: "Άνοιξε την πρόταση και αποδέξου τη σύνοψη συμφωνίας.", en: "Open the proposal and accept the agreement summary." },
    { el: "Στείλε brief και υλικό από τα Μηνύματα.", en: "Send brief and assets in Messages." },
    { el: "Συμφωνήστε ημερομηνία παράδοσης/δημοσίευσης.", en: "Agree a delivery/publish date." },
  ],
  proposal_rejected_brand: [
    { el: "Δες παρόμοιους δημιουργούς στον κατάλογο.", en: "Browse similar creators in the directory." },
    { el: "Στείλε νέα πρόταση ή άνοιξε καμπάνια.", en: "Send a new proposal or open a campaign." },
  ],
  counter_new_brand: [
    { el: "Άνοιξε την πρόταση και δες το νέο ποσό.", en: "Open the proposal and review the new amount." },
    { el: "Αποδέξου ή απόρριψε την αντιπρόταση.", en: "Accept or reject the counter-offer." },
    { el: "Για αλλαγές παραδοτέων, συζήτησέ το στο chat.", en: "Discuss deliverable changes in chat." },
  ],
  counter_accepted_creator: [
    { el: "Άνοιξε την πρόταση και αποδέξου τη σύνοψη συμφωνίας.", en: "Open the proposal and accept the agreement summary." },
    { el: "Συζήτησε λεπτομέρειες στο chat με την επιχείρηση.", en: "Align details with the brand in chat." },
  ],
  counter_rejected_creator: [
    { el: "Η αρχική πρόταση παραμένει ανοιχτή — μπορείς ακόμη να την αποδεχτείς.", en: "The original proposal is still open — you can still accept it." },
    { el: "Άνοιξε την πρόταση για να απαντήσεις.", en: "Open the proposal to respond." },
  ],
  agreement_waiting: [
    { el: "Άνοιξε την πρόταση και αποδέξου τη σύνοψη συμφωνίας.", en: "Open the proposal and accept the agreement summary." },
    { el: "Μόλις αποδεχτούν και οι δύο, ξεκινά η συνεργασία.", en: "Once both accept, the collaboration starts." },
  ],
  agreement_reminder: [
    { el: "Άνοιξε την πρόταση και διάβασε τη σύνοψη συμφωνίας (πακέτο, αμοιβή, προθεσμία).", en: "Open the proposal and read the agreement summary (package, fee, deadline)." },
    { el: "Αν συμφωνείς, πάτα «Αποδοχή συμφωνίας» για να ξεκινήσει η συνεργασία.", en: "If you agree, tap Accept agreement so the collaboration can start." },
    { el: "Αν θέλεις αλλαγές, γράψε στην άλλη πλευρά από τα Μηνύματα του Influo.", en: "If you want changes, message the other side in Influo Chat." },
  ],
  collaboration_complete_creator: [
    { el: "Δες τη συνεργασία στο προφίλ/dashboard σου.", en: "View the collaboration on your profile/dashboard." },
    { el: "Συντόνισε παράδοση και ημερομηνίες στο chat.", en: "Coordinate delivery and dates in chat." },
  ],
  deal_complete_creator: [
    { el: "Συντόνισε brief, υλικό και ημερομηνία δημοσίευσης στο chat.", en: "Align brief, assets, and publish date in chat." },
    { el: "Ζήτησε προκαταβολή πριν ξεκινήσεις — το Influo δεν μεσολαβεί στην πληρωμή.", en: "Ask for a deposit before you start — Influo does not handle payment." },
    { el: "Κράτα αυτό το email ως αντίγραφο της συμφωνίας.", en: "Keep this email as a copy of the agreement." },
  ],
  deal_complete_brand: [
    { el: "Στείλε brief και υλικό από τα Μηνύματα του Influo.", en: "Send the brief and assets via Influo Messages." },
    { el: "Συμφωνήστε ημερομηνία παράδοσης/δημοσίευσης με τον δημιουργό.", en: "Agree a delivery/publish date with the creator." },
  ],
  review_reminder_brand: [
    { el: "Άνοιξε το προφίλ του δημιουργού → Reviews και άφησε βαθμολογία.", en: "Open the creator’s profile → Reviews and leave a rating." },
    { el: "Αν σας άρεσε, αναφέρετε το Influo (@influo.gr) στην ανάρτηση.", en: "If you liked it, mention Influo (@influo.gr) in the post." },
  ],
  review_reminder_creator: [
    { el: "Αν σου άρεσε η εμπειρία, tag @influo.gr σε story ή video.", en: "If you enjoyed it, tag @influo.gr in a story or video." },
    { el: "Μπορείς να βάλεις τον σύνδεσμο του προφίλ σου στο bio σου.", en: "You can add your profile link to your bio." },
  ],
  agreement_complete_admin: [
    { el: "Άνοιξε τη διαχείριση και έλεγξε τη συμφωνία.", en: "Open admin and review the agreement." },
  ],
  admin_event: [
    { el: "Άνοιξε τη διαχείριση (/admin) για λεπτομέρειες.", en: "Open admin (/admin) for details." },
  ],
  message_summary: [
    { el: "Πάτα «Άνοιγμα συνομιλίας» και διάβασε τα μηνύματα στην εφαρμογή.", en: "Tap Open conversation and read the messages in the app." },
    { el: "Απάντησε από τα Μηνύματα του Influo (όχι με reply σε αυτό το email).", en: "Reply in Influo Messages (don’t reply to this email)." },
  ],
  admin_message_summary: [
    { el: "Άνοιξε τη διαχείριση και δες τη συνομιλία.", en: "Open admin and review the conversation." },
  ],
  password_reset: [
    { el: "Πάτα το κουμπί επαναφοράς και όρισε νέο κωδικό.", en: "Tap the reset button and set a new password." },
    { el: "Ο σύνδεσμος ισχύει για 1 ώρα· αν δεν το ζήτησες, αγνόησε το email.", en: "The link lasts 1 hour; ignore if you didn’t request it." },
  ],
  announcement: [
    { el: "Άνοιξε το Influo από τον σύνδεσμο.", en: "Open Influo from the link." },
    { el: "Δες την ανακοίνωση στο dashboard σου.", en: "Read the announcement on your dashboard." },
  ],
  stats_update: [
    { el: "Άνοιξε το προφίλ σου και έλεγξε τα νέα στατιστικά.", en: "Open your profile and check the updated stats." },
    { el: "Αν λείπουν πακέτα/δεξιότητες, πρόσθεσέ τα από το dashboard.", en: "If packages/skills are missing, add them from the dashboard." },
  ],
  top10_congrats: [
    { el: "Δες το προφίλ σου και μοιράσου τη διάκρισή σου αν θέλεις.", en: "View your profile and share the recognition if you like." },
    { el: "Κράτα στατιστικά και δείγματα ενημερωμένα.", en: "Keep stats and samples up to date." },
  ],
  brand_weekly_digest: [
    { el: "Άνοιξε τα προφίλ που σε ενδιαφέρουν.", en: "Open the profiles that interest you." },
    { el: "Στείλε πρόταση ή προσκάλεσε σε καμπάνια από το brand dashboard.", en: "Send a proposal or invite them to a campaign from your brand dashboard." },
  ],
  signup_influencer: [
    { el: "Ολοκλήρωσε το προφίλ σου (βιογραφικό, πλατφόρμες, δείγματα).", en: "Complete your profile (bio, platforms, samples)." },
    { el: "Περίμενε έγκριση· θα λάβεις email όταν γίνεις live.", en: "Wait for approval; you’ll get an email when you’re live." },
  ],
  signup_admin: [
    { el: "Άνοιξε τη διαχείριση και έλεγξε το νέο προφίλ.", en: "Open admin and review the new profile." },
    { el: "Έγκρινε ή ζήτησε διορθώσεις πριν γίνει δημόσιο.", en: "Approve or request fixes before it goes public." },
  ],
  signup_brand_admin: [
    { el: "Άνοιξε τη διαχείριση brands και έλεγξε τον νέο λογαριασμό.", en: "Open brand admin and review the new account." },
    { el: "Επαλήθευσε αν χρειάζεται πριν ανοίξουν καμπάνιες.", en: "Verify if needed before they open campaigns." },
  ],
  profile_approved: [
    { el: "Μπες στο dashboard και συμπλήρωσε πακέτα/δείγματα αν λείπουν.", en: "Open the dashboard and finish packages/samples if missing." },
    { el: "Δες ανοιχτές καμπάνιες και κάνε αίτηση όπου ταιριάζεις.", en: "Browse open campaigns and apply where you fit." },
    { el: "Τα brands μπορούν πλέον να σε βρουν στον κατάλογο.", en: "Brands can now find you in the directory." },
  ],
  brand_verified: [
    { el: "Μπες στο brand dashboard και δημιούργησε καμπάνια ή πρόταση.", en: "Open the brand dashboard and create a campaign or proposal." },
    { el: "Βρες δημιουργούς από τον κατάλογο.", en: "Find creators in the directory." },
  ],
  account_deleted: [
    { el: "Ο λογαριασμός διαγράφηκε· δεν χρειάζεται άλλη ενέργεια.", en: "The account is deleted; no further action needed." },
    { el: "Αν ήταν λάθος, επικοινώνησε με την υποστήριξη.", en: "If this was a mistake, contact support." },
  ],
  account_deleted_admin: [
    { el: "Καταγράφηκε η διαγραφή· δεν απαιτείται ενέργεια εκτός αν υπάρχει follow-up.", en: "Deletion logged; no action unless follow-up is needed." },
  ],
  unapproved_admin_alert: [
    { el: "Άνοιξε τη διαχείριση και έλεγξε τα μη εγκεκριμένα προφίλ.", en: "Open admin and review unapproved profiles." },
  ],
  ticket_user_autoreply: [
    { el: "Κράτα αυτό το email· η ομάδα θα απαντήσει στο ίδιο θέμα.", en: "Keep this email; the team will reply on the same thread." },
    { el: "Αν έχεις νέα στοιχεία, απάντησε στο ticket από το Influo ή το email υποστήριξης.", en: "Add details via your Influo ticket or support email." },
  ],
  ticket_admin_new: [
    { el: "Άνοιξε το ticket στη διαχείριση και απάντησε.", en: "Open the ticket in admin and reply." },
  ],
  ticket_admin_reply: [
    { el: "Διάβασε την απάντηση και συνέχισε από το ticket αν χρειάζεται.", en: "Read the reply and continue from the ticket if needed." },
  ],
  ticket_user_reply: [
    { el: "Άνοιξε το ticket στη διαχείριση και συνέχισε τη συνομιλία.", en: "Open the ticket in admin and continue the thread." },
  ],
  contact_admin: [
    { el: "Διάβασε το μήνυμα και απάντησε από το κατάλληλο κανάλι υποστήριξης.", en: "Read the message and reply via the right support channel." },
  ],
  data_quality_creator: [
    { el: "Άνοιξε το dashboard και διόρθωσε τα σημεία που αναφέρονται.", en: "Open the dashboard and fix the listed items." },
    { el: "Αποθήκευσε αλλαγές ώστε το προφίλ να φαίνεται πλήρες στα brands.", en: "Save changes so brands see a complete profile." },
  ],
  profile_edit_admin: [
    { el: "Άνοιξε τη διαχείριση και έλεγξε τις αλλαγές προφίλ.", en: "Open admin and review the profile changes." },
  ],
};

function escapeHtml(value: string): string {
  return String(value || "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

/**
 * Renders a mobile-friendly bilingual next-steps box.
 * Pass 2–4 steps; extras are truncated to keep emails short.
 */
export function nextStepsHtml(steps: NextStep[], opts?: { titleEl?: string; titleEn?: string }): string {
  const titleEl = opts?.titleEl || "Τι κάνω τώρα;";
  const titleEn = opts?.titleEn || "What to do next";
  const list = (steps || []).filter((s) => s?.el?.trim()).slice(0, 4);
  if (!list.length) return "";
  const items = list
    .map(
      (s) =>
        `<li style="margin:0 0 8px 0;padding:0;">${escapeHtml(s.el.trim())}${
          s.en?.trim()
            ? `<br/><span style="font-size:12px;color:#64748b;line-height:1.45;">${escapeHtml(s.en.trim())}</span>`
            : ""
        }</li>`
    )
    .join("");
  return `<div role="note" style="margin:20px 0;background:#f0f9ff;border:1px solid #bae6fd;border-radius:8px;padding:14px 16px;">
  <p style="margin:0 0 2px 0;font-size:14px;font-weight:700;color:#0c4a6e;">${escapeHtml(titleEl)}</p>
  <p style="margin:0 0 10px 0;font-size:12px;color:#64748b;">${escapeHtml(titleEn)}</p>
  <ol style="margin:0;padding-left:18px;color:#1f2937;font-size:13px;line-height:1.5;">${items}</ol>
</div>`;
}

/** Lookup + render from the shared catalog. */
export function emailNextSteps(key: EmailNextStepsKey): string {
  return nextStepsHtml(EMAIL_NEXT_STEPS[key]);
}

/** All catalog keys (for tests / preview generation). */
export function allEmailNextStepsKeys(): EmailNextStepsKey[] {
  return Object.keys(EMAIL_NEXT_STEPS) as EmailNextStepsKey[];
}
