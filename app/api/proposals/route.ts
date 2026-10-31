import { NextResponse } from "next/server";
import { supabaseService } from "@/lib/apiAuth";
import { requireActor, influencerContact, brandHasAccount, listForRole, loadProposal, partyOf } from "@/lib/proposalAccess";
import { ensureProposalThread } from "@/lib/proposalChat";
import { mailNewProposal } from "@/lib/proposalMail";
import { deferAfterResponse, pushParty } from "@/lib/proposalNotify";
import { formatEuroAmount } from "@/lib/formatEuro";
import {
  cleanBudget,
  clipText,
  guestCreateDecision,
  isPlausibleEmail,
  normEmail,
  partyProposalView,
} from "@/lib/proposalParty";

const PROPOSAL_COLUMNS =
  "id, influencer_id, brand_name, brand_email, brand_id, service_type, budget, message, status, created_at, counter_proposal_budget, counter_proposal_message, counter_proposal_status, counter_proposal_created_at, influencer_agreement_accepted, brand_agreement_accepted, agreement_accepted_at, brand_added_to_past_brands";

function proposalJson(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });
}

export async function GET(request: Request) {
  try {
    const session = await requireActor(request);
    if (!session) return proposalJson({ error: "Unauthorized" }, 401);

    const url = new URL(request.url);
    const id = (url.searchParams.get("id") || "").trim();
    if (id) {
      const proposal = await loadProposal(id);
      if (!proposal || !partyOf(session.actor, proposal)) {
        return proposalJson({ error: "Proposal not found" }, 404);
      }
      const { data, error } = await supabaseService().from("proposals").select(PROPOSAL_COLUMNS).eq("id", id).maybeSingle();
      if (error || !data) return proposalJson({ error: "Proposal not found" }, 404);
      return proposalJson({ proposal: partyProposalView(data as Record<string, unknown>) });
    }

    const role = url.searchParams.get("role");
    if (role !== "influencer" && role !== "brand") {
      return proposalJson({ error: "role must be influencer or brand" }, 400);
    }
    const proposals = await listForRole(session.actor, role);
    return proposalJson({ proposals });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not load proposals";
    return proposalJson({ error: message }, 500);
  }
}

async function insertProposal(row: Record<string, unknown>): Promise<{ id: string | number } | { error: string }> {
  const admin = supabaseService();
  const payload: Record<string, unknown> = { ...row };
  let lastError = "Could not save the proposal";
  for (let attempt = 0; attempt < 4; attempt++) {
    const result = await admin.from("proposals").insert([payload]).select("id").single();
    if (!result.error && result.data) return { id: result.data.id as string | number };
    lastError = result.error?.message || lastError;
    if (/brand_id/i.test(lastError) && "brand_id" in payload) {
      delete payload.brand_id;
      continue;
    }
    if (/counter_proposal_status/i.test(lastError) && "counter_proposal_status" in payload) {
      delete payload.counter_proposal_status;
      continue;
    }
    break;
  }
  return { error: lastError };
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const influencerId = clipText(body.influencerId, 80);
    const service = clipText(body.serviceType, 120);
    const budget = cleanBudget(body.budget);
    const message = clipText(body.message, 4000);
    if (!influencerId || !service || !budget) {
      return NextResponse.json({ error: "Συμπληρώστε υπηρεσία, budget και influencer." }, { status: 400 });
    }

    const profile = await supabaseService().from("influencers").select("id, display_name").eq("id", influencerId).maybeSingle();
    if (!profile.data) return NextResponse.json({ error: "Influencer not found" }, { status: 404 });

    const session = await requireActor(request);
    let brandName = "";
    let brandEmail = "";
    let brandId: string | null = null;
    let signedIn = false;

    if (session) {
      if (!session.actor.brandEmail || !session.actor.brandId) {
        return NextResponse.json({ error: "Συνδεθείτε ως επιχείρηση για να στείλετε πρόταση." }, { status: 403 });
      }
      if (session.actor.influencerId && session.actor.influencerId === influencerId) {
        return NextResponse.json({ error: "Δεν μπορείτε να στείλετε πρόταση στον εαυτό σας." }, { status: 403 });
      }
      brandEmail = session.actor.brandEmail;
      brandName = session.actor.brandName || brandEmail;
      brandId = session.actor.brandId;
      signedIn = true;
    } else {
      brandName = clipText(body.brandName, 120);
      brandEmail = normEmail(body.brandEmail);
      if (!brandName || !isPlausibleEmail(brandEmail)) {
        return NextResponse.json({ error: "Συμπληρώστε όνομα και έγκυρο email επιχείρησης." }, { status: 400 });
      }
      if (guestCreateDecision(await brandHasAccount(brandEmail)) === "login_required") {
        return NextResponse.json(
          {
            error: "Αυτό το email ανήκει σε λογαριασμό. Συνδεθείτε για να στείλετε την πρόταση.",
            code: "login_required",
          },
          { status: 401 }
        );
      }
    }

    const influencer = await influencerContact(influencerId);
    if (normEmail(influencer.email) && normEmail(influencer.email) === brandEmail) {
      return NextResponse.json({ error: "Δεν μπορείτε να στείλετε πρόταση στον εαυτό σας." }, { status: 403 });
    }

    const saved = await insertProposal({
      influencer_id: influencerId,
      brand_name: brandName,
      brand_email: brandEmail,
      brand_id: brandId,
      service_type: service,
      budget,
      message: message || null,
      status: "pending",
      counter_proposal_status: "none",
    });
    if ("error" in saved) return NextResponse.json({ error: saved.error }, { status: 500 });

    const content = `Νέα πρόταση: ${service} | Budget: ${formatEuroAmount(budget) || budget}${message ? `\n\n${message}` : ""}`;
    let conversationId: string | null = null;
    try {
      conversationId = await ensureProposalThread({
        influencerId,
        brandEmail,
        brandName,
        proposalId: saved.id,
        content,
        replaceLink: true,
        alreadyNotified: !signedIn,
      });
    } catch (error) {
      console.error("[proposal chat]", error instanceof Error ? error.message : "failed");
    }

    const influencerName = influencer.name || profile.data.display_name || "Influencer";
    const proposalId = saved.id;
    deferAfterResponse(async () => {
      await Promise.all([
        mailNewProposal({
          influencerEmail: influencer.email,
          influencerName,
          brandEmail,
          brandName,
          service,
          budget,
          message,
        }),
        pushParty({
          type: "proposal_new",
          side: "influencer",
          influencerId,
          brandEmail,
          conversationId,
          payload: {
            title: "Νέα πρόταση συνεργασίας",
            body: `${brandName}: ${service} | ${formatEuroAmount(budget) || budget}`,
            url: "/dashboard",
            tag: "proposal",
          },
        }),
        supabaseService()
          .from("influencer_analytics")
          .insert([
            {
              influencer_id: influencerId,
              event_type: "proposal_sent",
              brand_email: brandEmail,
              brand_name: brandName,
              metadata: { proposal_id: proposalId, service_type: service, budget },
            },
          ])
          .then(() => undefined),
      ]);
    });

    return NextResponse.json({ success: true, proposalId: saved.id });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not send the proposal";
    console.error("[proposal create]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
