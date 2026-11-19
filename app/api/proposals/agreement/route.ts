import { addAdminNotice } from "@/lib/adminNotice";
import { NextResponse } from "next/server";
import { supabaseService } from "@/lib/apiAuth";
import { refreshInfluencerTrustMetrics } from "@/lib/influencerMetrics";
import {
  brandHasAccount,
  guardProposalAction,
  influencerContact,
  isGuardFailure,
  loadProposal,
  partyOf,
  requireActor,
} from "@/lib/proposalAccess";
import { brandLink, mailAdminAgreementComplete, mailAgreement, mailBrandDealComplete, mailCreatorDealComplete } from "@/lib/proposalMail";
import { deferAfterResponse, pushParty } from "@/lib/proposalNotify";
import { publicProfilePath } from "@/lib/profileSlug";
import { sendPushAdminAgreementComplete } from "@/lib/push";
import { partyProposalView, type ProposalParty } from "@/lib/proposalParty";
import { showcaseAddPostUrl } from "@/lib/showcaseAddPost";
import { showcaseOptOutUrl } from "@/lib/showcaseOptOut";
import { parsePublishDeadline } from "@/lib/publishDeadline";

function preferredParty(value: unknown): ProposalParty | null {
  return value === "influencer" || value === "brand" ? value : null;
}

export async function GET(request: Request) {
  try {
    const session = await requireActor(request);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const id = new URL(request.url).searchParams.get("proposalId") || "";
    if (!id) return NextResponse.json({ error: "proposalId required" }, { status: 400 });
    const proposal = await loadProposal(id);
    if (!proposal || !partyOf(session.actor, proposal)) {
      return NextResponse.json({ error: "Proposal not found" }, { status: 404 });
    }
    return NextResponse.json({
      proposal: partyProposalView({
        id: proposal.id,
        influencer_id: proposal.influencer_id,
        brand_name: proposal.brand_name,
        brand_email: proposal.brand_email,
        service_type: proposal.service_type,
        budget: proposal.budget,
        status: proposal.status,
        counter_proposal_budget: proposal.counter_proposal_budget,
        counter_proposal_status: proposal.counter_proposal_status,
        influencer_agreement_accepted: proposal.influencer_agreement_accepted,
        brand_agreement_accepted: proposal.brand_agreement_accepted,
      }),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not load the agreement";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    if (body.accepted !== true) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }
    const guarded = await guardProposalAction(request, body.proposalId, "agree", preferredParty(body.userType));
    if (isGuardFailure(guarded)) return guarded;

    const proposal = guarded.proposal;
    const party = guarded.party;
    const acceptedAt = new Date().toISOString();
    const updateData: Record<string, unknown> = {};
    const hasDeadline =
      typeof proposal.publish_deadline === "string" && proposal.publish_deadline.trim().length > 0;
    if (!hasDeadline) {
      const parsed = parsePublishDeadline(body.publishDeadline);
      if (!parsed.ok || !parsed.date) {
        return NextResponse.json(
          { error: "Publication deadline is required before accepting the agreement." },
          { status: 400 }
        );
      }
      updateData.publish_deadline = parsed.date;
    }
    if (party === "influencer") {
      updateData.influencer_agreement_accepted = true;
      if (!proposal.influencer_agreement_accepted_at) {
        updateData.influencer_agreement_accepted_at = acceptedAt;
      }
      if (typeof body.showcaseConsent === "boolean") {
        updateData.influencer_showcase_consent = body.showcaseConsent;
      }
    }
    if (party === "brand") {
      updateData.brand_agreement_accepted = true;
      if (!proposal.brand_agreement_accepted_at) {
        updateData.brand_agreement_accepted_at = acceptedAt;
      }
      if (typeof body.showcaseConsent === "boolean") {
        updateData.brand_showcase_consent = body.showcaseConsent;
      }
    }

    const influencerAccepted = party === "influencer" ? true : !!proposal.influencer_agreement_accepted;
    const brandAccepted = party === "brand" ? true : !!proposal.brand_agreement_accepted;
    const amount = String(proposal.counter_proposal_status === "accepted" && proposal.counter_proposal_budget
      ? proposal.counter_proposal_budget
      : proposal.budget || "");
    const completed = influencerAccepted && brandAccepted && !proposal.brand_added_to_past_brands;

    if (completed) {
      // Mutual agreement → completed. Collaborations are derived from
      // proposals (status=completed); there is no influencers.past_brands column.
      updateData.status = "completed";
      updateData.agreement_accepted_at = new Date().toISOString();
      updateData.brand_added_to_past_brands = true;
    }

    const { error } = await supabaseService().from("proposals").update(updateData).eq("id", proposal.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const otherSide = party === "influencer" ? "brand" : "influencer";
    deferAfterResponse(async () => {
      const influencer = await influencerContact(proposal.influencer_id);
      const brandName = proposal.brand_name || "Επιχείρηση";
      const email = proposal.brand_email;
      const notifyOther = pushParty({
        type: completed ? "collaboration_complete" : "agreement_accepted",
        side: otherSide,
        influencerId: proposal.influencer_id,
        brandEmail: email,
        payload:
          otherSide === "brand"
            ? {
                title: completed ? "Η συνεργασία ξεκίνησε" : "Αποδοχή συμφωνίας",
                body: `${influencer.name} αποδέχτηκε τη συμφωνία.`,
                url: "/brand/dashboard",
                tag: completed ? "agreement-complete" : "agreement-accepted",
              }
            : {
                title: completed ? "Η συνεργασία ξεκίνησε" : "Αποδοχή συμφωνίας",
                body: `${brandName} αποδέχτηκε τη συμφωνία.`,
                url: "/dashboard",
                tag: completed ? "agreement-complete" : "agreement-accepted",
              },
      });
      if (completed) {
        const brandAcceptedAt = party === "brand"
          ? proposal.brand_agreement_accepted_at || acceptedAt
          : proposal.brand_agreement_accepted_at;
        const creatorAcceptedAt = party === "influencer"
          ? proposal.influencer_agreement_accepted_at || acceptedAt
          : proposal.influencer_agreement_accepted_at;
        const notifyAdmin = (async () => {
          try {
            let profilePath = publicProfilePath(null, proposal.influencer_id);
            const slugRow = await supabaseService()
              .from("influencers")
              .select("profile_slug")
              .eq("id", proposal.influencer_id)
              .maybeSingle();
            const slug = !slugRow.error && typeof slugRow.data?.profile_slug === "string"
              ? slugRow.data.profile_slug
              : null;
            if (slug) profilePath = publicProfilePath(slug, proposal.influencer_id);
            const site = (process.env.NEXT_PUBLIC_SITE_URL || "https://influo.gr").replace(/\/$/, "");
            await mailAdminAgreementComplete({
              proposalId: proposal.id,
              brandName,
              brandEmail: email || "",
              creatorName: influencer.name,
              profileUrl: `${site}${profilePath}`,
              service: proposal.service_type || "",
              budget: amount,
              extras: proposal.selected_extras,
              publishDeadline: proposal.publish_deadline,
              brandAcceptedAt,
              creatorAcceptedAt,
            });
            await addAdminNotice({
              kind: "agreement_complete",
              title: `Η συνεργασία ξεκίνησε: ${brandName} / ${influencer.name}`,
              url: "/admin",
              dedupeKey: `agreement_complete:${proposal.id}`,
            });
            await sendPushAdminAgreementComplete({
              proposalId: proposal.id,
              brandName,
              creatorName: influencer.name,
            });
          } catch (error) {
            console.error("[agreement admin]", error instanceof Error ? error.message : error);
          }
        })();
        await Promise.all([
          (async () => {
            // Deal-complete emails to both sides. Runs once: `completed` is only
            // true on the transition (brand_added_to_past_brands guard).
            try {
              const site = (process.env.NEXT_PUBLIC_SITE_URL || "https://influo.gr").replace(/\/$/, "");
              const completedAt = String(updateData.agreement_accepted_at || acceptedAt);
              const common = {
                proposalId: proposal.id,
                service: proposal.service_type || "",
                budget: amount,
                extras: proposal.selected_extras,
                publishDeadline: proposal.publish_deadline,
                completedAt,
              };
              const influencerConsent =
                party === "influencer"
                  ? typeof body.showcaseConsent === "boolean"
                    ? body.showcaseConsent
                    : !!proposal.influencer_showcase_consent
                  : !!proposal.influencer_showcase_consent;
              const brandConsent =
                party === "brand"
                  ? typeof body.showcaseConsent === "boolean"
                    ? body.showcaseConsent
                    : !!proposal.brand_showcase_consent
                  : !!proposal.brand_showcase_consent;
              const proposalId = String(proposal.id);
              await Promise.all([
                mailCreatorDealComplete({
                  ...common,
                  to: influencer.email,
                  creatorName: influencer.name,
                  brandName,
                  dashboardUrl: `${site}/dashboard?tab=proposals`,
                  showcaseOptOutUrl: influencerConsent
                    ? showcaseOptOutUrl("proposal", proposalId, "influencer", "el")
                    : null,
                  // Agreement lock is before publish — post URL is almost always missing.
                  addPostUrl: String(proposal.published_post_url || "").trim()
                    ? null
                    : showcaseAddPostUrl("proposal", proposalId, "el"),
                }).catch((e) => console.error("[deal complete creator mail]", e instanceof Error ? e.message : e)),
                mailBrandDealComplete({
                  ...common,
                  to: email,
                  brandName,
                  creatorName: influencer.name,
                  dashboardUrl: brandLink(email || "", email ? await brandHasAccount(email) : false),
                  showcaseOptOutUrl: brandConsent
                    ? showcaseOptOutUrl("proposal", proposalId, "brand", "el")
                    : null,
                }).catch((e) => console.error("[deal complete brand mail]", e instanceof Error ? e.message : e)),
              ]);
            } catch (error) {
              console.error("[deal complete mails]", error instanceof Error ? error.message : error);
            }
          })(),
          notifyOther,
          refreshInfluencerTrustMetrics(supabaseService(), String(proposal.influencer_id)),
          notifyAdmin,
        ]);
        return;
      }
      if (party === "influencer") {
        await Promise.all([
          mailAgreement({
            to: email,
            recipientName: brandName,
            otherName: influencer.name,
            service: proposal.service_type || "",
            budget: amount,
            proposalId: proposal.id,
            extras: proposal.selected_extras,
            publishDeadline: proposal.publish_deadline,
            toBrand: true,
            brandHasAccount: email ? await brandHasAccount(email) : false,
          }),
          notifyOther,
        ]);
        return;
      }
      await Promise.all([
        mailAgreement({
          to: influencer.email,
          recipientName: influencer.name,
          otherName: brandName,
          service: proposal.service_type || "",
          budget: amount,
          proposalId: proposal.id,
          extras: proposal.selected_extras,
          publishDeadline: proposal.publish_deadline,
          toBrand: false,
          brandHasAccount: false,
        }),
        notifyOther,
      ]);
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not save the agreement";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
