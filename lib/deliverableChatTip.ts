/**
 * Soft in-chat tip when someone pastes a WeTransfer / Drive / Dropbox /
 * Instagram reel|post / TikTok video link instead of the Παραδοτέο field.
 * Never blocks send; at most once per 12h per conversation (enforced by caller).
 */

export const DELIVERABLE_TIP_MARKER = "⟦influo:upload-deliverable⟧";

export const DELIVERABLE_TIP_EL =
  "Για να εγκριθεί η παράδοση και να μπορεί να εμφανιστεί στις «Πρόσφατες συνεργασίες», επικόλλησε το δημοσιευμένο link (reel / TikTok / post) στο πεδίο «Παραδοτέο» της συνεργασίας — όχι μόνο στο chat.";

export const DELIVERABLE_TIP_EN =
  "So the brand can approve it and it can appear in “Recent collaborations”, paste the published reel / TikTok / post link in the collaboration’s Deliverable field — not only in chat.";

export const DELIVERABLE_TIP_CTA_EL = "Ανέβασέ το ως παραδοτέο";
export const DELIVERABLE_TIP_CTA_EN = "Upload it as a deliverable";

export type DeliverableTipTarget = {
  kind?: "proposal" | "campaign";
  id?: string;
  /** When the chat message already has a publishable social URL. */
  prefill?: string;
};

export type DeliverableTipPayload = {
  kind?: "proposal" | "campaign";
  id?: string;
  prefill?: string;
};

/** File-host / cloud share hosts creators often use instead of Παραδοτέο. */
const FILE_HOST =
  /(?:https?:\/\/)?(?:(?:www|m)\.)?(?:wetransfer\.com|we\.tl|drive\.google\.com|dropbox\.com|db\.tt)\b/i;

/** Published Instagram post or reel (not profile / stories). */
const IG_POST = /(?:https?:\/\/)?(?:(?:www|m)\.)?instagram\.com\/(?:reel|p)\/[A-Za-z0-9_-]+/i;

/** TikTok video URL (not bare profile). */
const TT_VIDEO = /(?:https?:\/\/)?(?:(?:www|m|vm)\.)?tiktok\.com\/@[\w.-]+\/video\/\d+/i;

export function isDeliverableTipMessage(content: string | null | undefined): boolean {
  return String(content || "").startsWith(DELIVERABLE_TIP_MARKER);
}

export function deliverableTipBody(lang: "el" | "en" = "el"): string {
  return lang === "en" ? DELIVERABLE_TIP_EN : DELIVERABLE_TIP_EL;
}

export function deliverableTipCta(lang: "el" | "en" = "el"): string {
  return lang === "en" ? DELIVERABLE_TIP_CTA_EN : DELIVERABLE_TIP_CTA_EL;
}

/** True when the message contains a file-host or publishable social deliverable link. */
export function looksLikeDeliverableLink(text: string): boolean {
  const raw = String(text || "").trim();
  if (!raw) return false;
  if (isDeliverableTipMessage(raw)) return false;
  return FILE_HOST.test(raw) || IG_POST.test(raw) || TT_VIDEO.test(raw);
}

/** First Instagram reel/p or TikTok video URL in the text (for prefill). */
export function extractPublishableDeliverableUrl(text: string): string | null {
  const raw = String(text || "");
  const ig = raw.match(IG_POST)?.[0];
  if (ig) {
    const withProto = /^https?:\/\//i.test(ig) ? ig : `https://${ig}`;
    return withProto.split(/[\s<>"']/)[0] || withProto;
  }
  const tt = raw.match(TT_VIDEO)?.[0];
  if (tt) {
    const withProto = /^https?:\/\//i.test(tt) ? tt : `https://${tt}`;
    return withProto.split(/[\s<>"']/)[0] || withProto;
  }
  return null;
}

export function deliverableTipContent(target?: DeliverableTipTarget | null): string {
  const payload: DeliverableTipPayload = {};
  if (target?.kind && target.id) {
    payload.kind = target.kind;
    payload.id = target.id;
  }
  if (target?.prefill) payload.prefill = target.prefill;
  // Always store JSON (even `{}`) so the client can parse the marker payload.
  return `${DELIVERABLE_TIP_MARKER}${JSON.stringify(payload)}`;
}

export function parseDeliverableTipPayload(content: string | null | undefined): DeliverableTipPayload {
  const raw = String(content || "");
  if (!raw.startsWith(DELIVERABLE_TIP_MARKER)) return {};
  const rest = raw.slice(DELIVERABLE_TIP_MARKER.length).trim();
  if (!rest) return {};
  try {
    const parsed = JSON.parse(rest) as DeliverableTipPayload;
    if (!parsed || typeof parsed !== "object") return {};
    const out: DeliverableTipPayload = {};
    if (parsed.kind === "proposal" || parsed.kind === "campaign") out.kind = parsed.kind;
    if (typeof parsed.id === "string" && parsed.id.trim()) out.id = parsed.id.trim();
    if (typeof parsed.prefill === "string" && parsed.prefill.trim()) out.prefill = parsed.prefill.trim();
    return out;
  } catch {
    return {};
  }
}

/** Deep-link into the Παραδοτέο field for the signed-in party. */
export function deliverableTipHref(
  payload: DeliverableTipPayload,
  mode: "influencer" | "brand"
): string {
  const base = mode === "brand" ? "/brand/dashboard" : "/dashboard";
  const params = new URLSearchParams();
  params.set("focus", "deliverable");
  if (payload.prefill) params.set("prefill", payload.prefill);

  if (payload.kind === "campaign" && payload.id) {
    params.set("tab", "campaigns");
    params.set("application", payload.id);
    return `${base}?${params.toString()}`;
  }
  if (payload.kind === "proposal" && payload.id) {
    params.set("tab", "proposals");
    params.set("proposalId", payload.id);
    return `${base}?${params.toString()}`;
  }

  params.set("tab", mode === "brand" ? "campaigns" : "campaigns");
  return `${base}?${params.toString()}`;
}
