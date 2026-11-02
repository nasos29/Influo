import { Resend } from "resend";
import { displayServiceType } from "@/lib/campaignServiceLabel";
import { logEmail } from "@/lib/deliveryLog";
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
  const address = (to || "").trim();
  const key = process.env.RESEND_API_KEY;
  if (!address || !address.includes("@") || !key) {
    logEmail(type, false);
    return;
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
  } catch (err) {
    console.error("[mail]", type, err instanceof Error ? err.message : "send failed");
    logEmail(type, false);
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
       ${tipsHtml([
         "Στείλτε στα μηνύματα ένα σύντομο brief (στόχος, βασικό μήνυμα, hashtags/tags, do &amp; don'ts, παραδείγματα), ώστε το περιεχόμενο να βγει όπως το θέλετε.",
       ])}`
    )
  ),
  send(
    "proposal_admin",
    adminEmail(),
    `Νέα πρόταση από ${input.brandName} προς ${input.influencerName}`,
    shell(
      "Νέα πρόταση",
      `<p><strong>Brand:</strong> ${brandName}<br/>
        <strong>Email:</strong> ${escapeHtml(input.brandEmail)}<br/>
        <strong>Influencer:</strong> ${influencerName}<br/>
        <strong>Υπηρεσία:</strong> ${service}<br/>
        <strong>Budget:</strong> ${euroHtml(input.budget)}</p>
       ${note}
       <p><a href="${siteUrl()}/admin">Admin</a></p>`
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
       ${buttonHtml(link, cta)}`
    : `<p>Γεια σας ${brandName},</p>
       <p>Ο/Η <strong>${influencerName}</strong> απέρριψε την πρότασή σας στις ${escapeHtml(todayAthens())}.</p>
       ${summaryBlockHtml(input)}
       <p>Η πρόταση έκλεισε. Δείτε παρόμοιους δημιουργούς για την καμπάνια σας.</p>
       ${buttonHtml(`${siteUrl()}/directory`, "Βρες δημιουργούς")}`;
  await send(
    input.accepted ? "proposal_accepted" : "proposal_rejected",
    input.brandEmail,
    input.accepted
      ? `Ο/Η ${input.influencerName} αποδέχτηκε την πρότασή σας`
      : `Ο/Η ${input.influencerName} απέρριψε την πρότασή σας`,
    shell(input.accepted ? "Η πρόταση έγινε αποδεκτή" : "Η πρόταση απορρίφθηκε", body)
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
       ${tipsHtml([
         "Μπορείτε να την αποδεχτείτε ή να την απορρίψετε (η αρχική πρόταση μένει ανοιχτή).",
         "Για αλλαγές στα παραδοτέα συζητήστε το στα μηνύματα του Influo.",
       ])}`
    )
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
       ${buttonHtml(creatorProposalsUrl(), "Άνοιξε την πρόταση")}`
    )
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
  await send(
    "agreement_accepted",
    input.to,
    `Αναμένεται η αποδοχή σας – συμφωνία #${input.proposalId}`,
    shell(
      "Αναμένεται η αποδοχή σας",
      `<p>Γεια σας ${escapeHtml(input.recipientName)},</p>
       <p>Ο/Η <strong>${escapeHtml(input.otherName)}</strong> αποδέχτηκε τη σύνοψη συμφωνίας στις ${escapeHtml(todayAthens())}. Αποδεχτείτε κι εσείς για να ξεκινήσει η συνεργασία.</p>
       ${summaryBlockHtml(input)}
       ${buttonHtml(link, input.toBrand && !input.brandHasAccount ? "Δημιουργία λογαριασμού" : "Αποδοχή συμφωνίας")}
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
    `Η συμφωνία συνεργασίας #${input.proposalId} ολοκληρώθηκε`,
    shell(
      "Η συνεργασία ολοκληρώθηκε",
      `<p>Γεια σας ${escapeHtml(input.influencerName)},</p>
       <p>Και οι δύο πλευρές αποδέχτηκαν τη συμφωνία συνεργασίας <strong>#${id}</strong>. Η επιχείρηση <strong>${escapeHtml(input.brandName)}</strong> καταγράφεται στις συνεργασίες του προφίλ σας.</p>
       ${agreementDetailsHtml(input)}`
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
       <p><a href="${siteUrl()}/admin">Άνοιγμα διαχείρισης</a></p>`
    )
  );
}

export function buttonHtml(href: string, label: string): string {
  return `<p style="margin: 20px 0;"><a href="${escapeHtml(href)}" style="display: inline-block; background: #2563eb; color: #ffffff; text-decoration: none; font-weight: 600; padding: 10px 18px; border-radius: 8px;">${escapeHtml(label)}</a></p>`;
}

function dealSummaryHtml(service: string, extras: unknown, budget: unknown): string {
  const extrasLine = formatProposalExtrasLine(extras, "el");
  const extrasText = extrasLine ? extrasLine.replace(/^Extras:\s*/, "") : "";
  const pkg = [displayServiceType(service, "el"), extrasText].filter(Boolean).join(" + ") || "—";
  const amount = formatEuroAmount(budget, "el", 0) || euroHtml(budget);
  return `<p><strong>Σύνοψη:</strong> ${escapeHtml(pkg)} · <strong>Ποσό:</strong> ${escapeHtml(amount)}</p>`;
}

/** Creator email once a deal is completed (both sides accepted). */
export async function mailCreatorDealComplete(input: {
  to: string | null;
  creatorName: string;
  brandName: string;
  completedAt: string;
  service: string;
  budget: string;
  extras?: unknown;
  reviewUrl: string;
  profileUrl: string;
}): Promise<void> {
  const brand = escapeHtml(input.brandName);
  const date = escapeHtml(formatDate(input.completedAt, "el"));
  await send(
    "deal_complete_creator",
    input.to,
    `Η συνεργασία σου με ${input.brandName} ολοκληρώθηκε 🎉`,
    shell(
      "Η συνεργασία ολοκληρώθηκε 🎉",
      `<p>Γεια σου ${escapeHtml(input.creatorName)},</p>
       <p>Η συνεργασία σου με την <strong>${brand}</strong> ολοκληρώθηκε στις ${date}. Ευχαριστούμε που τη διάλεξες μέσω του Influo!</p>
       ${dealSummaryHtml(input.service, input.extras, input.budget)}
       <p><strong>Αξιολόγησε την ${brand}</strong> — μια σύντομη αξιολόγηση βοηθά άλλους δημιουργούς να επιλέγουν σωστές συνεργασίες.</p>
       ${buttonHtml(input.reviewUrl, "Γράψε αξιολόγηση")}
       <p><strong>Μια μικρή χάρη:</strong> Αν σου άρεσε η εμπειρία, ανάφερε το Influo σε ένα story ή video, ή βάλε τον σύνδεσμο του προφίλ σου στο bio σου: <a href="${escapeHtml(input.profileUrl)}">${escapeHtml(input.profileUrl)}</a>. Αν μας κάνεις tag (@influo.gr), θα το κοινοποιήσουμε κι εμείς!</p>
       <p>Καλή συνέχεια,</p>`
    )
  );
}

/** Brand email once a deal is completed (both sides accepted). */
export async function mailBrandDealComplete(input: {
  to: string | null;
  brandName: string;
  creatorName: string;
  creatorFemale: boolean | null;
  completedAt: string;
  service: string;
  budget: string;
  extras?: unknown;
  reviewUrl: string;
}): Promise<void> {
  const creator = escapeHtml(input.creatorName);
  const date = escapeHtml(formatDate(input.completedAt, "el"));
  const article = input.creatorFemale == null ? "τον/την" : input.creatorFemale ? "την" : "τον";
  await send(
    "deal_complete_brand",
    input.to,
    `Η συνεργασία με ${input.creatorName} ολοκληρώθηκε`,
    shell(
      "Η συνεργασία ολοκληρώθηκε",
      `<p>Γεια σας ${escapeHtml(input.brandName)},</p>
       <p>Η συνεργασία σας με <strong>${creator}</strong> ολοκληρώθηκε στις ${date}.</p>
       ${dealSummaryHtml(input.service, input.extras, input.budget)}
       <p><strong>Πώς πήγε;</strong> Η αξιολόγησή σας βοηθά άλλες επιχειρήσεις να βρουν τον κατάλληλο δημιουργό.</p>
       ${buttonHtml(input.reviewUrl, `Αξιολογήστε ${article} ${input.creatorName}`)}
       <p><strong>Μοιραστείτε το:</strong> Αν το περιεχόμενο σας άρεσε, μπορείτε να αναφέρετε το Influo στην ανάρτηση ή στο video (π.χ. «Συνεργασία μέσω @influo.gr») ή να βάλετε τον σύνδεσμο influo.gr. Θα χαρούμε να το προβάλουμε κι εμείς.</p>
       <p>Για την επόμενη καμπάνια σας:</p>
       ${buttonHtml(`${siteUrl()}/directory`, "Βρες δημιουργούς")}
       <p>Με εκτίμηση,</p>`
    )
  );
}
