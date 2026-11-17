/**
 * «Η συνεργασία ολοκληρώθηκε» — sent only on real delivery completion
 * (brand approves link / confirms event, or 7-day auto-complete).
 * Includes the review prompt so the delayed review reminder is not a second email.
 */

import { emailNextSteps } from "@/lib/emailNextSteps";
import { escapeHtml } from "@/lib/proposalParty";
import {
  buttonHtml,
  influoMentionHtml,
  reviewDeclineLinkHtml,
  reviewStarsHtml,
  send,
  shell,
} from "@/lib/proposalMail";

export type CollaborationCompleteParty = "creator" | "brand";

export async function mailCollaborationCompleted(input: {
  to: string | null | undefined;
  party: CollaborationCompleteParty;
  creatorName: string;
  brandName: string;
  creatorFemale?: boolean | null;
  mode: "confirmed" | "auto";
  deliveryMode?: "link" | "event" | string | null;
  collabLabel?: string | null;
  dashboardUrl: string;
  reviewUrl: string;
  reviewCtaLabel: string;
  starUrls?: string[];
  declineUrl?: string | null;
  helperHtml?: string | null;
  /** When false, completion notice only (no review ask). */
  includeReview?: boolean;
  profileUrl?: string | null;
}): Promise<void> {
  const isCreator = input.party === "creator";
  const includeReview = input.includeReview !== false;
  const other = isCreator
    ? escapeHtml(input.brandName)
    : escapeHtml(input.creatorName);
  const idBit = input.collabLabel
    ? ` (<strong>${escapeHtml(input.collabLabel)}</strong>)`
    : "";
  const how =
    input.mode === "auto"
      ? isCreator
        ? "αυτόματα (πέρασαν 7 ημέρες χωρίς απάντηση στο παραδοτέο)"
        : "αυτόματα (πέρασαν 7 ημέρες χωρίς απάντηση στο παραδοτέο)"
      : input.deliveryMode === "event"
        ? isCreator
          ? "με επιβεβαίωση παρουσίας / event από το brand"
          : "με την επιβεβαίωση παρουσίας / event"
        : isCreator
          ? "με έγκριση του παραδοτέου από το brand"
          : "με την έγκριση του παραδοτέου";
  const howEn =
    input.mode === "auto"
      ? "automatically (7 days with no response on the deliverable)"
      : input.deliveryMode === "event"
        ? "after event / presence confirmation"
        : "after deliverable approval";

  const greeting = isCreator
    ? `<p>Γεια σου ${escapeHtml(input.creatorName)},</p>`
    : `<p>Γεια σας ${escapeHtml(input.brandName)},</p>`;

  const lead = isCreator
    ? `<p>Η συνεργασία με την <strong>${other}</strong>${idBit} ολοκληρώθηκε ${how}.</p>
       <p style="font-size:13px;color:#64748b;">Your collaboration with <strong>${other}</strong> is complete (${escapeHtml(howEn)}).</p>`
    : `<p>Η συνεργασία με τον/την <strong>${other}</strong>${idBit} ολοκληρώθηκε ${how}.</p>
       <p style="font-size:13px;color:#64748b;">Your collaboration with <strong>${other}</strong> is complete (${escapeHtml(howEn)}).</p>`;

  const stars =
    includeReview && input.starUrls && input.starUrls.length === 5
      ? reviewStarsHtml(input.starUrls)
      : "";
  const decline =
    includeReview && input.declineUrl
      ? reviewDeclineLinkHtml(input.declineUrl)
      : "";
  const helper = includeReview && input.helperHtml ? input.helperHtml : "";
  const reviewCta = includeReview
    ? buttonHtml(input.reviewUrl, input.reviewCtaLabel)
    : buttonHtml(input.dashboardUrl, "Άνοιξε το dashboard");
  const nextKey = isCreator
    ? "collaboration_completed_creator"
    : "collaboration_completed_brand";
  const mention = includeReview
    ? influoMentionHtml({
        forCreator: isCreator,
        profileUrl: input.profileUrl || undefined,
      })
    : "";

  await send(
    includeReview
      ? `collaboration_completed_${input.party}`
      : `collaboration_completed_${input.party}_no_review`,
    input.to,
    `Η συνεργασία ολοκληρώθηκε · ${isCreator ? input.brandName : input.creatorName}`,
    shell(
      "Η συνεργασία ολοκληρώθηκε",
      `${greeting}
       ${lead}
       ${includeReview ? `<p>Αν όλα πήγαν καλά, μια σύντομη αξιολόγηση βοηθά την κοινότητα του Influo.</p>
       <p style="font-size:13px;color:#64748b;">If it went well, a short review helps the Influo community.</p>` : ""}
       ${stars}
       ${reviewCta}
       ${helper}
       ${includeReview ? emailNextSteps(nextKey) : ""}
       ${mention}
       ${decline}
       <p>${isCreator ? "Καλή συνέχεια," : "Με εκτίμηση,"}</p>`
    )
  );
}
