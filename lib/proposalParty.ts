export type ProposalParty = "influencer" | "brand";

export type ProposalAction =
  | "accept"
  | "reject"
  | "counter"
  | "accept_counter"
  | "reject_counter"
  | "agree";

export type ProposalActor = {
  influencerId: string | null;
  brandId: string | null;
  brandEmail: string | null;
};

export type ProposalParties = {
  influencer_id: string;
  brand_email: string | null;
  brand_id?: string | null;
};

export type ProposalGate = {
  status: string | null;
  counter_proposal_status?: string | null;
  influencer_agreement_accepted?: boolean | null;
  brand_agreement_accepted?: boolean | null;
};

export function normEmail(value: unknown): string {
  return typeof value === "string" ? value.toLowerCase().trim() : "";
}

export function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function isPlausibleEmail(value: string): boolean {
  return value.length <= 200 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export function clipText(value: unknown, max: number): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

/** A budget is free text in the database, but it has to look like an amount. */
export function cleanBudget(value: unknown): string | null {
  const text = clipText(value, 40);
  if (!text || !/\d/.test(text)) return null;
  return text;
}

export function counterState(value: string | null | undefined): string {
  const status = (value || "none").toLowerCase();
  return status === "pending" || status === "accepted" || status === "rejected" ? status : "none";
}

/**
 * Which side this account is on.
 * `preferred` is the screen they are using. It counts only when that side really matches.
 */
export function proposalParty(
  actor: ProposalActor,
  proposal: ProposalParties,
  preferred?: ProposalParty | null
): ProposalParty | null {
  const asInfluencer = !!actor.influencerId && actor.influencerId === String(proposal.influencer_id);
  const email = normEmail(proposal.brand_email);
  const asBrand =
    (!!actor.brandEmail && !!email && actor.brandEmail === email) ||
    (!!actor.brandId && !!proposal.brand_id && actor.brandId === String(proposal.brand_id));
  if (preferred === "brand" && asBrand) return "brand";
  if (preferred === "influencer" && asInfluencer) return "influencer";
  if (asInfluencer) return "influencer";
  if (asBrand) return "brand";
  return null;
}

export function actionAllowed(party: ProposalParty | null, action: ProposalAction, row: ProposalGate): boolean {
  if (!party) return false;
  const status = (row.status || "").toLowerCase();
  const counter = counterState(row.counter_proposal_status);
  const agreementStarted = !!(row.influencer_agreement_accepted || row.brand_agreement_accepted);

  if (action === "accept" || action === "reject") {
    return party === "influencer" && status === "pending" && counter !== "pending";
  }
  if (action === "counter") {
    return party === "influencer" && status === "pending" && counter !== "pending" && !agreementStarted;
  }
  if (action === "accept_counter" || action === "reject_counter") {
    return party === "brand" && counter === "pending" && status !== "rejected";
  }
  if (action === "agree") {
    const open = status === "accepted" || status === "completed";
    const already = party === "influencer" ? row.influencer_agreement_accepted : row.brand_agreement_accepted;
    return open && !already;
  }
  return false;
}

/** A guest may file a proposal only when that email is not already a brand account. */
export function guestCreateDecision(emailBelongsToAccount: boolean): "ok" | "login_required" {
  return emailBelongsToAccount ? "login_required" : "ok";
}

const PARTY_FIELDS = [
  "id",
  "influencer_id",
  "brand_name",
  "brand_email",
  "brand_id",
  "service_type",
  "budget",
  "message",
  "status",
  "created_at",
  "counter_proposal_budget",
  "counter_proposal_message",
  "counter_proposal_status",
  "counter_proposal_created_at",
  "influencer_agreement_accepted",
  "brand_agreement_accepted",
  "agreement_accepted_at",
  "brand_added_to_past_brands",
] as const;

export function partyProposalView(row: Record<string, unknown>): Record<string, unknown> {
  const view: Record<string, unknown> = {};
  for (const key of PARTY_FIELDS) {
    if (key in row) view[key] = row[key];
  }
  return view;
}
