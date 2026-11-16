/**
 * Optional showcase appearance emails (flag default OFF).
 */

import { creatorContact } from "@/lib/campaignNotify";
import { send } from "@/lib/proposalMail";
import {
  isShowcaseAppearanceNotifyEnabled,
  isShowcaseAppearanceNotifyLive,
} from "@/lib/showcaseFlags";
import { showcaseAppearanceNotifyMail } from "@/lib/showcaseMail";
import type { ShowcaseSource } from "@/lib/showcaseOptOut";

function resolveTo(email: string): string | null {
  const clean = email.trim().toLowerCase();
  if (!clean.includes("@")) return null;
  if (isShowcaseAppearanceNotifyLive()) return clean;
  const test = (process.env.SHOWCASE_NOTIFY_TEST_TO || process.env.ADMIN_EMAIL || "").trim();
  return test.includes("@") ? test : null;
}

/** Fire-and-forget safe: call inside deferAfterResponse. */
export async function maybeNotifyShowcaseAppearance(input: {
  source: ShowcaseSource;
  id: string;
  brandName: string;
  brandEmail: string | null | undefined;
  influencerId: string;
  collabLabel: string;
}): Promise<{ sent: number; skipped: string }> {
  if (!isShowcaseAppearanceNotifyEnabled()) {
    return { sent: 0, skipped: "flag_off" };
  }

  const person = await creatorContact(input.influencerId);
  const creatorName = person?.name || "Creator";
  const brandName = input.brandName || "Brand";
  let sent = 0;

  const brandTo = resolveTo(input.brandEmail || "");
  if (brandTo) {
    const mail = showcaseAppearanceNotifyMail({
      party: "brand",
      recipientName: brandName,
      otherPartyName: creatorName,
      collabLabel: input.collabLabel,
      source: input.source,
      id: input.id,
    });
    await send("showcase_appearance_brand", brandTo, mail.subject, mail.html);
    sent += 1;
  }

  if (person?.email) {
    const creatorTo = resolveTo(person.email);
    if (creatorTo) {
      const mail = showcaseAppearanceNotifyMail({
        party: "influencer",
        recipientName: creatorName,
        otherPartyName: brandName,
        collabLabel: input.collabLabel,
        source: input.source,
        id: input.id,
      });
      await send("showcase_appearance_creator", creatorTo, mail.subject, mail.html);
      sent += 1;
    }
  }

  return { sent, skipped: sent ? "" : "no_recipients" };
}
