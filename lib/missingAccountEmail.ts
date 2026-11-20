import type { SupabaseClient } from "@supabase/supabase-js";
import { enqueueAdminDigestItem } from "@/lib/adminDailyDigest";
import { adminInboxAddress } from "@/lib/adminMessageSummary";
import { isCollabEmailExcludedInfluencer } from "@/lib/collabEmailExclusion";
import { buttonHtml, sendChecked, shell, siteUrl } from "@/lib/proposalMail";
import { escapeHtml } from "@/lib/proposalParty";
import {
  isMissingAccountEmailEnabled,
  isPermanentAccountMissingError,
  normalizeSocialHandle,
} from "@/lib/socialAccountMissing";
import { Resend } from "resend";

function platformLabel(platform: string): string {
  const p = platform.toLowerCase();
  if (p === "instagram") return "Instagram";
  if (p === "tiktok") return "TikTok";
  if (p === "youtube") return "YouTube";
  if (p === "facebook") return "Facebook";
  return platform || "Social";
}

async function alreadyNotified(
  supabaseAdmin: SupabaseClient,
  influencerId: string,
  platform: string,
  handle: string
): Promise<boolean> {
  const { data, error } = await supabaseAdmin
    .from("influencer_missing_account_notified")
    .select("id")
    .eq("influencer_id", influencerId)
    .eq("platform", platform.toLowerCase())
    .eq("handle", handle)
    .limit(1);
  if (error) {
    if (/relation|does not exist|schema cache/i.test(error.message)) return true;
    console.warn("[missing account]", error.message);
    return true;
  }
  return (data?.length ?? 0) > 0;
}

export async function clearMissingAccountNotified(
  supabaseAdmin: SupabaseClient,
  influencerId: string,
  platform: string,
  username: string
): Promise<void> {
  const handle = normalizeSocialHandle(username);
  if (!handle) return;
  const { error } = await supabaseAdmin
    .from("influencer_missing_account_notified")
    .delete()
    .eq("influencer_id", influencerId)
    .eq("platform", String(platform || "").toLowerCase())
    .eq("handle", handle);
  if (error && !/relation|does not exist|schema cache/i.test(error.message)) {
    console.warn("[missing account] clear stamp", error.message);
  }
}

async function stampNotified(
  supabaseAdmin: SupabaseClient,
  influencerId: string,
  platform: string,
  handle: string
): Promise<void> {
  const { error } = await supabaseAdmin.from("influencer_missing_account_notified").upsert(
    {
      influencer_id: influencerId,
      platform: platform.toLowerCase(),
      handle,
      notified_at: new Date().toISOString(),
    },
    { onConflict: "influencer_id,platform,handle" }
  );
  if (error && !/relation|does not exist|schema cache/i.test(error.message)) {
    console.warn("[missing account] stamp", error.message);
  }
}

async function notifyAdminMissingAccount(
  supabaseAdmin: SupabaseClient,
  opts: {
    influencerName: string;
    platform: string;
    handle: string;
    influencerId: string;
  }
): Promise<void> {
  const detail = `Δεν βρέθηκε λογαριασμός: ${platformLabel(opts.platform)} @${opts.handle}`;
  const queued = await enqueueAdminDigestItem(supabaseAdmin, "unapproved", {
    name: opts.influencerName,
    detail,
    influencerId: opts.influencerId,
  });
  if (queued) return;

  const to = adminInboxAddress(process.env.ADMIN_EMAIL);
  const key = process.env.RESEND_API_KEY;
  if (!to || !key) return;
  const resend = new Resend(key);
  const site = siteUrl();
  await resend.emails.send({
    from: "Influo <noreply@influo.gr>",
    to: [to],
    subject: `Λείπει social: ${opts.influencerName} @${opts.handle}`,
    html: `<div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;font-size:14px;line-height:1.6;color:#1f2937;max-width:560px">
<p>Ο creator <strong>${escapeHtml(opts.influencerName)}</strong> έχει λογαριασμό που δεν βρέθηκε στο refresh.</p>
<p><strong>Πλατφόρμα:</strong> ${escapeHtml(platformLabel(opts.platform))}<br/>
<strong>Handle:</strong> @${escapeHtml(opts.handle)}</p>
<p><a href="${site}/admin">Άνοιγμα admin</a></p>
</div>`,
  });
}

export function buildCreatorMail(name: string, handle: string): { subject: string; html: string } {
  const editUrl = `${siteUrl()}/dashboard`;
  const atHandle = handle.startsWith("@") ? handle : `@${handle}`;
  const body = `<p>Γεια σου ${escapeHtml(name)},</p>
<p>Στο Influo έχεις δηλώσει τον λογαριασμό <strong>${escapeHtml(atHandle)}</strong>, αλλά δεν τον βρίσκουμε στο δίκτυο (λάθος username, αλλαγή handle ή διαγραφή λογαριασμού).</p>
<p>Διόρθωσε το username από το προφίλ σου ώστε οι επιχειρήσεις να βλέπουν τα σωστά στοιχεία.</p>
${buttonHtml(editUrl, "Επεξεργασία προφίλ")}
<p style="font-size:12px;color:#6b7280;margin-top:20px;">Αν το username είναι σωστό, αγνόησε αυτό το email — μπορεί να ήταν προσωρινό σφάλμα.</p>`;
  return {
    subject: `Δεν βρίσκουμε τον λογαριασμό σου ${atHandle}`,
    html: shell("Δεν βρίσκουμε τον λογαριασμό σου", body),
  };
}

/** One email per missing handle; stamp prevents duplicates. Never throws. */
export async function maybeNotifyMissingSocialAccount(
  supabaseAdmin: SupabaseClient,
  opts: {
    influencerId: string;
    influencerName: string;
    platform: string;
    username: string;
    error: string;
  }
): Promise<void> {
  if (!isMissingAccountEmailEnabled()) return;
  if (!isPermanentAccountMissingError(opts.error)) return;
  const handle = normalizeSocialHandle(opts.username);
  const platform = String(opts.platform || "").trim();
  if (!handle || !platform) return;
  if (isCollabEmailExcludedInfluencer(opts.influencerId)) return;
  if (await alreadyNotified(supabaseAdmin, opts.influencerId, platform, handle)) return;

  const { data: row } = await supabaseAdmin
    .from("influencers")
    .select("id, display_name, contact_email")
    .eq("id", opts.influencerId)
    .maybeSingle();
  const priv = await supabaseAdmin
    .from("influencer_private")
    .select("contact_email")
    .eq("influencer_id", opts.influencerId)
    .maybeSingle();
  const email = String(priv.data?.contact_email || row?.contact_email || "").trim();
  const name = opts.influencerName || row?.display_name || "Creator";
  const mail = buildCreatorMail(name, handle);

  // sendChecked writes email_log (type/ok/recipient_id/deal_ref/party).
  const outcome = await sendChecked("missing_social_account", email, mail.subject, mail.html, {
    recipientId: opts.influencerId,
    dealRef: `${platform.toLowerCase()}:${handle}`.slice(0, 64),
    party: "influencer",
  });
  if (outcome !== "ok") return;

  await stampNotified(supabaseAdmin, opts.influencerId, platform, handle);
  await notifyAdminMissingAccount(supabaseAdmin, {
    influencerName: name,
    platform,
    handle,
    influencerId: opts.influencerId,
  }).catch((err) => console.warn("[missing account] admin", err instanceof Error ? err.message : err));
}

/** Run after refresh apply for each scraped account. */
export async function handleMissingAccountNoticesForAccounts(
  supabaseAdmin: SupabaseClient,
  influencerId: string,
  influencerName: string,
  accounts: Array<{ platform?: string; username?: string; ok?: boolean; error?: string }>
): Promise<void> {
  for (const acc of accounts) {
    const platform = String(acc.platform || "").trim();
    const username = String(acc.username || "").trim();
    if (!platform || !username) continue;
    if (acc.ok) {
      await clearMissingAccountNotified(supabaseAdmin, influencerId, platform, username);
      continue;
    }
    const err = String(acc.error || "");
    if (!isPermanentAccountMissingError(err)) continue;
    await maybeNotifyMissingSocialAccount(supabaseAdmin, {
      influencerId,
      influencerName,
      platform,
      username,
      error: err,
    });
  }
}