import { NextRequest, NextResponse } from "next/server";
import { supabaseService, userFromBearer } from "@/lib/apiAuth";
import { addAdminNotice } from "@/lib/adminNotice";
import { ensureProposalThread } from "@/lib/proposalChat";
import { creatorContact, notifyApplicationStatus } from "@/lib/campaignNotify";
import { acceptedToBrand, acceptedToCreator, applicationToBrand, applicationToCreator } from "@/lib/campaignMail";
import { mailAdminEvent, send } from "@/lib/proposalMail";
import { deferAfterResponse } from "@/lib/proposalNotify";
import { sendPushAdminNewCampaignApplication, sendPushBrandNewCampaignApplication, sendPushToBrand, sendPushToInfluencer } from "@/lib/push";

const noticeStore = globalThis as unknown as { __influoAppNotices?: Set<string> };
const sentNotices = (noticeStore.__influoAppNotices ??= new Set<string>());

/**
 * In-app notice in the brand dashboard (same announcements table as creator campaign notices,
 * target_type "specific_brand"). Idempotent per application: in-process set plus a DB check.
 */
async function brandApplicationNotice(
  admin: ReturnType<typeof supabaseService>,
  applicationId: string,
  brandId: string,
  influencerName: string,
  campaignTitle: string
): Promise<void> {
  if (sentNotices.has(applicationId)) return;
  sentNotices.add(applicationId);
  const title = `Νέα αίτηση: ${influencerName} — ${campaignTitle}`.slice(0, 180);
  const body = `Ο/Η ${influencerName} έκανε αίτηση στην καμπάνια «${campaignTitle}». Δες την στις Καμπάνιες του dashboard.`;
  const { data: existing } = await admin
    .from("announcements")
    .select("id")
    .eq("target_type", "specific_brand")
    .eq("target_brand_id", brandId)
    .eq("title", title)
    .limit(1);
  if (existing?.length) return;
  const { error } = await admin.from("announcements").insert({ title, body, target_type: "specific_brand", target_brand_id: brandId });
  if (error) console.error("[campaign application] brand notice insert", error.code, error.message);
}

/** Server-side notifications after a new application is saved: brand email + push, creator confirmation. */
function notifyNewApplication(applicationId: string, influencerId: string): void {
  deferAfterResponse(async () => {
    try {
      const admin = supabaseService();
      const { data: app } = await admin
        .from("campaign_applications")
        .select("id, message, proposed_price, work_links, brand_campaigns ( id, title, brand_id, brands ( brand_name, contact_email ) )")
        .eq("id", applicationId)
        .maybeSingle();
      if (!app) return;
      const rawBc = app.brand_campaigns as unknown;
      const bc = (Array.isArray(rawBc) ? rawBc[0] : rawBc) as {
        id?: string;
        title?: string;
        brand_id?: string | null;
        brands?: { brand_name?: string; contact_email?: string } | { brand_name?: string; contact_email?: string }[] | null;
      } | null;
      const brandRow = Array.isArray(bc?.brands) ? bc?.brands[0] : bc?.brands;
      const brandEmail = (brandRow?.contact_email || "").trim().toLowerCase();
      const brandName = brandRow?.brand_name || "Επιχείρηση";
      const campaignTitle = bc?.title || "Καμπάνια";
      const person = await creatorContact(influencerId);
      const influencerName = person?.name || "Influencer";
      const row = app as { message?: string | null; proposed_price?: number | null; work_links?: string | null };
      const jobs: Promise<unknown>[] = [];
      if (brandEmail) {
        const toBrand = applicationToBrand({
          brandEmail,
          brandName,
          campaignTitle,
          influencerName,
          message: row.message ?? null,
          proposedPrice: row.proposed_price ?? null,
          workLinks: row.work_links ?? null,
          brandHasAccount: true,
        });
        jobs.push(send("campaign_application_brand", brandEmail, toBrand.subject, toBrand.html));
        jobs.push(
          sendPushBrandNewCampaignApplication({ brandEmail, campaignTitle, influencerName, applicationId }).catch((err) =>
            console.error("[campaign application] brand push", err)
          )
        );
      }
      jobs.push(
        sendPushAdminNewCampaignApplication({ campaignTitle, brandName, influencerName, applicationId }).catch((err) =>
          console.error("[campaign application] admin push", err)
        )
      );
      jobs.push(
        addAdminNotice({
          kind: "campaign_application",
          title: `Νέα αίτηση σε καμπάνια: ${influencerName} / ${brandName}`,
          body: `Καμπάνια: ${campaignTitle}`,
          url: "/admin",
          dedupeKey: `campaign_application:${applicationId}`,
        })
      );
      if (bc?.brand_id) {
        jobs.push(
          brandApplicationNotice(admin, applicationId, String(bc.brand_id), influencerName, campaignTitle).catch((err) =>
            console.error("[campaign application] brand in-app notice", err instanceof Error ? err.message : err)
          )
        );
      }
      if (!brandEmail) {
        console.warn("[campaign application] brand missing contact_email", bc?.id || "unknown_campaign");
      }
      if (person?.email) {
        const toCreator = applicationToCreator({
          influencerName,
          campaignTitle,
          brandName,
          campaignId: bc?.id || "",
          proposedPrice: row.proposed_price ?? null,
        });
        jobs.push(send("campaign_application_creator", person.email, toCreator.subject, toCreator.html));
      }
      jobs.push(
        mailAdminEvent("campaign_application_admin", `Νέα αίτηση καμπάνιας: ${influencerName} / ${brandName}`, "Νέα αίτηση σε καμπάνια", [
          ["Καμπάνια", campaignTitle],
          ["Επιχείρηση", brandName],
          ["Δημιουργός", influencerName],
          ["Προτεινόμενη τιμή", row.proposed_price != null ? `${Math.round(Number(row.proposed_price))} €` : null],
        ])
      );
      await Promise.all(jobs);
    } catch (err) {
      console.error("[campaign application] notify", err);
    }
  });
}

/** Accepted application → proposal created: creator + brand email and push. */
function notifyAcceptedApplication(input: {
  influencerId: string;
  brandEmail: string;
  brandName: string;
  campaignTitle: string;
  budget: number;
  proposalId: string | number | null;
}): void {
  deferAfterResponse(async () => {
    try {
      const person = await creatorContact(input.influencerId);
      const influencerName = person?.name || "Influencer";
      const toCreator = acceptedToCreator({ influencerName, brandName: input.brandName, campaignTitle: input.campaignTitle, budget: input.budget, proposalId: input.proposalId });
      const toBrand = acceptedToBrand({ brandEmail: input.brandEmail, brandName: input.brandName, influencerName, campaignTitle: input.campaignTitle, budget: input.budget, proposalId: input.proposalId });
      await Promise.all([
        person?.email ? send("campaign_accepted_creator", person.email, toCreator.subject, toCreator.html) : Promise.resolve(),
        input.brandEmail ? send("campaign_accepted_brand", input.brandEmail, toBrand.subject, toBrand.html) : Promise.resolve(),
        sendPushToInfluencer(input.influencerId, {
          title: "Η αίτησή σου έγινε αποδεκτή",
          body: `${input.brandName}: ${input.campaignTitle}`.slice(0, 120),
          url: "/dashboard?tab=proposals",
          tag: `campaign-accepted-${input.proposalId ?? input.campaignTitle}`,
        }).catch((err) => console.error("[campaign accept] creator push", err)),
        mailAdminEvent(
          "campaign_accepted_admin",
          `Αίτηση αποδεκτή, νέα συνεργασία: ${influencerName} / ${input.brandName}`,
          "Η επιχείρηση αποδέχτηκε αίτηση καμπάνιας (δημιουργήθηκε πρόταση)",
          [
            ["Πρόταση", input.proposalId != null ? `#${input.proposalId}` : "δεν δημιουργήθηκε"],
            ["Καμπάνια", input.campaignTitle],
            ["Επιχείρηση", input.brandName],
            ["Δημιουργός", influencerName],
            ["Ποσό", `${Math.round(input.budget)} €`],
          ]
        ),
        input.brandEmail
          ? sendPushToBrand(input.brandEmail, {
              title: "Η συνεργασία δημιουργήθηκε",
              body: `${influencerName}: ${input.campaignTitle}`.slice(0, 120),
              url: "/brand/dashboard?tab=proposals",
              tag: `campaign-accepted-${input.proposalId ?? input.campaignTitle}`,
            }).catch((err) => console.error("[campaign accept] brand push", err))
          : Promise.resolve(),
      ]);
    } catch (err) {
      console.error("[campaign accept] notify", err);
    }
  });
}
import { findContactInfo, filterWorkLinks } from "@/lib/contactFilter";

const STATUSES = new Set(["pending", "shortlisted", "rejected", "accepted"]);

async function createApplication(request: NextRequest, body: Record<string, unknown>) {
  const user = await userFromBearer(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const campaignId = String(body.campaignId || "").trim();
  const influencerIdRaw = String(body.influencerId || "").trim();
  const message = String(body.message ?? "");
  const workLinksRaw = String(body.workLinks ?? "");
  const proposedPriceRaw = body.proposedPrice != null ? String(body.proposedPrice) : "";

  if (!campaignId) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const contactHit = findContactInfo(message);
  if (contactHit) {
    return NextResponse.json(
      { error: "contact_info_not_allowed", field: "message", kind: contactHit },
      { status: 400 }
    );
  }

  const filtered = filterWorkLinks(workLinksRaw);
  if (filtered.rejected.length > 0) {
    return NextResponse.json(
      { error: "work_link_not_allowed", rejected: filtered.rejected },
      { status: 400 }
    );
  }

  const admin = supabaseService();
  const userEmail = (user.email || "").trim().toLowerCase();
  const influencerCols = "id, approved, availability_status, auth_user_id, contact_email";

  let influencer: {
    id: string;
    approved: boolean | null;
    availability_status?: string | null;
    auth_user_id: string | null;
    contact_email: string | null;
  } | null = null;

  if (influencerIdRaw) {
    const { data } = await admin
      .from("influencers")
      .select(influencerCols)
      .eq("id", influencerIdRaw)
      .maybeSingle();
    influencer = data;
  } else {
    const byAuth = await admin
      .from("influencers")
      .select(influencerCols)
      .eq("auth_user_id", user.id)
      .maybeSingle();
    influencer = byAuth.data;
    if (!influencer && userEmail) {
      const byEmail = await admin
        .from("influencers")
        .select(influencerCols)
        .eq("contact_email", userEmail)
        .maybeSingle();
      influencer = byEmail.data;
    }
  }

  if (!influencer) {
    return NextResponse.json({ error: "Influencer not found" }, { status: 404 });
  }

  const ownsByAuth = influencer.auth_user_id === user.id;
  const ownsByEmail =
    influencer.auth_user_id == null &&
    !!userEmail &&
    (influencer.contact_email || "").trim().toLowerCase() === userEmail;
  if (!ownsByAuth && !ownsByEmail) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!influencer.approved) {
    return NextResponse.json({ error: "Not approved" }, { status: 403 });
  }

  const { data: campaign } = await admin
    .from("brand_campaigns")
    .select("id, status")
    .eq("id", campaignId)
    .maybeSingle();
  if (!campaign || campaign.status !== "open") {
    return NextResponse.json({ error: "Campaign not available" }, { status: 400 });
  }

  const price = proposedPriceRaw.trim()
    ? Number(proposedPriceRaw.replace(",", "."))
    : null;
  const base = {
    campaign_id: campaignId,
    influencer_id: influencer.id,
    message: message.trim() || null,
    status: "pending" as const,
  };
  const full: Record<string, unknown> = { ...base };
  if (price != null && Number.isFinite(price) && price >= 0) full.proposed_price = price;
  if (filtered.ok.length > 0) full.work_links = filtered.ok.join("\n");

  let result = await admin.from("campaign_applications").insert(full).select("id").single();
  if (result.error && /proposed_price|work_links|schema cache|column/i.test(result.error.message)) {
    result = await admin.from("campaign_applications").insert(base).select("id").single();
    if (!result.error) {
      if (result.data?.id) notifyNewApplication(String(result.data.id), influencer.id);
      return NextResponse.json({ ok: true, id: result.data?.id, migration: true, notified: true });
    }
  }
  if (result.error) {
    if (result.error.code === "23505") {
      return NextResponse.json({ error: "duplicate", duplicate: true }, { status: 409 });
    }
    return NextResponse.json({ error: result.error.message }, { status: 400 });
  }
  if (result.data?.id) notifyNewApplication(String(result.data.id), influencer.id);
  return NextResponse.json({ ok: true, id: result.data?.id, notified: true });
}

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;

  // Create application (influencer apply)
  if (body.campaignId && !body.applicationId) {
    return createApplication(request, body);
  }

  const user = await userFromBearer(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const applicationId = String(body.applicationId || "");
  const status = String(body.status || "");
  if (!applicationId || !STATUSES.has(status)) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const admin = supabaseService();
  const { data: app } = await admin
    .from("campaign_applications")
    .select("id, influencer_id, campaign_id, message, status, brand_campaigns ( id, title, budget, brand_id, brands ( brand_name, contact_email ) )")
    .eq("id", applicationId)
    .maybeSingle();
  if (!app) return NextResponse.json({ error: "Application not found" }, { status: 404 });

  const campaignRaw = app.brand_campaigns as unknown;
  const campaign = (Array.isArray(campaignRaw) ? campaignRaw[0] : campaignRaw) as {
    id: string;
    title: string;
    budget: number;
    brand_id: string;
    brands?: { brand_name?: string; contact_email?: string } | { brand_name?: string; contact_email?: string }[] | null;
  } | null;
  if (!campaign || campaign.brand_id !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { error: updateError } = await admin
    .from("campaign_applications")
    .update({ status, reviewed_at: new Date().toISOString() })
    .eq("id", applicationId);
  if (updateError) {
    const migration = /check constraint|status/i.test(updateError.message);
    return NextResponse.json(
      {
        error: migration
          ? "Run docs/CAMPAIGN_WORKFLOW_2026.sql in Supabase so applications can be accepted."
          : updateError.message,
      },
      { status: 400 }
    );
  }

  let conversationId: string | null = null;
  let proposalId: string | number | null = null;
  // "accepted" is announced below, together with the proposal it creates (one email per side).
  if ((status === "shortlisted" || status === "rejected") && app.status !== status) {
    await notifyApplicationStatus({
      influencerId: String(app.influencer_id),
      campaignTitle: campaign.title,
      status,
      campaignId: campaign.id,
    }).catch((err) => console.error("[campaign status notify]", err));
  }

  if (status === "accepted") {
    const brandRow = Array.isArray(campaign.brands) ? campaign.brands[0] : campaign.brands;
    const brandName = brandRow?.brand_name || "Brand";
    const brandEmail = (brandRow?.contact_email || user.email || "").toLowerCase();
    const budget = Math.max(1, Number(campaign.budget) || 0);
    const { data: proposal, error: proposalError } = await admin
      .from("proposals")
      .insert([
        {
          influencer_id: app.influencer_id,
          brand_name: brandName,
          brand_email: brandEmail,
          brand_id: user.id,
          service_type: `Καμπάνια: ${campaign.title}`.slice(0, 120),
          budget,
          message: `Αποδοχή αίτησης για την καμπάνια «${campaign.title}».`,
          status: "accepted",
          counter_proposal_status: "none",
        },
      ])
      .select("id")
      .single();
    if (!proposalError && proposal) {
      proposalId = proposal.id;
      if (app.status !== "accepted") notifyAcceptedApplication({
        influencerId: String(app.influencer_id),
        brandEmail,
        brandName,
        campaignTitle: campaign.title,
        budget,
        proposalId: proposal.id,
      });
      try {
        conversationId = await ensureProposalThread({
          influencerId: String(app.influencer_id),
          brandEmail,
          brandName,
          proposalId: proposal.id,
          content: `Η αίτησή σας για «${campaign.title}» έγινε αποδεκτή. Μπορούμε να συνεχίσουμε εδώ.`,
          replaceLink: true,
          alreadyNotified: true,
        });
      } catch (err) {
        console.error("[campaign accept thread]", err);
      }
    } else if (proposalError) {
      console.error("[campaign accept proposal]", proposalError.message);
      if (app.status !== "accepted") {
        notifyAcceptedApplication({
          influencerId: String(app.influencer_id),
          brandEmail,
          brandName,
          campaignTitle: campaign.title,
          budget,
          proposalId: null,
        });
      }
    }
  }

  return NextResponse.json({ ok: true, status, conversationId, proposalId });
}
