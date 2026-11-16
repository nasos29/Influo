/**
 * Greek brand campaign reminder / event email bodies (existing shell + next-steps).
 * From: support@influo.gr. Reminder emails include an unsubscribe link.
 */

import { createHmac, timingSafeEqual } from "crypto";
import { campaignSummaryHtml } from "@/lib/campaignMail";
import { emailNextSteps } from "@/lib/emailNextSteps";
import { mailFromSupport, mailReplyToSupport } from "@/lib/mailIdentity";
import { buttonHtml, shell, siteUrl, tipsHtml, todayAthens } from "@/lib/proposalMail";
import { escapeHtml } from "@/lib/proposalParty";
import { Resend } from "resend";
import { logEmail } from "@/lib/deliveryLog";
import type { BrandReminderKind } from "@/lib/brandCampaignReminders";
import { brandReminderPrefsUnsubUrl } from "@/lib/notificationUnsubToken";

export type ReminderMail = { subject: string; html: string };

function clip(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

function brandCampaignsLink(email: string): string {
  return `${siteUrl()}/login?redirect=${encodeURIComponent("/brand/dashboard?tab=campaigns")}&email=${encodeURIComponent(email)}`;
}

function brandNewCampaignLink(email: string): string {
  return `${siteUrl()}/login?redirect=${encodeURIComponent("/brand/dashboard?tab=campaigns&new=1")}&email=${encodeURIComponent(email)}`;
}

function unsubscribeSecret(): string {
  return (
    process.env.BRAND_REMINDERS_UNSUB_SECRET ||
    process.env.CRON_SECRET ||
    process.env.RESEND_API_KEY ||
    "influo-brand-reminders-dev"
  ).trim();
}

/** Signed token for reminder unsubscribe (brand id + email). */
export function brandReminderUnsubToken(brandId: string, email: string): string {
  const payload = `${String(brandId).trim()}:${String(email).trim().toLowerCase()}`;
  const sig = createHmac("sha256", unsubscribeSecret()).update(payload).digest("hex").slice(0, 32);
  return Buffer.from(`${payload}:${sig}`, "utf8").toString("base64url");
}

export function parseBrandReminderUnsubToken(
  token: string
): { brandId: string; email: string } | null {
  try {
    const raw = Buffer.from(String(token || ""), "base64url").toString("utf8");
    const parts = raw.split(":");
    if (parts.length < 3) return null;
    parts.pop(); // discard signature segment; full-token compare below
    const email = (parts.pop() || "").trim().toLowerCase();
    const brandId = parts.join(":").trim();
    if (!brandId || !email.includes("@")) return null;
    const expected = brandReminderUnsubToken(brandId, email);
    const a = Buffer.from(token);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
    return { brandId, email };
  } catch {
    return null;
  }
}

export function brandReminderUnsubscribeUrl(brandId: string, email: string): string {
  return brandReminderPrefsUnsubUrl(brandId, email);
}

function unsubFooter(brandId: string, email: string): string {
  const href = brandReminderUnsubscribeUrl(brandId, email);
  return `<p style="margin-top: 28px; font-size: 11px; color: #94a3b8; line-height: 1.5;">
    Λάβατε αυτό το μήνυμα ως υπενθύμιση καμπάνιας από το Influo.
    <a href="${escapeHtml(href)}" style="color:#64748b;">Διαγραφή από υπενθυμίσεις καμπανιών</a>
    · Unsubscribe from campaign reminders
  </p>`;
}

export function draftReminderMail(input: {
  brandEmail: string;
  brandName: string;
  campaignTitle: string;
  brandId: string;
  which: "day3" | "day10";
}): ReminderMail {
  const last = input.which === "day10";
  const subject = last
    ? `Τελευταία υπενθύμιση: δημοσιεύστε «${clip(input.campaignTitle, 40)}»`
    : `Η καμπάνια σας περιμένει: «${clip(input.campaignTitle, 40)}»`;
  const lead = last
    ? `Η καμπάνια σας παραμένει σε πρόχειρο εδώ και περίπου 10 ημέρες. Αυτή είναι η <strong>τελευταία</strong> υπενθύμιση.`
    : `Η καμπάνια σας είναι ακόμα σε πρόχειρο. Δημοσιεύστε την ώστε οι creators να μπορούν να κάνουν αίτηση.`;
  return {
    subject,
    html: shell(
      last ? "Τελευταία υπενθύμιση πρόχειρης καμπάνιας" : "Υπενθύμιση πρόχειρης καμπάνιας",
      `<p>Γεια σας ${escapeHtml(input.brandName)},</p>
       <p>${lead}</p>
       ${campaignSummaryHtml([
         ["Καμπάνια", input.campaignTitle],
         ["Κατάσταση", "Πρόχειρο"],
         ["Ημερομηνία", todayAthens()],
       ])}
       ${buttonHtml(brandCampaignsLink(input.brandEmail), "Δημοσιεύστε την καμπάνια")}
       ${emailNextSteps(last ? "brand_reminder_draft_day10" : "brand_reminder_draft_day3")}
       ${tipsHtml([
         "Μόνο ανοιχτές καμπάνιες εμφανίζονται στους creators.",
         "Μπορείτε να επεξεργαστείτε λεπτομέρειες και μετά τη δημοσίευση.",
       ])}
       ${unsubFooter(input.brandId, input.brandEmail)}`
    ),
  };
}

export function noCampaignNudgeMail(input: {
  brandEmail: string;
  brandName: string;
  brandId: string;
}): ReminderMail {
  return {
    subject: "Ξεκινήστε μια καμπάνια στο Influo — σε λίγα βήματα",
    html: shell(
      "Δημιουργήστε την επόμενη καμπάνια σας",
      `<p>Γεια σας ${escapeHtml(input.brandName)},</p>
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
       ${buttonHtml(brandNewCampaignLink(input.brandEmail), "Δημιουργία καμπάνιας")}
       ${emailNextSteps("brand_reminder_no_campaign")}
       ${tipsHtml(["Αν δεν σας ενδιαφέρουν πλέον αυτές οι υπενθυμίσεις, χρησιμοποιήστε τον σύνδεσμο διαγραφής παρακάτω."])}
       ${unsubFooter(input.brandId, input.brandEmail)}`
    ),
  };
}

export function targetReachedMail(input: {
  brandEmail: string;
  brandName: string;
  campaignTitle: string;
  slots: number;
  filled: number;
}): ReminderMail {
  return {
    subject: `Συμπληρώθηκαν οι θέσεις: «${clip(input.campaignTitle, 42)}»`,
    html: shell(
      "Η καμπάνια έφτασε τον στόχο creators",
      `<p>Γεια σας ${escapeHtml(input.brandName)},</p>
       <p>Η καμπάνια σας έφτασε τον στόχο αριθμού influencers/creators (<strong>${input.filled}/${input.slots}</strong> θέσεις).</p>
       ${campaignSummaryHtml([
         ["Καμπάνια", input.campaignTitle],
         ["Θέσεις", `${input.filled}/${input.slots}`],
         ["Ημερομηνία", todayAthens()],
       ])}
       ${buttonHtml(brandCampaignsLink(input.brandEmail), "Δείτε την καμπάνια")}
       ${emailNextSteps("brand_reminder_target_reached")}
       ${tipsHtml(["Μπορείτε να συνεχίσετε με συμφωνίες/παραδόσεις ή να κλείσετε την καμπάνια όταν είστε έτοιμοι."])}`
    ),
  };
}

export function campaignClosedEventMail(input: {
  brandEmail: string;
  brandName: string;
  campaignTitle: string;
  applicationsCount: number;
  acceptedCount: number;
}): ReminderMail {
  return {
    subject: `Η καμπάνια ολοκληρώθηκε: «${clip(input.campaignTitle, 40)}» — επόμενο βήμα;`,
    html: shell(
      "Η καμπάνια έκλεισε — σύνοψη",
      `<p>Γεια σας ${escapeHtml(input.brandName)},</p>
       <p>Η καμπάνια σας έκλεισε/ολοκληρώθηκε. Παρακάτω μια σύντομη σύνοψη και πρόταση για το επόμενο βήμα.</p>
       ${campaignSummaryHtml([
         ["Καμπάνια", input.campaignTitle],
         ["Αιτήσεις", String(input.applicationsCount)],
         ["Αποδοχές", String(input.acceptedCount)],
         ["Ημερομηνία", todayAthens()],
       ])}
       ${buttonHtml(brandNewCampaignLink(input.brandEmail), "Δημιουργία νέας καμπάνιας")}
       ${emailNextSteps("brand_reminder_campaign_closed")}
       ${tipsHtml(["Μια νέα καμπάνια φέρνει φρέσκες αιτήσεις από creators που ταιριάζουν στο brand σας."])}`
    ),
  };
}

export function mailForKind(
  kind: BrandReminderKind,
  ctx: {
    brandEmail: string;
    brandName: string;
    brandId: string;
    campaignTitle?: string;
    slots?: number;
    filled?: number;
    applicationsCount?: number;
    acceptedCount?: number;
  }
): ReminderMail {
  switch (kind) {
    case "draft_day3":
      return draftReminderMail({
        brandEmail: ctx.brandEmail,
        brandName: ctx.brandName,
        campaignTitle: ctx.campaignTitle || "Καμπάνια",
        brandId: ctx.brandId,
        which: "day3",
      });
    case "draft_day10":
      return draftReminderMail({
        brandEmail: ctx.brandEmail,
        brandName: ctx.brandName,
        campaignTitle: ctx.campaignTitle || "Καμπάνια",
        brandId: ctx.brandId,
        which: "day10",
      });
    case "no_campaign_nudge":
      return noCampaignNudgeMail({
        brandEmail: ctx.brandEmail,
        brandName: ctx.brandName,
        brandId: ctx.brandId,
      });
    case "target_reached":
      return targetReachedMail({
        brandEmail: ctx.brandEmail,
        brandName: ctx.brandName,
        campaignTitle: ctx.campaignTitle || "Καμπάνια",
        slots: ctx.slots ?? 0,
        filled: ctx.filled ?? 0,
      });
    case "campaign_closed":
      return campaignClosedEventMail({
        brandEmail: ctx.brandEmail,
        brandName: ctx.brandName,
        campaignTitle: ctx.campaignTitle || "Καμπάνια",
        applicationsCount: ctx.applicationsCount ?? 0,
        acceptedCount: ctx.acceptedCount ?? 0,
      });
    default: {
      const _exhaustive: never = kind;
      return _exhaustive;
    }
  }
}

/** Send via Resend from support@influo.gr (Reply-To support). */
export async function sendBrandReminderEmail(input: {
  type: string;
  to: string;
  subject: string;
  html: string;
}): Promise<"ok" | "quota" | "error"> {
  const address = input.to.trim();
  const key = process.env.RESEND_API_KEY;
  if (!address.includes("@") || !key) {
    logEmail(input.type, false);
    return "error";
  }
  try {
    const resend = new Resend(key);
    const { error } = await resend.emails.send({
      from: mailFromSupport("Influo"),
      replyTo: mailReplyToSupport(),
      to: [address],
      subject: input.subject.replace(/[\r\n]/g, " ").slice(0, 180),
      html: input.html,
    });
    if (error) console.error("[brand-reminders mail]", input.type, error.message);
    logEmail(input.type, !error);
    if (!error) return "ok";
    const name = String((error as { name?: string }).name || "");
    return /quota|rate_limit|daily/i.test(`${name} ${error.message}`) ? "quota" : "error";
  } catch (err) {
    console.error("[brand-reminders mail]", input.type, err instanceof Error ? err.message : "send failed");
    logEmail(input.type, false);
    return "error";
  }
}
