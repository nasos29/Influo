import { NextResponse } from "next/server";
import type { User } from "@supabase/supabase-js";
import { supabaseService, userFromBearer } from "@/lib/apiAuth";
import { loadChatActor, type ChatActor } from "@/lib/chatActor";
import {
  actionAllowed,
  normEmail,
  partyProposalView,
  proposalParty,
  type ProposalAction,
  type ProposalParty,
} from "@/lib/proposalParty";

export type ProposalRow = {
  id: string | number;
  influencer_id: string;
  brand_name: string | null;
  brand_email: string | null;
  brand_id?: string | null;
  service_type: string | null;
  budget: string | null;
  message?: string | null;
  status: string | null;
  counter_proposal_budget?: string | null;
  counter_proposal_message?: string | null;
  counter_proposal_status?: string | null;
  counter_proposal_created_at?: string | null;
  influencer_agreement_accepted?: boolean | null;
  brand_agreement_accepted?: boolean | null;
  brand_added_to_past_brands?: boolean | null;
  agreement_accepted_at?: string | null;
  created_at?: string;
};

const LIST_COLUMNS =
  "id, influencer_id, brand_name, brand_email, brand_id, service_type, budget, message, status, created_at, counter_proposal_budget, counter_proposal_message, counter_proposal_status, counter_proposal_created_at, influencer_agreement_accepted, brand_agreement_accepted, agreement_accepted_at, brand_added_to_past_brands";

async function selectProposals(
  build: (columns: string) => PromiseLike<{ data: unknown[] | null; error: { message: string } | null }>
): Promise<Record<string, unknown>[]> {
  const first = await build(LIST_COLUMNS);
  if (!first.error) return (first.data || []) as Record<string, unknown>[];
  if (!/brand_id/i.test(first.error.message)) throw new Error(first.error.message);
  const second = await build(LIST_COLUMNS.replace(", brand_id", ""));
  if (second.error) throw new Error(second.error.message);
  return (second.data || []) as Record<string, unknown>[];
}
  "id, influencer_id, brand_name, brand_email, brand_id, service_type, budget, message, status, created_at, counter_proposal_budget, counter_proposal_message, counter_proposal_status, counter_proposal_created_at, influencer_agreement_accepted, brand_agreement_accepted, agreement_accepted_at, brand_added_to_past_brands";

export async function requireActor(request: Request): Promise<{ user: User; actor: ChatActor } | null> {
  const user = await userFromBearer(request);
  if (!user) return null;
  const actor = await loadChatActor(user);
  return { user, actor };
}

export async function loadProposal(id: string): Promise<ProposalRow | null> {
  const { data, error } = await supabaseService().from("proposals").select("*").eq("id", id).maybeSingle();
  if (error || !data) return null;
  return data as ProposalRow;
}

export async function influencerContact(influencerId: string): Promise<{ name: string; email: string | null }> {
  const admin = supabaseService();
  const nameRow = await admin.from("influencers").select("display_name").eq("id", influencerId).maybeSingle();
  const priv = await admin.from("influencer_private").select("contact_email").eq("influencer_id", influencerId).maybeSingle();
  const fromPrivate = !priv.error && typeof priv.data?.contact_email === "string" ? priv.data.contact_email.trim() : "";
  if (fromPrivate) return { name: nameRow.data?.display_name || "Influencer", email: fromPrivate };
  const legacy = await admin.from("influencers").select("display_name, contact_email").eq("id", influencerId).maybeSingle();
  const email = typeof legacy.data?.contact_email === "string" ? legacy.data.contact_email.trim() : "";
  return {
    name: legacy.data?.display_name || nameRow.data?.display_name || "Influencer",
    email: email || null,
  };
}

export async function brandHasAccount(email: string): Promise<boolean> {
  const normalized = normEmail(email);
  if (!normalized) return false;
  const admin = supabaseService();
  const priv = await admin.from("brand_private").select("brand_id").ilike("contact_email", normalized).maybeSingle();
  if (!priv.error && priv.data?.brand_id) return true;
  const legacy = await admin.from("brands").select("id").ilike("contact_email", normalized).maybeSingle();
  return !legacy.error && !!legacy.data?.id;
}

export function partyOf(actor: ChatActor, proposal: ProposalRow, preferred?: ProposalParty | null): ProposalParty | null {
  return proposalParty(
    { influencerId: actor.influencerId, brandId: actor.brandId, brandEmail: actor.brandEmail },
    proposal,
    preferred
  );
}

export async function guardProposalAction(
  request: Request,
  proposalId: unknown,
  action: ProposalAction,
  preferred?: ProposalParty | null
): Promise<{ proposal: ProposalRow; party: ProposalParty; actor: ChatActor } | NextResponse> {
  const session = await requireActor(request);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const id = proposalId == null ? "" : String(proposalId).trim();
  if (!id) return NextResponse.json({ error: "Missing proposalId" }, { status: 400 });
  const proposal = await loadProposal(id);
  if (!proposal) return NextResponse.json({ error: "Proposal not found" }, { status: 404 });
  const party = partyOf(session.actor, proposal, preferred);
  if (!party) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (!actionAllowed(party, action, proposal)) {
    return NextResponse.json({ error: "This action is not available for the current proposal." }, { status: 409 });
  }
  return { proposal, party, actor: session.actor };
}

export function isGuardFailure(
  value: { proposal: ProposalRow; party: ProposalParty; actor: ChatActor } | NextResponse
): value is NextResponse {
  return value instanceof Response;
}

export async function listForRole(actor: ChatActor, role: ProposalParty): Promise<Record<string, unknown>[]> {
  const admin = supabaseService();
  if (role === "influencer") {
    if (!actor.influencerId) return [];
    const rows = await selectProposals((columns) =>
      admin
        .from("proposals")
        .select(columns)
        .eq("influencer_id", actor.influencerId)
        .order("created_at", { ascending: false })
        .limit(200)
    );
    return rows.map((row) => partyProposalView(row));
  }

  const email = actor.brandEmail;
  const brandId = actor.brandId;
  if (!email && !brandId) return [];

  // brand_id is indexed. The email scan is only for accounts that have no brand id.
  if (brandId) {
    const rows = await selectProposals((columns) =>
      admin
        .from("proposals")
        .select(columns)
        .eq("brand_id", brandId)
        .order("created_at", { ascending: false })
        .limit(200)
    );
    return rows
      .map((row) => partyProposalView(row))
      .sort((a, b) => String(b.created_at || "").localeCompare(String(a.created_at || "")));
  }

  const rows = await selectProposals((columns) =>
    admin.from("proposals").select(columns).ilike("brand_email", email || "").order("created_at", { ascending: false }).limit(200)
  );
  return rows
    .map((row) => partyProposalView(row))
    .sort((a, b) => String(b.created_at || "").localeCompare(String(a.created_at || "")));
}
