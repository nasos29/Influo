import { supabaseService } from "@/lib/apiAuth";
import { deliverableReviewToCreator } from "@/lib/campaignMail";
import { sendCheckedCreator } from "@/lib/collabCreatorMail";
import { pushParty } from "@/lib/proposalNotify";
import { siteUrl } from "@/lib/proposalMail";
import { influencerContact } from "@/lib/proposalAccess";

/** In-app (announcements) + push when brand requests deliverable changes on a direct proposal. */
export async function notifyProposalDeliverableChangesRequested(args: {
  proposalId: string | number;
  influencerId: string;
  brandEmail: string | null | undefined;
  brandName: string;
  reviewNote: string;
}): Promise<void> {
  const admin = supabaseService();
  const { data: inf } = await admin
    .from("influencers")
    .select("auth_user_id")
    .eq("id", args.influencerId)
    .maybeSingle();
  const authUserId =
    inf && typeof (inf as { auth_user_id?: string | null }).auth_user_id === "string"
      ? (inf as { auth_user_id: string }).auth_user_id
      : null;

  const snippet = args.reviewNote.length > 160 ? `${args.reviewNote.slice(0, 157)}…` : args.reviewNote;

  if (authUserId) {
    const announcementTitle = `Ζητήθηκαν αλλαγές — ${args.brandName}`.slice(0, 180);
    const announcementBody = `Σχόλιο brand: ${args.reviewNote}`.slice(0, 2000);
    const { error } = await admin.from("announcements").insert({
      title: announcementTitle,
      body: announcementBody,
      target_type: "specific",
      target_influencer_id: authUserId,
    });
    if (error) console.error("[proposal deliverable changes] in-app", error.message);
  }

  await pushParty({
    type: "proposal_deliverable_changes",
    side: "influencer",
    influencerId: args.influencerId,
    brandEmail: args.brandEmail,
    payload: {
      title: "Ζητήθηκαν αλλαγές",
      body: `${args.brandName}: ${snippet}`.slice(0, 120),
      url: `/dashboard?tab=proposals&focus=deliverable&proposalId=${encodeURIComponent(String(args.proposalId))}`,
      tag: `proposal-deliverable-changes-${args.proposalId}`,
    },
  });

  try {
    const person = await influencerContact(args.influencerId);
    if (person?.email) {
      const ctaUrl = `${siteUrl()}/dashboard?tab=proposals&focus=deliverable&proposalId=${encodeURIComponent(String(args.proposalId))}`;
      const mail = deliverableReviewToCreator({
        influencerName: person.name,
        brandName: args.brandName,
        campaignTitle: `Πρόταση #${args.proposalId}`,
        status: "changes_requested",
        reviewNote: args.reviewNote,
        ctaUrl,
      });
      await sendCheckedCreator(
        args.influencerId,
        "proposal_deliverable_changes_creator",
        person.email,
        mail.subject,
        mail.html
      );
    }
  } catch (err) {
    console.error("[proposal deliverable changes] mail", err instanceof Error ? err.message : err);
  }
}