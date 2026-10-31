"use client";

import { useCallback, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { sessionFetch } from "@/lib/sessionFetch";
import { inviteHeading } from "@/lib/creatorAddress";
import {
  CampaignLoadError,
  CampaignPickModal,
  NoCampaignModal,
  type InviteCampaign,
} from "@/components/CampaignInviteModals";

const COPY = {
  el: {
    button: "Πρόσκληση σε καμπάνια",
    fallback: "Δεν στάλθηκε η πρόσκληση. Δοκίμασε ξανά.",
    defaultMessage: (title: string) => `Θα θέλαμε να σας προσκαλέσουμε στην καμπάνια «${title}».`,
  },
  en: {
    button: "Invite to campaign",
    fallback: "The invite was not sent. Try again.",
    defaultMessage: (title: string) => `We would like to invite you to the campaign “${title}”.`,
  },
} as const;

type Mode = "closed" | "empty" | "pick" | "error";

export default function CampaignInviteButton({
  lang,
  isBrand,
  brandId,
  influencerId,
  creatorName,
  gender,
  onNeedBrand,
}: {
  lang: "el" | "en";
  isBrand: boolean;
  brandId: string | null;
  influencerId: string;
  creatorName: string;
  gender?: string | null;
  onNeedBrand: () => void;
}) {
  const copy = COPY[lang];
  const [mode, setMode] = useState<Mode>("closed");
  const [busy, setBusy] = useState(false);
  const [campaigns, setCampaigns] = useState<InviteCampaign[]>([]);
  const close = useCallback(() => setMode("closed"), []);

  const open = async () => {
    if (!isBrand || !brandId) {
      onNeedBrand();
      return;
    }
    setBusy(true);
    try {
      const { data, error } = await supabase
        .from("brand_campaigns")
        .select("id, title, budget, status, deadline")
        .eq("brand_id", brandId)
        .in("status", ["open", "draft"])
        .order("updated_at", { ascending: false })
        .limit(20);
      if (error) {
        setMode("error");
        return;
      }
      const rows = (data || []) as InviteCampaign[];
      setCampaigns(rows);
      setMode(rows.length ? "pick" : "empty");
    } catch {
      setMode("error");
    } finally {
      setBusy(false);
    }
  };

  const send = async (input: { campaignId: string; message: string }) => {
    const campaign = campaigns.find((row) => row.id === input.campaignId);
    if (!campaign) throw new Error(copy.fallback);
    const budget = Math.max(1, Number(campaign.budget) || 0);
    const message = input.message || copy.defaultMessage(campaign.title);
    const proposal = await sessionFetch("/api/proposals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        influencerId,
        serviceType: `Καμπάνια: ${campaign.title}`.slice(0, 120),
        budget: String(budget),
        message,
      }),
    });
    const proposalBody = await proposal.json().catch(() => ({}));
    if (!proposal.ok || !proposalBody.success) {
      throw new Error(typeof proposalBody.error === "string" ? proposalBody.error : copy.fallback);
    }
    // Best-effort link on campaign_applications. Missing initiated_by column is fine:
    // the proposal, message, and notification above are the invite.
    try {
      await sessionFetch("/api/campaigns/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          influencerId,
          campaignId: campaign.id,
          message,
        }),
      });
    } catch {
      /* proposal already delivered */
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => void open()}
        disabled={busy}
        className="inline-flex min-h-11 w-full items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:from-blue-700 hover:to-purple-700 disabled:opacity-60 md:w-auto"
      >
        + {copy.button}
      </button>
      <NoCampaignModal open={mode === "empty"} onClose={close} lang={lang} />
      <CampaignLoadError open={mode === "error"} onClose={close} lang={lang} />
      {mode === "pick" ? (
        <CampaignPickModal
          open
          onClose={close}
          lang={lang}
          heading={inviteHeading(creatorName, gender, lang)}
          campaigns={campaigns}
          onSend={send}
        />
      ) : null}
    </>
  );
}
