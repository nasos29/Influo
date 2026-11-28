import { supabaseService } from "@/lib/apiAuth";
import { deliverableReviewToCreator, deliverableSubmittedToBrand } from "@/lib/campaignMail";
import { sendCheckedCreator } from "@/lib/collabCreatorMail";
import { creatorContact } from "@/lib/campaignNotify";
import { pushParty } from "@/lib/proposalNotify";
import { send } from "@/lib/proposalMail";
import { sendPushToBrand, sendPushToInfluencer } from "@/lib/push";

type Source = "proposal" | "campaign";

export async function notifyDraftReview(args: {
  source: Source;
  id: string;
  action: "submitted" | "approved" | "changes_requested";
  influencerId: string;
  brandName?: string | null;
  campaignTitle?: string | null;
  reviewNote?: string;
}): Promise<void> {
  const admin = supabaseService();
  const person = await creatorContact(args.influencerId);
  const creatorName = person?.name || "Creator";
  const title = args.campaignTitle || (args.source === "proposal" ? `Πρόταση #${args.id}` : "Καμπάνια");

  if (args.action === "submitted") {
    const { data: brandEmailRow } =
      args.source === "proposal"
        ? await admin.from("proposals").select("brand_email, brand_name").eq("id", args.id).maybeSingle()
        : await admin
            .from("campaign_applications")
            .select("brand_campaigns ( brands ( contact_email, brand_name ), title )")
            .eq("id", args.id)
            .maybeSingle();
    const brandEmail =
      args.source === "proposal"
        ? String((brandEmailRow as { brand_email?: string })?.brand_email || "").trim().toLowerCase()
        : (() => {
            const raw = (brandEmailRow as { brand_campaigns?: unknown })?.brand_campaigns;
            const bc = (Array.isArray(raw) ? raw[0] : raw) as {
              brands?: { contact_email?: string } | { contact_email?: string }[];
            } | null;
            const br = Array.isArray(bc?.brands) ? bc?.brands[0] : bc?.brands;
            return (br?.contact_email || "").trim().toLowerCase();
          })();
    if (brandEmail) {
      const mail = deliverableSubmittedToBrand({
        brandEmail,
        brandName: args.brandName || "Brand",
        campaignTitle: title,
        influencerName: creatorName,
        deliverableUrl: null,
      });
      await send("collab_draft_submitted_brand", brandEmail, mail.subject, mail.html);
      await sendPushToBrand(brandEmail, {
        title: "UGC draft",
        body: `${creatorName}: ${title}`.slice(0, 120),
        url: "/brand/dashboard?tab=campaigns",
        tag: `draft-submitted-${args.source}-${args.id}`,
      }).catch(() => undefined);
    }
    return;
  }

  if (!person?.email) return;
  const ctaUrl =
    args.source === "proposal"
      ? `/dashboard?tab=proposals&focus=deliverable&proposalId=${encodeURIComponent(args.id)}`
      : `/dashboard?tab=campaigns&application=${encodeURIComponent(args.id)}&focus=deliverable`;
  const mail = deliverableReviewToCreator({
    influencerName: creatorName,
    brandName: args.brandName || "Brand",
    campaignTitle: title,
    status: args.action === "approved" ? "approved" : "changes_requested",
    reviewNote: args.reviewNote || "",
    ctaUrl: `${(process.env.NEXT_PUBLIC_SITE_URL || "https://influo.gr").replace(/\/$/, "")}${ctaUrl}`,
  });
  await sendCheckedCreator(
    args.influencerId,
    "collab_draft_review_creator",
    person.email,
    mail.subject,
    mail.html
  );
  await pushParty({
    type: "collab_draft_review",
    side: "influencer",
    influencerId: args.influencerId,
    brandEmail: null,
    payload: {
      title: args.action === "approved" ? "Draft εγκρίθηκε" : "Ζητήθηκαν αλλαγές στο draft",
      body: title.slice(0, 120),
      url: ctaUrl,
      tag: `draft-${args.action}-${args.source}-${args.id}`,
    },
  });
  await sendPushToInfluencer(args.influencerId, {
    title: args.action === "approved" ? "Draft εγκρίθηκε" : "Αλλαγές στο UGC draft",
    body: title.slice(0, 100),
    url: ctaUrl,
    tag: `draft-push-${args.source}-${args.id}`,
  }).catch(() => undefined);
}