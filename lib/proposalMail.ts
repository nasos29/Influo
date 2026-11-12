import { Resend } from "resend";
import { AGREEMENT_TERMS } from "@/lib/agreementTermsCopy";
import { displayServiceType } from "@/lib/campaignServiceLabel";
import { logEmail } from "@/lib/deliveryLog";
import { emailNextSteps } from "@/lib/emailNextSteps";
import { formatAthensDateTime, formatDate } from "@/lib/formatDateTime";
import { formatEuroAmount } from "@/lib/formatEuro";
import { formatProposalExtrasLine } from "@/lib/proposalFloor";
import { escapeHtml } from "@/lib/proposalParty";

function euroHtml(amount: unknown): string {
  const formatted = formatEuroAmount(amount);
  if (formatted) return formatted;
  const raw = String(amount ?? "").replace(/€/g, "").trim();
  return raw ? `${escapeHtml(raw)} €` : "—";
}

const SENDER = "Influo <noreply@influo.gr>";

export function siteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL || "https://influo.gr").replace(/\/$/, "");
}

function adminEmail(): string {
  return (process.env.ADMIN_EMAIL || "nd.6@hotmail.com").trim();
}

export function brandLink(email: string, hasAccount: boolean): string {
  const target = hasAccount
    ? `/login?redirect=${encodeURIComponent("/brand/dashboard?tab=proposals")}&email=${encodeURIComponent(email)}`
    : `/brand/signup?email=${encodeURIComponent(email)}`;
  return `${siteUrl()}${target}`;
}

export async function send(type: string, to: string | null | undefined, subject: string, html: string): Promise<void> {
  await sendChecked(type, to, subject, html);
}

/** Like send, but reports the outcome; "quota" = provider daily/rate limit reached. */
export async function sendChecked(type: string, to: string | null | undefined, subject: string, html: string): Promise<"ok" | "quota" | "error"> {
  const address = (to || "").trim();
  const key = process.env.RESEND_API_KEY;
  if (!address || !address.includes("@") || !key) {
    logEmail(type, false);
    return "error";
  }
  try {
    const resend = new Resend(key);
    const { error } = await resend.emails.send({
      from: SENDER,
      to: [address],
      subject: subject.replace(/[\r\n]/g, " ").slice(0, 180),
      html,
    });
    if (error) console.error("[mail]", type, error.message);
    logEmail(type, !error);
    if (!error) return "ok";
    const name = String((error as { name?: string }).name || "");
    return /quota|rate_limit|daily/i.test(`${name} ${error.message}`) ? "quota" : "error";
  } catch (err) {
    console.error("[mail]", type, err instanceof Error ? err.message : "send failed");
    logEmail(type, false);
    return "error";
  }
}

export function shell(title: string, body: string): string {
  return `<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; font-size: 14px; line-height: 1.6; color: #1f2937; max-width: 600px; margin: 0 auto;">
    <div style="padding: 24px 24px 0;"><h1 style="font-size: 20px; margin: 0;">${title}</h1></div>
    <div style="padding: 16px 24px 24px;">${body}
      <p style="margin-top: 24px; font-size: 12px; color: #9ca3af;">Η ομάδα του Influo</p>
    </div>
  </div>`;
}

type DealInfo = {
  proposalId?: string | number;
  extras?: unknown;
  publishDeadline?: string | null;
};

function creatorProposalsUrl(): string {
  return `${siteUrl()}/dashboard?tab=proposals`;
}

export function todayAthens(): string {
  return formatDate(new Date().toISOString(), "el");
}

/** Shared summary: package (+extras) · X € · date · publish deadline. */
function summaryBlockHtml(input: DealInfo & { service: string; budget: unknown; label?: string }): string {
  const extrasLine = formatProposalExtrasLine(input.extras, "el");
  const extrasText = extrasLine ? extrasLine.replace(/^Extras:\s*/, "") : "";
  const pkg = [displayServiceType(input.service, "el") || input.service, extrasText].filter(Boolean).join(" + ") || "—";
  const amount = formatEuroAmount(input.budget, "el", 0) || euroHtml(input.budget);
  const deadline = formatDate(input.publishDeadline, "el") || "κατόπιν συνεννόησης";
  const id = input.proposalId != null && input.proposalId !== "" ? `<strong>Αριθμός:</strong> #${escapeHtml(String(input.proposalId))}<br/>` : "";
  return `<p style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px 14px;">${id}<strong>Πακέτο:</strong> ${escapeHtml(pkg)}<br/>
<strong>${escapeHtml(input.label || "Ποσό")}:</strong> ${escapeHtml(amount)}<br/>
<strong>Ημερομηνία:</strong> ${escapeHtml(todayAthens())}<br/>
<strong>Προθεσμία δημοσίευσης:</strong> ${escapeHtml(deadline)}</p>`;
}

export function tipsHtml(lines: string[]): string {
  return `<p style="margin-top: 16px;"><strong>💡 Συμβουλές:</strong><br/>${lines.map((l) => `• ${l}`).join("<br/>")}</p>`;
}

export function intEuro(amount: unknown): string {
  return formatEuroAmount(amount, "el", 0) || String(amount ?? "").trim();
}

/** Plain admin notice: factual lines and one link to /admin. No tips, no emoji. */
export async function mailAdminEvent(type: string, subject: string, title: string, rows: Array<[string, unknown]>): Promise<void> {
  try {
    const lines = rows
      .filter(([, value]) => value != null && String(value).trim() !== "")
      .map(([label, value]) => `<strong>${escapeHtml(label)}:</strong> ${escapeHtml(String(value))}`)
      .join("<br/>");
    await send(
      type,
      adminEmail(),
      subject,
      `<div style="font-family: Arial, sans-serif; font-size: 14px; line-height: 1.6; color: #1f2937; max-width: 600px;">
        <p><strong>${escapeHtml(title)}</strong></p>
        <p>${lines}</p>
        <p><a href="${siteUrl()}/admin">${siteUrl()}/admin</a></p>
        ${emailNextSteps("admin_event")}
      </div>`
    );
  } catch (err) {
    console.error("[mail admin]", type, err instanceof Error ? err.message : "failed");
  }
}

function adminDealRows(input: DealInfo & { brandName: string; influencerName: string; service: string; budget: unknown }): Array<[string, unknown]> {
  return [
    ["Πρόταση", input.proposalId != null && input.proposalId !== "" ? `#${input.proposalId}` : null],
    ["Επιχείρηση", input.brandName],
    ["Δημιουργός", input.influencerName],
    ["Υπηρεσία", displayServiceType(input.service, "el") || input.service],
    ["Ποσό", intEuro(input.budget)],
    ["Ημερομηνία", todayAthens()],
  ];
}

export async function mailNewProposal(input: DealInfo & {
  influencerEmail: string | null;
  influencerName: string;
  brandEmail: string;
  brandName: string;
  service: string;
  budget: string;
  message: string;
  brandHasAccount?: boolean;
  /** Set when the proposal is a brand invite to one of its campaigns. */
  campaignTitle?: string | null;
}): Promise<void> {
  const influencerName = escapeHtml(input.influencerName);
  const campaignTitle = (input.campaignTitle || "").trim();
  const brandName = escapeHtml(input.brandName);
  const service = escapeHtml(input.service);
  const message = escapeHtml(input.message).replace(/\n/g, "<br/>");
  const note = message
    ? `<p style="margin: 12px 0 0; white-space: pre-wrap;">${message}</p>`
    : "";
  const quote = message ? `<p><strong>Μήνυμα της επιχείρησης:</strong></p><blockquote style="margin: 0; padding-left: 12px; border-left: 3px solid #e2e8f0; color: #475569;">${message}</blockquote>` : "";

  await Promise.all([
  send(
    "proposal_new",
    input.influencerEmail,
    campaignTitle
      ? `Πρόσκληση σε καμπάνια από ${input.brandName}: ${campaignTitle} – ${intEuro(input.budget)}`
      : `Νέα πρόταση συνεργασίας από ${input.brandName} – ${intEuro(input.budget)}`,
    shell(
      campaignTitle ? "Πρόσκληση σε καμπάνια" : "Νέα πρόταση συνεργασίας",
      `<p>Γεια σου ${influencerName},</p>
       ${campaignTitle
         ? `<p>Η <strong>${brandName}</strong> σε προσκαλεί στην καμπάνια <strong>«${escapeHtml(campaignTitle)}»</strong> (${escapeHtml(todayAthens())}).</p>`
         : `<p>Η <strong>${brandName}</strong> σού έστειλε πρόταση συνεργασίας στις ${escapeHtml(todayAthens())}.</p>`}
       ${summaryBlockHtml(input)}
       ${quote}
       ${buttonHtml(creatorProposalsUrl(), "Δες την πρόταση")}
       ${emailNextSteps("proposal_new_creator")}
       ${tipsHtml([
         "Απάντησε όσο πιο γρήγορα μπορείς.",
         "Αν η τιμή ή τα παραδοτέα δεν σου ταιριάζουν, στείλε αντιπρόταση αντί να απορρίψεις.",
         "Για απορίες γράψε στην επιχείρηση από τα μηνύματα του Influo.",
       ])}`
    )
  ),
  send(
    "proposal_brand_confirmation",
    input.brandEmail,
    `Η πρόταση στάλθηκε στον/στην ${input.influencerName}`,
    shell(
      "Η πρόταση στάλθηκε",
      `<p>Γεια σας ${brandName},</p>
       <p>Η πρότασή σας προς <strong>${influencerName}</strong> στάλθηκε στις ${escapeHtml(todayAthens())}.</p>
       ${summaryBlockHtml(input)}
       <p><strong>Τι ακολουθεί:</strong> ο/η δημιουργός μπορεί να αποδεχτεί, να απορρίψει ή να στείλει αντιπρόταση. Θα ενημερωθείτε με email.</p>
       ${buttonHtml(brandLink(input.brandEmail, input.brandHasAccount ?? true), "Δείτε την πρόταση")}
       ${emailNextSteps("proposal_brand_confirmation")}
       ${tipsHtml([
         "Στείλτε στα μηνύματα ένα σύντομο brief (στόχος, βασικό μήνυμα, hashtags/tags, do &amp; don'ts, παραδείγματα), ώστε το περιεχόμενο να βγει όπως το θέλετε.",
       ])}`
    )
  ),
  send(
    "proposal_admin",
    adminEmail(),
    campaignTitle
      ? `Πρόσκληση σε καμπάνια: ${input.brandName} προς ${input.influencerName} (${campaignTitle})`
      : `Νέα πρόταση από ${input.brandName} προς ${input.influencerName}`,
    shell(
      campaignTitle ? "Πρόσκληση σε καμπάνια" : "Νέα πρόταση",
      `${campaignTitle ? `<p><strong>Καμπάνια:</strong> ${escapeHtml(campaignTitle)}</p>` : ""}<p><strong>Brand:</strong> ${brandName}<br/>
        <strong>Email:</strong> ${escapeHtml(input.brandEmail)}<br/>
        <strong>Influencer:</strong> ${influencerName}<br/>
        <strong>Υπηρεσία:</strong> ${service}<br/>
        <strong>Budget:</strong> ${euroHtml(input.budget)}</p>
       ${note}
       <p><a href="${siteUrl()}/admin">Admin</a></p>
       ${emailNextSteps("admin_event")}`
    )
  ),
  ]);
}

export async function mailProposalDecision(input: DealInfo & {
  accepted: boolean;
  brandEmail: string | null;
  brandName: string;
  influencerName: string;
  brandHasAccount: boolean;
  service: string;
  budget: string;
}): Promise<void> {
  const brandName = escapeHtml(input.brandName);
  const influencerName = escapeHtml(input.influencerName);
  const link = brandLink(input.brandEmail || "", input.brandHasAccount);
  const cta = input.brandHasAccount ? "Αποδοχή συμφωνίας" : "Δημιουργία λογαριασμού";
  const body = input.accepted
    ? `<p>Γεια σας ${brandName},</p>
       <p>Ο/Η <strong>${influencerName}</strong> αποδέχτηκε την πρότασή σας στις ${escapeHtml(todayAthens())}.</p>
       ${summaryBlockHtml(input)}
       <p><strong>Επόμενα βήματα:</strong><br/>
       1) Αποδεχτείτε τη σύνοψη συμφωνίας για να κλείσει η συνεργασία.<br/>
       2) Στείλτε brief και υλικό (προϊόν, links, tags) από τα μηνύματα του Influo.<br/>
       3) Συμφωνήστε ημερομηνία παράδοσης/δημοσίευσης και τυχόν έγκριση πριν το post.</p>
       ${buttonHtml(link, cta)}
       ${emailNextSteps("proposal_accepted_brand")}`
    : `<p>Γεια σας ${brandName},</p>
       <p>Ο/Η <strong>${influencerName}</strong> απέρριψε την πρότασή σας στις ${escapeHtml(todayAthens())}.</p>
       ${summaryBlockHtml(input)}
       <p>Η πρόταση έκλεισε. Δείτε παρόμοιους δημιουργούς για την καμπάνια σας.</p>
       ${buttonHtml(`${siteUrl()}/directory`, "Βρες δημιουργούς")}
       ${emailNextSteps("proposal_rejected_brand")}`;
  await send(
    input.accepted ? "proposal_accepted" : "proposal_rejected",
    input.brandEmail,
    input.accepted
      ? `Ο/Η ${input.influencerName} αποδέχτηκε την πρότασή σας`
      : `Ο/Η ${input.influencerName} απέρριψε την πρότασή σας`,
    shell(input.accepted ? "Η πρόταση έγινε αποδεκτή" : "Η πρόταση απορρίφθηκε", body)
  );
  await mailAdminEvent(
    input.accepted ? "proposal_accepted_admin" : "proposal_rejected_admin",
    `Πρόταση ${input.accepted ? "αποδεκτή" : "απορρίφθηκε"}: ${input.influencerName} / ${input.brandName}`,
    input.accepted ? "Ο δημιουργός αποδέχτηκε πρόταση" : "Ο δημιουργός απέρριψε πρόταση",
    adminDealRows(input)
  );
}

export async function mailCounter(input: DealInfo & {
  brandEmail: string | null;
  brandName: string;
  influencerName: string;
  service: string;
  budget: string;
  counterBudget: string;
  counterMessage: string;
  brandHasAccount: boolean;
}): Promise<void> {
  const link = brandLink(input.brandEmail || "", input.brandHasAccount);
  const comment = input.counterMessage
    ? `<p><strong>Σχόλιο:</strong> ${escapeHtml(input.counterMessage).replace(/\n/g, "<br/>")}</p>`
    : "";
  await send(
    "counter_new",
    input.brandEmail,
    `Αντιπρόταση από ${input.influencerName}: ${intEuro(input.counterBudget)}`,
    shell(
      "Νέα αντιπρόταση",
      `<p>Γεια σας ${escapeHtml(input.brandName)},</p>
       <p>Ο/Η <strong>${escapeHtml(input.influencerName)}</strong> έστειλε αντιπρόταση στις ${escapeHtml(todayAthens())}.</p>
       <p><strong>Αρχική πρόταση:</strong> ${escapeHtml(intEuro(input.budget))} → <strong>Αντιπρόταση:</strong> ${escapeHtml(intEuro(input.counterBudget))}</p>
       ${summaryBlockHtml({ ...input, budget: input.counterBudget, label: "Ποσό αντιπρότασης" })}
       ${comment}
       ${buttonHtml(link, input.brandHasAccount ? "Απαντήστε στην αντιπρόταση" : "Δημιουργία λογαριασμού")}
       ${emailNextSteps("counter_new_brand")}
       ${tipsHtml([
         "Μπορείτε να την αποδεχτείτε ή να την απορρίψετε (η αρχική πρόταση μένει ανοιχτή).",
         "Για αλλαγές στα παραδοτέα συζητήστε το στα μηνύματα του Influo.",
       ])}`
    )
  );
  await mailAdminEvent(
    "counter_admin",
    `Αντιπρόταση: ${input.influencerName} / ${input.brandName} – ${intEuro(input.counterBudget)}`,
    "Ο δημιουργός έστειλε αντιπρόταση",
    [...adminDealRows(input), ["Αντιπρόταση", intEuro(input.counterBudget)]]
  );
}

export async function mailCounterDecision(input: DealInfo & {
  accepted: boolean;
  influencerEmail: string | null;
  influencerName: string;
  brandName: string;
  service: string;
  budget: string;
}): Promise<void> {
  const brand = escapeHtml(input.brandName);
  const lead = input.accepted
    ? `<p>Η <strong>${brand}</strong> αποδέχτηκε την αντιπρότασή σου στις ${escapeHtml(todayAthens())}. Νέο ποσό: <strong>${escapeHtml(intEuro(input.budget))}</strong>.</p>
       <p><strong>Επόμενο βήμα:</strong> αποδοχή της σύνοψης συμφωνίας και από τις δύο πλευρές.</p>`
    : `<p>Η <strong>${brand}</strong> απέρριψε την αντιπρότασή σου στις ${escapeHtml(todayAthens())}. Η αρχική πρόταση (${escapeHtml(intEuro(input.budget))}) παραμένει ανοιχτή — μπορείς ακόμη να την αποδεχτείς.</p>`;
  await send(
    input.accepted ? "counter_accepted" : "counter_rejected",
    input.influencerEmail,
    `Η ${input.brandName} ${input.accepted ? "αποδέχτηκε" : "απέρριψε"} την αντιπρότασή σου`,
    shell(
      input.accepted ? "Η αντιπρόταση έγινε αποδεκτή" : "Η αντιπρόταση απορρίφθηκε",
      `<p>Γεια σου ${escapeHtml(input.influencerName)},</p>
       ${lead}
       ${summaryBlockHtml(input)}
       ${buttonHtml(creatorProposalsUrl(), "Άνοιξε την πρόταση")}
       ${emailNextSteps(input.accepted ? "counter_accepted_creator" : "counter_rejected_creator")}`
    )
  );
  await mailAdminEvent(
    input.accepted ? "counter_accepted_admin" : "counter_rejected_admin",
    `Αντιπρόταση ${input.accepted ? "αποδεκτή" : "απορρίφθηκε"}: ${input.brandName} / ${input.influencerName}`,
    input.accepted ? "Η επιχείρηση αποδέχτηκε αντιπρόταση" : "Η επιχείρηση απέρριψε αντιπρόταση",
    adminDealRows(input)
  );
}

function agreementDetailsHtml(input: {
  proposalId: string | number;
  service: string;
  budget: string;
  extras?: unknown;
  publishDeadline?: string | null;
}): string {
  const extrasLine = formatProposalExtrasLine(input.extras, "el");
  const extrasValue = extrasLine ? extrasLine.replace(/^Extras:\s*/, "") : "";
  const extrasRow = extrasValue ? `<br/><strong>Extras:</strong> ${escapeHtml(extrasValue)}` : "";
  const deadline = formatDate(input.publishDeadline, "el");
  const deadlineRow = deadline ? `<br/><strong>Προθεσμία δημοσίευσης:</strong> ${escapeHtml(deadline)}` : "";
  const deliverables = displayServiceType(input.service, "el") || "—";
  return `<p><strong>Αριθμός συμφωνίας:</strong> #${escapeHtml(String(input.proposalId))}<br/>
<strong>Παραδοτέα:</strong> ${escapeHtml(deliverables)}${extrasRow}<br/>
<strong>Συνολική αμοιβή:</strong> ${euroHtml(input.budget)}${deadlineRow}</p>`;
}

/** Full legal terms block (Greek), for the mutual-acceptance confirmation email. */
export function agreementTermsHtml(): string {
  const items = AGREEMENT_TERMS.el
    .map((term) => {
      const split = term.indexOf(". ");
      const heading = split === -1 ? term : term.slice(0, split);
      const body = split === -1 ? "" : term.slice(split + 2);
      return `<li style="margin: 0 0 10px 0;"><strong>${escapeHtml(heading)}.</strong> ${escapeHtml(body)}</li>`;
    })
    .join("");
  return `<div style="margin: 16px 0; padding: 14px 16px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px;">
    <p style="margin: 0 0 10px 0; font-weight: 700;">Όροι συμφωνίας</p>
    <ol style="margin: 0; padding-left: 20px;">${items}</ol>
  </div>`;
}

/**
 * Safety note for creators: Influo does not escrow/pay, so ask for a deposit.
 * Shown on agreement emails that go to creators.
 */
export function creatorPaymentSafetyHtml(): string {
  return `<div style="margin: 16px 0; padding: 14px 16px; background: #fffbeb; border: 1px solid #fcd34d; border-radius: 8px;">
    <p style="margin: 0 0 8px 0; font-weight: 700; color: #92400e;">Θέματα ασφαλείας &amp; πληρωμής</p>
    <p style="margin: 0; color: #78350f;">Το Influo φέρνει σε επαφή τις δύο πλευρές και καταγράφει τη συμφωνία, αλλά <strong>δεν μπαίνει στη μέση</strong> της συνεργασίας: δεν κρατά χρήματα, δεν πληρώνει για λογαριασμό κανενός και δεν εγγυάται την εκτέλεση. Συμφώνησε καθαρά με την επιχείρηση τον τρόπο πληρωμής και <strong>ζήτησε μέρος της αμοιβής σου ως προκαταβολή</strong> πριν ξεκινήσεις τη δουλειά — το υπόλοιπο μπορεί να καταβληθεί μετά τη δημοσίευση του εγκεκριμένου περιεχομένου.</p>
  </div>`;
}

/** Soft ask to tag/mention Influo after a finished collaboration. */
export function influoMentionHtml(opts?: { profileUrl?: string | null; forCreator?: boolean }): string {
  if (opts?.forCreator) {
    const profile = (opts.profileUrl || "").trim();
    const profileLine = profile
      ? ` ή βάλε τον σύνδεσμο του προφίλ σου στο bio σου: <a href="${escapeHtml(profile)}">${escapeHtml(profile)}</a>.`
      : ".";
    return `<p style="margin-top: 16px;"><strong>Μια μικρή χάρη:</strong> Αν σου άρεσε η εμπειρία μέσω Influo, ανάφερέ μας σε ένα story ή video (tag <strong>@influo.gr</strong>)${profileLine} Αν μας κάνεις tag, θα χαρούμε να το κοινοποιήσουμε κι εμείς.</p>`;
  }
  return `<p style="margin-top: 16px;"><strong>Μοιραστείτε το:</strong> Αν το περιεχόμενο σας άρεσε, μπορείτε να αναφέρετε το Influo στην ανάρτηση ή στο video (π.χ. «Συνεργασία μέσω <strong>@influo.gr</strong>») ή να βάλετε τον σύνδεσμο influo.gr. Θα χαρούμε να το προβάλουμε κι εμείς.</p>`;
}

export async function mailAgreement(input: {
  to: string | null;
  recipientName: string;
  otherName: string;
  service: string;
  budget: string;
  proposalId: string | number;
  extras?: unknown;
  publishDeadline?: string | null;
  toBrand: boolean;
  brandHasAccount: boolean;
}): Promise<void> {
  const link = input.toBrand
    ? brandLink(input.to || "", input.brandHasAccount)
    : creatorProposalsUrl();
  const safety = input.toBrand ? "" : creatorPaymentSafetyHtml();
  await send(
    "agreement_accepted",
    input.to,
    `Αναμένεται η αποδοχή σας – συμφωνία #${input.proposalId}`,
    shell(
      "Αναμένεται η αποδοχή σας",
      `<p>Γεια σας ${escapeHtml(input.recipientName)},</p>
       <p>Ο/Η <strong>${escapeHtml(input.otherName)}</strong> αποδέχτηκε τη σύνοψη συμφωνίας στις ${escapeHtml(todayAthens())}. Αποδεχτείτε κι εσείς για να ξεκινήσει η συνεργασία.</p>
       ${summaryBlockHtml(input)}
       ${safety}
       ${buttonHtml(link, input.toBrand && !input.brandHasAccount ? "Δημιουργία λογαριασμού" : "Αποδοχή συμφωνίας")}
       ${emailNextSteps("agreement_waiting")}
       ${tipsHtml(["Όλη η επικοινωνία μέσα από τα μηνύματα του Influo κρατά ιστορικό για κάθε συμφωνία."])}`
    )
  );
}

export async function mailCollaborationComplete(input: {
  influencerEmail: string | null;
  influencerName: string;
  brandName: string;
  proposalId: string | number;
  service: string;
  budget: string;
  extras?: unknown;
  publishDeadline?: string | null;
}): Promise<void> {
  const id = escapeHtml(String(input.proposalId));
  await send(
    "collaboration_complete",
    input.influencerEmail,
    `Η συμφωνία συνεργασίας #${input.proposalId} κλειδώθηκε`,
    shell(
      "Η συμφωνία κλειδώθηκε",
      `<p>Γεια σας ${escapeHtml(input.influencerName)},</p>
       <p>Και οι δύο πλευρές αποδέχτηκαν τη συμφωνία συνεργασίας <strong>#${id}</strong>. Η επιχείρηση <strong>${escapeHtml(input.brandName)}</strong> καταγράφεται στις συνεργασίες του προφίλ σας.</p>
       ${agreementDetailsHtml(input)}
       ${agreementTermsHtml()}
       ${creatorPaymentSafetyHtml()}
       ${emailNextSteps("collaboration_complete_creator")}`
    )
  );
}

/** Admin inbox only, after both sides have accepted. */
export async function mailAdminAgreementComplete(input: {
  proposalId: string | number;
  brandName: string;
  brandEmail: string;
  creatorName: string;
  profileUrl: string;
  service: string;
  budget: string;
  extras?: unknown;
  publishDeadline?: string | null;
  brandAcceptedAt?: string | null;
  creatorAcceptedAt?: string | null;
}): Promise<void> {
  const extrasLine = formatProposalExtrasLine(input.extras, "el");
  const extras = extrasLine ? extrasLine.replace(/^Extras:\s*/, "") : "";
  const deadline = formatDate(input.publishDeadline, "el") || "κατόπιν συνεννόησης";
  const id = escapeHtml(String(input.proposalId));
  await send(
    "agreement_complete_admin",
    adminEmail(),
    `Συμφωνία συνεργασίας #${input.proposalId} ολοκληρώθηκε`,
    shell(
      `Η συμφωνία συνεργασίας #${id} ολοκληρώθηκε`,
      `<p><strong>Αριθμός συμφωνίας:</strong> #${id}<br/>
        <strong>Επιχείρηση:</strong> ${escapeHtml(input.brandName)}<br/>
        <strong>Email επιχείρησης:</strong> ${escapeHtml(input.brandEmail)}<br/>
        <strong>Δημιουργός:</strong> ${escapeHtml(input.creatorName)}<br/>
        <strong>Προφίλ:</strong> <a href="${escapeHtml(input.profileUrl)}">${escapeHtml(input.profileUrl)}</a><br/>
        <strong>Παραδοτέα:</strong> ${escapeHtml(displayServiceType(input.service, "el") || "—")}<br/>
        <strong>Extras:</strong> ${escapeHtml(extras || "—")}<br/>
        <strong>Συνολική αμοιβή:</strong> ${euroHtml(input.budget)}<br/>
        <strong>Προθεσμία δημοσίευσης:</strong> ${escapeHtml(deadline)}<br/>
        <strong>Αποδοχή επιχείρησης:</strong> ${escapeHtml(formatAthensDateTime(input.brandAcceptedAt))}<br/>
        <strong>Αποδοχή δημιουργού:</strong> ${escapeHtml(formatAthensDateTime(input.creatorAcceptedAt))}</p>
       <p><a href="${siteUrl()}/admin">Άνοιγμα διαχείρισης</a></p>
       ${emailNextSteps("agreement_complete_admin")}`
    )
  );
}

export function buttonHtml(href: string, label: string): string {
  return `<p style="margin: 20px 0;"><a href="${escapeHtml(href)}" style="display: inline-block; background: #2563eb; color: #ffffff; text-decoration: none; font-weight: 600; padding: 10px 18px; border-radius: 8px;">${escapeHtml(label)}</a></p>`;
}

/** Creator email once both sides accepted the agreement (start of work — not a review ask). */
export async function mailCreatorDealComplete(input: {
  to: string | null;
  creatorName: string;
  brandName: string;
  completedAt: string;
  proposalId: string | number;
  service: string;
  budget: string;
  extras?: unknown;
  publishDeadline?: string | null;
  dashboardUrl: string;
}): Promise<void> {
  const brand = escapeHtml(input.brandName);
  const date = escapeHtml(formatDate(input.completedAt, "el"));
  await send(
    "deal_complete_creator",
    input.to,
    `Η συμφωνία με ${input.brandName} κλειδώθηκε – #${input.proposalId}`,
    shell(
      "Η συμφωνία κλειδώθηκε",
      `<p>Γεια σου ${escapeHtml(input.creatorName)},</p>
       <p>Και οι δύο πλευρές αποδέχτηκαν τη συμφωνία συνεργασίας στις ${date}. Η <strong>${brand}</strong> καταγράφεται πλέον στις συνεργασίες σου.</p>
       ${agreementDetailsHtml({
         proposalId: input.proposalId,
         service: input.service,
         budget: input.budget,
         extras: input.extras,
         publishDeadline: input.publishDeadline,
       })}
       ${agreementTermsHtml()}
       ${creatorPaymentSafetyHtml()}
       <p><strong>Επόμενα βήματα:</strong> συντόνισε brief, υλικό και ημερομηνία δημοσίευσης στα μηνύματα του Influo. Κράτα αυτό το email ως αντίγραφο της συμφωνίας.</p>
       ${buttonHtml(input.dashboardUrl, "Άνοιξε το dashboard")}
       ${emailNextSteps("deal_complete_creator")}
       <p>Καλή συνεργασία,</p>`
    )
  );
}

/** Brand email once both sides accepted the agreement (start of work — not a review ask). */
export async function mailBrandDealComplete(input: {
  to: string | null;
  brandName: string;
  creatorName: string;
  completedAt: string;
  proposalId: string | number;
  service: string;
  budget: string;
  extras?: unknown;
  publishDeadline?: string | null;
  dashboardUrl: string;
}): Promise<void> {
  const creator = escapeHtml(input.creatorName);
  const date = escapeHtml(formatDate(input.completedAt, "el"));
  await send(
    "deal_complete_brand",
    input.to,
    `Η συμφωνία με ${input.creatorName} κλειδώθηκε – #${input.proposalId}`,
    shell(
      "Η συμφωνία κλειδώθηκε",
      `<p>Γεια σας ${escapeHtml(input.brandName)},</p>
       <p>Και οι δύο πλευρές αποδέχτηκαν τη συμφωνία συνεργασίας με τον/την <strong>${creator}</strong> στις ${date}. Μπορείτε να προχωρήσετε στην εκτέλεση.</p>
       ${agreementDetailsHtml({
         proposalId: input.proposalId,
         service: input.service,
         budget: input.budget,
         extras: input.extras,
         publishDeadline: input.publishDeadline,
       })}
       ${agreementTermsHtml()}
       <p><strong>Επόμενα βήματα:</strong> στείλτε brief και υλικό (προϊόν, links, tags, do &amp; don'ts) από τα μηνύματα του Influo και συμφωνήστε ημερομηνία παράδοσης/δημοσίευσης.</p>
       ${buttonHtml(input.dashboardUrl, "Άνοιξε το dashboard")}
       ${emailNextSteps("deal_complete_brand")}
       <p>Με εκτίμηση,</p>`
    )
  );
}

/** Delayed review ask for the brand after the project window (publish deadline or fallback days). */
export async function mailBrandReviewReminder(input: {
  to: string | null;
  brandName: string;
  creatorName: string;
  creatorFemale: boolean | null;
  proposalId: string | number;
  service: string;
  budget: string;
  extras?: unknown;
  publishDeadline?: string | null;
  reviewUrl: string;
}): Promise<void> {
  const creator = escapeHtml(input.creatorName);
  const article = input.creatorFemale == null ? "τον/την" : input.creatorFemale ? "την" : "τον";
  await send(
    "review_reminder_brand",
    input.to,
    `Πώς πήγε η συνεργασία με ${input.creatorName};`,
    shell(
      "Ώρα για μια σύντομη αξιολόγηση",
      `<p>Γεια σας ${escapeHtml(input.brandName)},</p>
       <p>Η συμφωνημένη περίοδος για τη συνεργασία με τον/την <strong>${creator}</strong> (συμφωνία <strong>#${escapeHtml(String(input.proposalId))}</strong>) έχει περάσει. Αν το έργο ολοκληρώθηκε, μια σύντομη αξιολόγηση βοηθά άλλες επιχειρήσεις να βρουν τον κατάλληλο δημιουργό.</p>
       ${agreementDetailsHtml({
         proposalId: input.proposalId,
         service: input.service,
         budget: input.budget,
         extras: input.extras,
         publishDeadline: input.publishDeadline,
       })}
       ${buttonHtml(input.reviewUrl, `Αξιολογήστε ${article} ${input.creatorName}`)}
       ${emailNextSteps("review_reminder_brand")}
       ${influoMentionHtml({ forCreator: false })}
       <p>Αν η συνεργασία δεν έχει τελειώσει ακόμη, αγνοήστε αυτό το μήνυμα προς το παρόν.</p>
       <p>Με εκτίμηση,</p>`
    )
  );
}

/** Delayed wrap-up for the creator: thank-you + optional Influo mention (no fake brand-review CTA). */
export async function mailCreatorReviewReminder(input: {
  to: string | null;
  creatorName: string;
  brandName: string;
  proposalId: string | number;
  service: string;
  budget: string;
  extras?: unknown;
  publishDeadline?: string | null;
  profileUrl: string;
  dashboardUrl: string;
}): Promise<void> {
  const brand = escapeHtml(input.brandName);
  await send(
    "review_reminder_creator",
    input.to,
    `Πώς πήγε η συνεργασία με ${input.brandName};`,
    shell(
      "Η περίοδος της συνεργασίας ολοκληρώθηκε",
      `<p>Γεια σου ${escapeHtml(input.creatorName)},</p>
       <p>Η συμφωνημένη περίοδος για τη συνεργασία σου με την <strong>${brand}</strong> (συμφωνία <strong>#${escapeHtml(String(input.proposalId))}</strong>) έχει περάσει. Ελπίζουμε όλα να πήγαν καλά.</p>
       ${agreementDetailsHtml({
         proposalId: input.proposalId,
         service: input.service,
         budget: input.budget,
         extras: input.extras,
         publishDeadline: input.publishDeadline,
       })}
       ${buttonHtml(input.dashboardUrl, "Άνοιξε το dashboard")}
       ${emailNextSteps("review_reminder_creator")}
       ${influoMentionHtml({ forCreator: true, profileUrl: input.profileUrl })}
       <p>Αν η συνεργασία δεν έχει τελειώσει ακόμη, μπορείς να αγνοήσεις αυτό το μήνυμα προς το παρόν.</p>
       <p>Καλή συνέχεια,</p>`
    )
  );
}
