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

function siteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL || "https://influo.gr").replace(/\/$/, "");
}

function adminEmail(): string {
  return (process.env.ADMIN_EMAIL || "nd.6@hotmail.com").trim();
}

function brandLink(email: string, hasAccount: boolean): string {
  const target = hasAccount
    ? `/login?redirect=/brand/dashboard&email=${encodeURIComponent(email)}`
    : `/brand/signup?email=${encodeURIComponent(email)}`;
  return `${siteUrl()}${target}`;
}

async function send(type: string, to: string | null | undefined, subject: string, html: string): Promise<void> {
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
    logEmail(type, !error);
  } catch {
    logEmail(type, false);
  }
}

function shell(title: string, body: string): string {
  return `<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; font-size: 14px; line-height: 1.6; color: #1f2937; max-width: 600px; margin: 0 auto;">
    <div style="padding: 24px 24px 0;"><h1 style="font-size: 20px; margin: 0;">${title}</h1></div>
    <div style="padding: 16px 24px 24px;">${body}
      <p style="margin-top: 24px; font-size: 12px; color: #9ca3af;">Η ομάδα του Influo</p>
    </div>
  </div>`;
}

export async function mailNewProposal(input: {
  influencerEmail: string | null;
  influencerName: string;
  brandEmail: string;
  brandName: string;
  service: string;
  budget: string;
  message: string;
}): Promise<void> {
  const influencerName = escapeHtml(input.influencerName);
  const brandName = escapeHtml(input.brandName);
  const service = escapeHtml(input.service);
  const message = escapeHtml(input.message).replace(/\n/g, "<br/>");
  const note = message
    ? `<p style="margin: 12px 0 0; white-space: pre-wrap;">${message}</p>`
    : "";

  await Promise.all([
  send(
    "proposal_new",
    input.influencerEmail,
    `Νέα πρόταση από ${input.brandName}`,
    shell(
      "Νέα πρόταση συνεργασίας",
      `<p>Γεια σου ${influencerName},</p>
       <p>Το brand <strong>${brandName}</strong> σου έστειλε πρόταση.</p>
       <p><strong>Υπηρεσία:</strong> ${service}<br/><strong>Budget:</strong> ${euroHtml(input.budget)}</p>
       ${note}
       <p><a href="${siteUrl()}/dashboard">Άνοιξε τις προσφορές στο dashboard</a></p>`
    )
  ),
  send(
    "proposal_brand_confirmation",
    input.brandEmail,
    `Επιβεβαίωση πρότασης προς ${input.influencerName}`,
    shell(
      "Η πρόταση στάλθηκε",
      `<p>Λάβαμε την πρόταση της <strong>${brandName}</strong> προς τον/την <strong>${influencerName}</strong> για την υπηρεσία <strong>${service}</strong>.</p>
       <p>Ο/Η influencer θα την δει στις προσφορές του και μπορεί να την αποδεχτεί, να την απορρίψει ή να στείλει αντιπρόταση.</p>`
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

export async function mailProposalDecision(input: {
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
  const title = input.accepted ? "Η πρόταση έγινε αποδεκτή" : "Η πρόταση απορρίφθηκε";
  const lead = input.accepted
    ? `Ο/Η <strong>${influencerName}</strong> αποδέχτηκε την πρόταση της <strong>${brandName}</strong>.`
    : `Ο/Η <strong>${influencerName}</strong> απέρριψε την πρόταση της <strong>${brandName}</strong>.`;
  const next = input.accepted
    ? `<p>Για να κλείσει η συνεργασία, αποδεχτείτε και εσείς τη συμφωνία από τις προσφορές.</p><p><a href="${link}">${input.brandHasAccount ? "Σύνδεση στο dashboard" : "Δημιουργία λογαριασμού"}</a></p>`
    : `<p>Η πρόταση έκλεισε. Μπορείτε να στείλετε νέα πρόταση από το προφίλ του influencer.</p>`;
  await send(
    input.accepted ? "proposal_accepted" : "proposal_rejected",
    input.brandEmail,
    `${input.accepted ? "Αποδοχή" : "Απόρριψη"} πρότασης από ${input.influencerName}`,
    shell(
      title,
      `<p>Γεια σας ${brandName},</p><p>${lead}</p>
       <p><strong>Υπηρεσία:</strong> ${escapeHtml(input.service)}<br/><strong>Budget:</strong> ${euroHtml(input.budget)}</p>
       ${next}`
    )
  );
}

export async function mailCounter(input: {
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
    `Αντιπρόταση από ${input.influencerName}`,
    shell(
      "Νέα αντιπρόταση",
      `<p>Γεια σας ${escapeHtml(input.brandName)},</p>
       <p>Ο/Η <strong>${escapeHtml(input.influencerName)}</strong> προτείνει άλλη τιμή.</p>
       <p><strong>Υπηρεσία:</strong> ${escapeHtml(input.service)}<br/>
          <strong>Αρχικό budget:</strong> ${euroHtml(input.budget)}<br/>
          <strong>Αντιπρόταση:</strong> ${euroHtml(input.counterBudget)}</p>
       ${comment}
       <p>Η απάντηση γίνεται από τον λογαριασμό της επιχείρησης, στην καρτέλα Προσφορές.</p>
       <p><a href="${link}">${input.brandHasAccount ? "Σύνδεση στο dashboard" : "Δημιουργία λογαριασμού"}</a></p>`
    )
  );
}

export async function mailCounterDecision(input: {
  accepted: boolean;
  influencerEmail: string | null;
  influencerName: string;
  brandName: string;
  service: string;
  budget: string;
}): Promise<void> {
  const title = input.accepted ? "Η αντιπρόταση έγινε αποδεκτή" : "Η αντιπρόταση απορρίφθηκε";
  const lead = input.accepted
    ? `Η <strong>${escapeHtml(input.brandName)}</strong> αποδέχτηκε την αντιπρότασή σου. Η τιμή της πρότασης είναι πλέον ${euroHtml(input.budget)}.`
    : `Η <strong>${escapeHtml(input.brandName)}</strong> απέρριψε την αντιπρόταση. Η αρχική πρόταση παραμένει ανοιχτή.`;
  await send(
    input.accepted ? "counter_accepted" : "counter_rejected",
    input.influencerEmail,
    `${input.accepted ? "Αποδοχή" : "Απόρριψη"} αντιπρότασης από ${input.brandName}`,
    shell(
      title,
      `<p>Γεια σου ${escapeHtml(input.influencerName)},</p>
       <p>${lead}</p>
       <p><strong>Υπηρεσία:</strong> ${escapeHtml(input.service)}</p>
       <p><a href="${siteUrl()}/dashboard">Προσφορές</a></p>`
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
    : `${siteUrl()}/dashboard`;
  const id = escapeHtml(String(input.proposalId));
  await send(
    "agreement_accepted",
    input.to,
    `Αποδοχή της συμφωνίας συνεργασίας #${input.proposalId}`,
    shell(
      "Η συμφωνία έγινε αποδεκτή από τη μία πλευρά",
      `<p>Γεια σας ${escapeHtml(input.recipientName)},</p>
       <p>Ο/Η <strong>${escapeHtml(input.otherName)}</strong> αποδέχτηκε τη συμφωνία συνεργασίας <strong>#${id}</strong>. Για να ολοκληρωθεί η συνεργασία, απαιτείται και η δική σας αποδοχή.</p>
       ${agreementDetailsHtml(input)}
       <p><a href="${link}">${input.toBrand && !input.brandHasAccount ? "Δημιουργία λογαριασμού" : "Άνοιγμα προσφορών"}</a></p>`
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

function buttonHtml(href: string, label: string): string {
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
