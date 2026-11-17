/**
 * Emails for deliverable submit / brand confirm / reminders / auto-complete.
 * Deliverable + approval mails are essential (always send when addressed).
 */

import { emailNextSteps } from "@/lib/emailNextSteps";
import { formatDate } from "@/lib/formatDateTime";
import { escapeHtml } from "@/lib/proposalParty";
import { send, shell, siteUrl } from "@/lib/proposalMail";

function button(href: string, label: string): string {
  return `<p style="margin:20px 0;"><a href="${escapeHtml(href)}" style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;padding:10px 18px;border-radius:8px;font-weight:600;">${escapeHtml(label)}</a></p>`;
}

export async function mailCreatorDeliverableReminder(input: {
  to: string | null | undefined;
  creatorName: string;
  brandName: string;
  publishDeadline?: string | null;
  wave: "before" | "after_1" | "after_5";
  dashboardUrl: string;
}): Promise<void> {
  const deadline = formatDate(input.publishDeadline, "el") || "την προθεσμία";
  const subject =
    input.wave === "before"
      ? `Υπενθύμιση: ανέβασε το παραδοτέο πριν τις ${deadline}`
      : `Υπενθύμιση: εκκρεμεί το παραδοτέο (${input.brandName})`;
  const lead =
    input.wave === "before"
      ? `Η προθεσμία δημοσίευσης είναι στις <strong>${escapeHtml(deadline)}</strong>. Ανέβασε το link (ή επιβεβαίωσε event/παρουσία) από το dashboard.`
      : `Η προθεσμία δημοσίευσης (${escapeHtml(deadline)}) πέρασε και δεν έχει υποβληθεί παραδοτέο ακόμα.`;
  await send(
    `deliverable_reminder_creator_${input.wave}`,
    input.to,
    subject,
    shell(
      "Ανέβασε το παραδοτέο",
      `<p>Γεια σου ${escapeHtml(input.creatorName)},</p>
       <p>Η συνεργασία με <strong>${escapeHtml(input.brandName)}</strong> περιμένει το παραδοτέο σου.</p>
       <p>${lead}</p>
       ${button(input.dashboardUrl, "Άνοιξε τις προτάσεις")}
       ${emailNextSteps("proposal_new_creator")}`
    )
  );
}

export async function mailBrandApproveReminder(input: {
  to: string | null | undefined;
  brandName: string;
  creatorName: string;
  mode: "link" | "event" | string;
  dashboardUrl: string;
}): Promise<void> {
  const isEvent = input.mode === "event";
  await send(
    "deliverable_approve_reminder_brand",
    input.to,
    isEvent
      ? `Επιβεβαίωση παρουσίας: ${input.creatorName}`
      : `Έγκριση παραδοτέου: ${input.creatorName}`,
    shell(
      isEvent ? "Επιβεβαίωση ότι έγινε" : "Έγκρινε το παραδοτέο",
      `<p>Γεια σας ${escapeHtml(input.brandName)},</p>
       <p>Ο/Η <strong>${escapeHtml(input.creatorName)}</strong> υπέβαλε ${
         isEvent ? "επιβεβαίωση event/παρουσίας" : "link παραδοτέου"
       } και περιμένει την απάντησή σας.</p>
       ${button(input.dashboardUrl, isEvent ? "Επιβεβαίωσε" : "Έγκρινε το link")}
       ${emailNextSteps("campaign_deliverable_brand")}`
    )
  );
}

export async function mailDeliveryAutoCompleted(input: {
  to: string | null | undefined;
  party: "creator" | "brand";
  creatorName: string;
  brandName: string;
  dashboardUrl: string;
}): Promise<void> {
  const isCreator = input.party === "creator";
  await send(
    `delivery_auto_completed_${input.party}`,
    input.to,
    "Η συνεργασία ολοκληρώθηκε αυτόματα",
    shell(
      "Αυτόματη ολοκλήρωση",
      `<p>Γεια ${isCreator ? escapeHtml(input.creatorName) : `σας ${escapeHtml(input.brandName)}`},</p>
       <p>Το παραδοτέο υποβλήθηκε και δεν υπήρξε απάντηση εντός 7 ημερών, οπότε η συνεργασία με ${
         isCreator
           ? `<strong>${escapeHtml(input.brandName)}</strong>`
           : `<strong>${escapeHtml(input.creatorName)}</strong>`
       } σημειώθηκε ως ολοκληρωμένη αυτόματα.</p>
       ${button(input.dashboardUrl, "Άνοιξε το dashboard")}
       <p style="font-size:12px;color:#64748b;">Μπορείτε ακόμα να αφήσετε αξιολόγηση.</p>`
    )
  );
}

export async function mailBrandDeliverySubmitted(input: {
  to: string | null | undefined;
  brandName: string;
  creatorName: string;
  mode: "link" | "event";
  url?: string | null;
  note?: string | null;
  dashboardUrl: string;
}): Promise<void> {
  const isEvent = input.mode === "event";
  await send(
    isEvent ? "delivery_event_submitted_brand" : "delivery_link_submitted_brand",
    input.to,
    isEvent
      ? `Επιβεβαίωση παρουσίας από ${input.creatorName}`
      : `Νέο παραδοτέο από ${input.creatorName}`,
    shell(
      isEvent ? "Επιβεβαίωση event / παρουσίας" : "Νέο παραδοτέο",
      `<p>Γεια σας ${escapeHtml(input.brandName)},</p>
       <p>Ο/Η <strong>${escapeHtml(input.creatorName)}</strong> ${
         isEvent
           ? "δήλωσε ότι ολοκληρώθηκε η παρουσία / το event."
           : "υπέβαλε link παραδοτέου."
       }</p>
       ${input.url ? `<p><strong>Link:</strong> <a href="${escapeHtml(input.url)}">${escapeHtml(input.url)}</a></p>` : ""}
       ${input.note ? `<p><strong>Σημείωση:</strong> ${escapeHtml(input.note)}</p>` : ""}
       ${button(input.dashboardUrl, isEvent ? "Επιβεβαίωσε ότι έγινε" : "Έγκρινε το link")}
       ${emailNextSteps("campaign_deliverable_brand")}`
    )
  );
}

export async function mailCreatorDeliveryConfirmed(input: {
  to: string | null | undefined;
  creatorName: string;
  brandName: string;
  mode: "link" | "event" | string;
  dashboardUrl: string;
}): Promise<void> {
  await send(
    "delivery_confirmed_creator",
    input.to,
    `Η ${input.brandName} επιβεβαίωσε την παράδοση`,
    shell(
      "Παράδοση επιβεβαιωμένη",
      `<p>Γεια σου ${escapeHtml(input.creatorName)},</p>
       <p>Η <strong>${escapeHtml(input.brandName)}</strong> επιβεβαίωσε ${
         input.mode === "event" ? "την παρουσία / το event" : "το παραδοτέο"
       }. Η συνεργασία ολοκληρώθηκε.</p>
       ${button(input.dashboardUrl, "Άνοιξε το dashboard")}
       <p style="font-size:12px;color:#64748b;">Σύντομα μπορείς να αφήσεις αξιολόγηση.</p>`
    )
  );
}

export { siteUrl };
