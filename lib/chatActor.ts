import type { User } from "@supabase/supabase-js";
import { supabaseService } from "@/lib/apiAuth";

export type ChatActor = {
  userId: string;
  email: string;
  influencerId: string | null;
  influencerName: string | null;
  brandId: string | null;
  brandName: string | null;
  brandEmail: string | null;
};

export type ConversationParty = {
  influencer_id: string;
  brand_email: string | null;
};

function normEmail(value: string | null | undefined): string {
  return (value || "").toLowerCase().trim();
}

type Row = Record<string, unknown> | null;

async function maybeSingle(query: PromiseLike<{ data: Row; error: { message: string } | null }>): Promise<Row> {
  try {
    const { data, error } = await query;
    if (error) return null;
    return data;
  } catch {
    return null;
  }
}

/** Who the signed-in user is allowed to send as. Emails come from private tables first. */
export async function loadChatActor(user: User): Promise<ChatActor> {
  const admin = supabaseService();
  const email = normEmail(user.email);

  let influencerId: string | null = null;
  let influencerName: string | null = null;

  const byId = await maybeSingle(
    admin.from("influencers").select("id, display_name").eq("id", user.id).maybeSingle()
  );
  if (byId?.id) {
    influencerId = String(byId.id);
    influencerName = typeof byId.display_name === "string" ? byId.display_name : null;
  } else {
    const byAuth = await maybeSingle(
      admin.from("influencer_private").select("influencer_id").eq("auth_user_id", user.id).maybeSingle()
    );
    let pid = byAuth?.influencer_id ? String(byAuth.influencer_id) : "";
    if (!pid && email) {
      const byMail = await maybeSingle(
        admin.from("influencer_private").select("influencer_id").ilike("contact_email", email).maybeSingle()
      );
      pid = byMail?.influencer_id ? String(byMail.influencer_id) : "";
    }
    if (!pid && email) {
      const legacy = await maybeSingle(
        admin.from("influencers").select("id, display_name").ilike("contact_email", email).maybeSingle()
      );
      if (legacy?.id) {
        influencerId = String(legacy.id);
        influencerName = typeof legacy.display_name === "string" ? legacy.display_name : null;
      }
    } else if (pid) {
      influencerId = pid;
      const name = await maybeSingle(
        admin.from("influencers").select("display_name").eq("id", pid).maybeSingle()
      );
      influencerName = typeof name?.display_name === "string" ? name.display_name : null;
    }
  }

  let brandId: string | null = null;
  let brandName: string | null = null;
  let brandEmail: string | null = null;

  const brandById = await maybeSingle(
    admin.from("brands").select("id, brand_name").eq("id", user.id).maybeSingle()
  );
  if (brandById?.id) {
    brandId = String(brandById.id);
    brandName = typeof brandById.brand_name === "string" ? brandById.brand_name : null;
  } else if (email) {
    const priv = await maybeSingle(
      admin.from("brand_private").select("brand_id, contact_email").ilike("contact_email", email).maybeSingle()
    );
    if (priv?.brand_id) {
      brandId = String(priv.brand_id);
      brandEmail = normEmail(typeof priv.contact_email === "string" ? priv.contact_email : email) || null;
      const name = await maybeSingle(
        admin.from("brands").select("brand_name").eq("id", brandId).maybeSingle()
      );
      brandName = typeof name?.brand_name === "string" ? name.brand_name : null;
    } else {
      const legacy = await maybeSingle(
        admin.from("brands").select("id, brand_name, contact_email").ilike("contact_email", email).maybeSingle()
      );
      if (legacy?.id) {
        brandId = String(legacy.id);
        brandName = typeof legacy.brand_name === "string" ? legacy.brand_name : null;
        brandEmail = normEmail(typeof legacy.contact_email === "string" ? legacy.contact_email : email) || null;
      }
    }
  }

  if (brandId && !brandEmail) {
    const priv = await maybeSingle(
      admin.from("brand_private").select("contact_email").eq("brand_id", brandId).maybeSingle()
    );
    const fromPrivate = normEmail(typeof priv?.contact_email === "string" ? priv.contact_email : "");
    if (fromPrivate) brandEmail = fromPrivate;
    else if (email) {
      const legacy = await maybeSingle(
        admin.from("brands").select("contact_email").eq("id", brandId).maybeSingle()
      );
      brandEmail =
        normEmail(typeof legacy?.contact_email === "string" ? legacy.contact_email : "") || email || null;
    }
  }

  return {
    userId: user.id,
    email,
    influencerId,
    influencerName,
    brandId,
    brandName,
    brandEmail,
  };
}

export function isChatParticipant(actor: ChatActor, conv: ConversationParty): boolean {
  const asInfluencer = !!actor.influencerId && actor.influencerId === conv.influencer_id;
  const asBrand =
    !!actor.brandEmail && actor.brandEmail === normEmail(conv.brand_email);
  return asInfluencer || asBrand;
}

export function senderIdFor(actor: ChatActor, senderType: "influencer" | "brand", conv?: ConversationParty): string | null {
  if (senderType === "influencer") return actor.influencerId;
  if (conv?.brand_email) return normEmail(conv.brand_email);
  return actor.brandEmail;
}
