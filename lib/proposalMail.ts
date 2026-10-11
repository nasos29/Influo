import { Resend } from "resend";
import { escapeHtml } from "@/lib/proposalParty";

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

async function send(to: string | null | undefined, subject: string, html: string): Promise<void> {
  const address = (to || "").trim();
  const key = process.env.RESEND_API_KEY;
  if (!address || !address.includes("@") || !key) return;
  try {
    const resend = new Resend(key);
    await resend.emails.send({
      from: SENDER,
      to: [address],
      subject: subject.replace(/[\r\n]/g, " ").slice(0, 180),
      html,
    });
  } catch (error) {
    console.error("[proposal mail]", subject, error);
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
  const budget = escapeHtml(input.budget);
  const message = escapeHtml(input.message).replace(/\n/g, "<br/>");
  const note = message
    ? `<p style="margin: 12px 0 0; white-space: pre-wrap;">${message}</p>`
    : "";

  await send(
    input.influencerEmail,
    `Νέα πρόταση από ${input.brandName}`,
    shell(
      "Νέα πρόταση συνεργασίας",
      `<p>Γεια σου ${influencerName},</p>
       <p>Το brand <strong>${brandName}</strong> σου έστειλε πρόταση.</p>
       <p><strong>Υπηρεσία:</strong> ${service}<br/><strong>Budget:</strong> €${budget}</p>
       ${note}
       <p><a href="${siteUrl()}/dashboard">Άνοιξε τις προσφορές στο dashboard</a></p>`
    )
  );

  await send(
    input.brandEmail,
    `Επιβεβαίωση πρότασης προς ${input.influencerName}`,
    shell(
      "Η πρόταση στάλθηκε",
      `<p>Λάβαμε την πρόταση της <strong>${brandName}</strong> προς τον/την <strong>${influencerName}</strong> για την υπηρεσία <strong>${service}</strong>.</p>
       <p>Ο/Η influencer θα την δει στις προσφορές του και μπορεί να την αποδεχτεί, να την απορρίψει ή να στείλει αντιπρόταση.</p>`
    )
  );

  await send(
    adminEmail(),
    `Νέα πρόταση από ${input.brandName} προς ${input.influencerName}`,
    shell(
      "Νέα πρόταση",
      `<p><strong>Brand:</strong> ${brandName}<br/>
        <strong>Email:</strong> ${escapeHtml(input.brandEmail)}<br/>
        <strong>Influencer:</strong> ${influencerName}<br/>
        <strong>Υπηρεσία:</strong> ${service}<br/>
        <strong>Budget:</strong> €${budget}</p>
       ${note}
       <p><a href="${siteUrl()}/admin">Admin</a></p>`
    )
  );
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
    input.brandEmail,
    `${input.accepted ? "Αποδοχή" : "Απόρριψη"} πρότασης από ${input.influencerName}`,
    shell(
      title,
      `<p>Γεια σας ${brandName},</p><p>${lead}</p>
       <p><strong>Υπηρεσία:</strong> ${escapeHtml(input.service)}<br/><strong>Budget:</strong> €${escapeHtml(input.budget)}</p>
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
    input.brandEmail,
    `Αντιπρόταση από ${input.influencerName}`,
    shell(
      "Νέα αντιπρόταση",
      `<p>Γεια σας ${escapeHtml(input.brandName)},</p>
       <p>Ο/Η <strong>${escapeHtml(input.influencerName)}</strong> προτείνει άλλη τιμή.</p>
       <p><strong>Υπηρεσία:</strong> ${escapeHtml(input.service)}<br/>
          <strong>Αρχικό budget:</strong> €${escapeHtml(input.budget)}<br/>
          <strong>Αντιπρόταση:</strong> €${escapeHtml(input.counterBudget)}</p>
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
    ? `Η <strong>${escapeHtml(input.brandName)}</strong> αποδέχτηκε την αντιπρότασή σου. Η τιμή της πρότασης είναι πλέον €${escapeHtml(input.budget)}.`
    : `Η <strong>${escapeHtml(input.brandName)}</strong> απέρριψε την αντιπρόταση. Η αρχική πρόταση παραμένει ανοιχτή.`;
  await send(
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

export async function mailAgreement(input: {
  to: string | null;
  recipientName: string;
  otherName: string;
  service: string;
  budget: string;
  toBrand: boolean;
  brandHasAccount: boolean;
}): Promise<void> {
  const link = input.toBrand
    ? brandLink(input.to || "", input.brandHasAccount)
    : `${siteUrl()}/dashboard`;
  await send(
    input.to,
    `Αποδοχή συμφωνίας από ${input.otherName}`,
    shell(
      "Η συμφωνία αποδεχτήκε από τη μία πλευρά",
      `<p>Γεια σας ${escapeHtml(input.recipientName)},</p>
       <p>Ο/Η <strong>${escapeHtml(input.otherName)}</strong> αποδέχτηκε τη συμφωνία. Χρειάζεται και η δική σας αποδοχή.</p>
       <p><strong>Υπηρεσία:</strong> ${escapeHtml(input.service)}<br/><strong>Budget:</strong> €${escapeHtml(input.budget)}</p>
       <p><a href="${link}">${input.toBrand && !input.brandHasAccount ? "Δημιουργία λογαριασμού" : "Άνοιγμα προσφορών"}</a></p>`
    )
  );
}

export async function mailCollaborationComplete(input: {
  influencerEmail: string | null;
  influencerName: string;
  brandName: string;
}): Promise<void> {
  await send(
    input.influencerEmail,
    `Η συνεργασία με ${input.brandName} ολοκληρώθηκε`,
    shell(
      "Η συνεργασία ολοκληρώθηκε",
      `<p>Γεια σου ${escapeHtml(input.influencerName)},</p>
       <p>Και οι δύο πλευρές αποδέχτηκαν τη συμφωνία. Η <strong>${escapeHtml(input.brandName)}</strong> προστέθηκε στις συνεργασίες του προφίλ σου.</p>`
    )
  );
}
