/**
 * Backfill showcase notice for past collaborations with a published/approved post.
 *
 * Default: DRY-RUN (read-only). Lists recipients, counts, writes a sample HTML report.
 * Does NOT send email or write DB unless APPLY=1 (still never auto-run against prod here).
 *
 *   npx tsx scripts/showcase-backfill-notice.mts
 *   npx tsx scripts/showcase-backfill-notice.mts --report=path.md
 *
 * Env: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (read-only in dry-run).
 */

import { createClient } from "@supabase/supabase-js";
import { createHmac } from "crypto";
import { writeFileSync, mkdirSync } from "fs";
import { dirname, resolve } from "path";

const APPLY = process.env.APPLY === "1";
const DRY = !APPLY || process.env.DRY_RUN === "1";
const DAYS = 7;

type Party = "brand" | "influencer";
type Source = "proposal" | "campaign";

type Recipient = {
  source: Source;
  id: string;
  party: Party;
  email: string;
  name: string;
  otherName: string;
  label: string;
  postUrl: string;
  missingPostUrl?: boolean;
};

function siteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL || "https://influo.gr").replace(/\/$/, "");
}

function optOutSecret(): string {
  return (
    process.env.SHOWCASE_OPTOUT_SECRET ||
    process.env.CRON_SECRET ||
    process.env.RESEND_API_KEY ||
    "influo-showcase-optout-dev"
  ).trim();
}

function optOutUrl(source: Source, id: string, party: Party): string {
  const payload = `${source}:${id}:${party}`;
  const sig = createHmac("sha256", optOutSecret()).update(payload).digest("hex").slice(0, 32);
  const t = Buffer.from(`${payload}:${sig}`, "utf8").toString("base64url");
  return `${siteUrl()}/showcase/opt-out?t=${encodeURIComponent(t)}`;
}

function addPostUrl(source: Source, id: string): string {
  const payload = `addpost:${source}:${id}:influencer`;
  const sig = createHmac("sha256", optOutSecret()).update(payload).digest("hex").slice(0, 32);
  const t = Buffer.from(`${payload}:${sig}`, "utf8").toString("base64url");
  return `${siteUrl()}/showcase/add-post?t=${encodeURIComponent(t)}`;
}

function deadlineLabel(from = new Date()): string {
  const d = new Date(from.getTime() + DAYS * 24 * 60 * 60 * 1000);
  return d.toLocaleDateString("el-GR", {
    timeZone: "Europe/Athens",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function sampleHtml(r: Recipient): string {
  const opt = optOutUrl(r.source, r.id, r.party);
  const who =
    r.party === "brand"
      ? `με τον/την creator <strong>${escape(r.otherName)}</strong>`
      : `με το brand <strong>${escape(r.otherName)}</strong>`;
  const greet = r.party === "brand" ? `Γεια σας ${escape(r.name)},` : `Γεια σου ${escape(r.name)},`;
  const missing =
    r.missingPostUrl && r.party === "influencer"
      ? `<div style="margin:16px 0;padding:12px;background:#fffbeb;border:1px solid #fde68a;border-radius:8px;">
  <p>Λείπει το link της ανάρτησης.</p>
  <p><a href="${escape(addPostUrl(r.source, r.id))}" style="display:inline-block;background:#2563eb;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none;font-weight:600;">Πρόσθεσε το link της ανάρτησης</a></p>
  <p style="font-size:12px;color:#94a3b8;">Οι συνεργασίες σου εμφανίζονται στην αρχική και στο προφίλ σου. Τα brands βλέπουν τη δουλειά σου, οπότε έχεις περισσότερες πιθανότητες να σε επιλέξουν.</p>
</div>`
      : "";
  return `<!DOCTYPE html><html lang="el"><head><meta charset="utf-8"/><title>Showcase backfill sample</title></head>
<body style="font-family:system-ui,sans-serif;max-width:600px;margin:24px auto;color:#1f2937;line-height:1.6;">
  <h1 style="font-size:20px;">Πρόσφατες συνεργασίες — ειδοποίηση</h1>
  <p>${greet}</p>
  <p>Θέλουμε να προβάλουμε την ολοκληρωμένη συνεργασία σας ${who}${
    r.label ? ` («${escape(r.label)}»)` : ""
  } στην ενότητα <strong>Πρόσφατες συνεργασίες</strong> στο influo.gr.</p>
  ${missing}
  <p>Αν δεν επιθυμείτε δημόσια προβολή, πατήστε έως τις <strong>${escape(
    deadlineLabel()
  )}</strong>.</p>
  <p><a href="${escape(opt)}" style="display:inline-block;background:#0f172a;color:#fff;padding:10px 16px;border-radius:999px;text-decoration:none;">Δεν θέλω δημόσια προβολή</a></p>
  <p style="font-size:12px;color:#64748b;">Post: ${escape(r.postUrl || "(missing)")}</p>
</body></html>`;
}

function escape(s: string): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function admin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

function reportPathArg(): string {
  const arg = process.argv.find((a) => a.startsWith("--report="));
  if (arg) return resolve(arg.slice("--report=".length));
  return resolve("C:/Users/Admin/opdesk-handoff/showcase-backfill-dry-run-20261116.html");
}

async function collect(): Promise<{
  recipients: Recipient[];
  collabIds: Set<string>;
  brandEmails: Set<string>;
  creatorEmails: Set<string>;
}> {
  const sb = admin();
  const recipients: Recipient[] = [];
  const collabIds = new Set<string>();
  const brandEmails = new Set<string>();
  const creatorEmails = new Set<string>();

  // Proposals: completed (URL optional — missing URL → creator gets add-post CTA)
  const { data: proposals, error: pErr } = await sb
    .from("proposals")
    .select(
      "id, brand_name, brand_email, brand_id, influencer_id, service_type, published_post_url, brand_showcase_consent, influencer_showcase_consent, showcase_notice_sent_at, brand_showcase_opted_out, influencer_showcase_opted_out, showcase_admin_hidden"
    )
    .eq("status", "completed")
    .limit(500);

  if (pErr && !/showcase_notice_sent_at|opted_out|schema cache|42703|PGRST204/i.test(pErr.message || "")) {
    console.error("proposals query error:", pErr.message);
  }

  let proposalRows = proposals || [];
  if (pErr && /showcase_notice_sent_at|opted_out/i.test(pErr.message || "")) {
    const fallback = await sb
      .from("proposals")
      .select(
        "id, brand_name, brand_email, brand_id, influencer_id, service_type, published_post_url, brand_showcase_consent, influencer_showcase_consent, showcase_admin_hidden"
      )
      .eq("status", "completed")
      .limit(500);
    proposalRows = (fallback.data || []) as typeof proposalRows;
  }

  const { data: apps, error: aErr } = await sb
    .from("campaign_applications")
    .select(
      "id, influencer_id, deliverable_url, brand_showcase_consent, influencer_showcase_consent, showcase_notice_sent_at, brand_showcase_opted_out, influencer_showcase_opted_out, showcase_admin_hidden, brand_campaigns!inner ( title, brand_id, brands ( brand_name, contact_email ) )"
    )
    .eq("deliverable_status", "approved")
    .limit(500);

  if (aErr && !/showcase_notice_sent_at|opted_out|schema cache|42703|PGRST204/i.test(aErr.message || "")) {
    console.error("campaign_applications query error:", aErr.message);
  }

  let appRows = apps || [];
  if (aErr && /showcase_notice_sent_at|opted_out/i.test(aErr.message || "")) {
    const fallback = await sb
      .from("campaign_applications")
      .select(
        "id, influencer_id, deliverable_url, brand_showcase_consent, influencer_showcase_consent, showcase_admin_hidden, brand_campaigns!inner ( title, brand_id, brands ( brand_name, contact_email ) )"
      )
      .eq("deliverable_status", "approved")
      .limit(500);
    appRows = (fallback.data || []) as typeof appRows;
  }

  const influencerIds = new Set<string>();
  for (const row of proposalRows) {
    if (row.showcase_admin_hidden) continue;
    if ((row as { showcase_notice_sent_at?: string | null }).showcase_notice_sent_at) continue;
    const url = String(row.published_post_url || "").trim();
    const bothConsent = !!(row.brand_showcase_consent && row.influencer_showcase_consent);
    // Include when URL missing (creator add-post CTA) or either side still needs soft consent.
    if (url && bothConsent) continue;
    if (row.influencer_id) influencerIds.add(String(row.influencer_id));
  }
  for (const row of appRows) {
    if (row.showcase_admin_hidden) continue;
    if ((row as { showcase_notice_sent_at?: string | null }).showcase_notice_sent_at) continue;
    const url = String(row.deliverable_url || "").trim();
    const bothConsent = !!(row.brand_showcase_consent && row.influencer_showcase_consent);
    if (url && bothConsent) continue;
    if (row.influencer_id) influencerIds.add(String(row.influencer_id));
  }

  const infById = new Map<string, { display_name: string | null; contact_email: string | null }>();
  if (influencerIds.size) {
    const { data: infs } = await sb
      .from("influencers")
      .select("id, display_name, contact_email")
      .in("id", [...influencerIds]);
    for (const inf of infs || []) {
      infById.set(String(inf.id), {
        display_name: inf.display_name,
        contact_email: inf.contact_email,
      });
    }
  }

  for (const row of proposalRows) {
    if (row.showcase_admin_hidden) continue;
    if ((row as { showcase_notice_sent_at?: string | null }).showcase_notice_sent_at) continue;
    const url = String(row.published_post_url || "").trim();
    const bothConsent = !!(row.brand_showcase_consent && row.influencer_showcase_consent);
    if (url && bothConsent) continue;
    if ((row as { brand_showcase_opted_out?: boolean }).brand_showcase_opted_out && url) continue;
    if ((row as { influencer_showcase_opted_out?: boolean }).influencer_showcase_opted_out && url) continue;

    const id = String(row.id);
    const key = `proposal:${id}`;
    collabIds.add(key);
    const inf = infById.get(String(row.influencer_id));
    const brandName = (row.brand_name || "Brand").trim() || "Brand";
    const creatorName = (inf?.display_name || "Creator").trim() || "Creator";
    const label = String(row.service_type || "").trim();
    const brandEmail = String(row.brand_email || "")
      .trim()
      .toLowerCase();
    const creatorEmail = String(inf?.contact_email || "")
      .trim()
      .toLowerCase();
    const missing = !url;

    // Brand: soft-consent notice only when there is a post URL and brand hasn't consented.
    if (brandEmail.includes("@") && url && !row.brand_showcase_consent) {
      brandEmails.add(brandEmail);
      recipients.push({
        source: "proposal",
        id,
        party: "brand",
        email: brandEmail,
        name: brandName,
        otherName: creatorName,
        label,
        postUrl: url,
        missingPostUrl: false,
      });
    }
    // Creator: consent notice and/or missing-post CTA.
    if (
      creatorEmail.includes("@") &&
      (missing || !row.influencer_showcase_consent)
    ) {
      creatorEmails.add(creatorEmail);
      recipients.push({
        source: "proposal",
        id,
        party: "influencer",
        email: creatorEmail,
        name: creatorName,
        otherName: brandName,
        label,
        postUrl: url,
        missingPostUrl: missing,
      });
    }
  }

  for (const row of appRows) {
    if (row.showcase_admin_hidden) continue;
    if ((row as { showcase_notice_sent_at?: string | null }).showcase_notice_sent_at) continue;
    const url = String(row.deliverable_url || "").trim();
    const bothConsent = !!(row.brand_showcase_consent && row.influencer_showcase_consent);
    if (url && bothConsent) continue;
    if ((row as { brand_showcase_opted_out?: boolean }).brand_showcase_opted_out && url) continue;
    if ((row as { influencer_showcase_opted_out?: boolean }).influencer_showcase_opted_out && url) continue;

    const id = String(row.id);
    collabIds.add(`campaign:${id}`);
    const campaignRaw = row.brand_campaigns as unknown;
    const campaign = (Array.isArray(campaignRaw) ? campaignRaw[0] : campaignRaw) as {
      title?: string | null;
      brands?:
        | { brand_name?: string | null; contact_email?: string | null }
        | { brand_name?: string | null; contact_email?: string | null }[]
        | null;
    } | null;
    const brandRow = Array.isArray(campaign?.brands) ? campaign?.brands[0] : campaign?.brands;
    const brandName = (brandRow?.brand_name || "Brand").trim() || "Brand";
    const brandEmail = String(brandRow?.contact_email || "")
      .trim()
      .toLowerCase();
    const inf = infById.get(String(row.influencer_id));
    const creatorName = (inf?.display_name || "Creator").trim() || "Creator";
    const creatorEmail = String(inf?.contact_email || "")
      .trim()
      .toLowerCase();
    const label = String(campaign?.title || "").trim();
    const missing = !url;

    if (brandEmail.includes("@") && url && !row.brand_showcase_consent) {
      brandEmails.add(brandEmail);
      recipients.push({
        source: "campaign",
        id,
        party: "brand",
        email: brandEmail,
        name: brandName,
        otherName: creatorName,
        label,
        postUrl: url,
        missingPostUrl: false,
      });
    }
    if (creatorEmail.includes("@") && (missing || !row.influencer_showcase_consent)) {
      creatorEmails.add(creatorEmail);
      recipients.push({
        source: "campaign",
        id,
        party: "influencer",
        email: creatorEmail,
        name: creatorName,
        otherName: brandName,
        label,
        postUrl: url,
        missingPostUrl: missing,
      });
    }
  }

  return { recipients, collabIds, brandEmails, creatorEmails };
}

async function main() {
  console.log(`=== Showcase backfill notice (${DRY ? "DRY-RUN" : "APPLY"}) ===`);
  if (!DRY) {
    console.error("APPLY mode refused in this agent task. Use DRY-RUN only.");
    process.exit(2);
  }

  const { recipients, collabIds, brandEmails, creatorEmails } = await collect();
  const brands = recipients.filter((r) => r.party === "brand").length;
  const creators = recipients.filter((r) => r.party === "influencer").length;

  console.log("collaborations eligible:", collabIds.size);
  console.log("recipient emails (rows):", recipients.length);
  console.log("  brand rows:", brands, "| unique brand emails:", brandEmails.size);
  console.log("  creator rows:", creators, "| unique creator emails:", creatorEmails.size);

  const sample =
    recipients.find((r) => r.party === "influencer" && r.missingPostUrl) ||
    recipients.find((r) => r.party === "influencer") ||
    recipients[0];
  const out = reportPathArg();
  mkdirSync(dirname(out), { recursive: true });
  if (sample) {
    writeFileSync(out, sampleHtml(sample), "utf8");
    console.log("sample HTML:", out);
    console.log(
      "sample to:",
      sample.party,
      sample.email.replace(/(.{2}).+(@.+)/, "$1***$2"),
      sample.missingPostUrl ? "(missing post CTA)" : ""
    );
  } else {
    writeFileSync(
      out,
      "<!DOCTYPE html><html><body><p>No eligible collaborations for backfill.</p></body></html>",
      "utf8"
    );
    console.log("sample HTML (empty):", out);
  }

  // Machine-readable summary for the Greek report (no secrets)
  const summaryPath = resolve("C:/Users/Admin/opdesk-handoff/showcase-backfill-summary-20261116.json");
  writeFileSync(
    summaryPath,
    JSON.stringify(
      {
        mode: "dry-run",
        collaborations: collabIds.size,
        brandRecipientRows: brands,
        creatorRecipientRows: creators,
        uniqueBrandEmails: brandEmails.size,
        uniqueCreatorEmails: creatorEmails.size,
        totalRecipientRows: recipients.length,
        deadlineDays: DAYS,
        sampleParty: sample?.party || null,
        sampleSource: sample?.source || null,
      },
      null,
      2
    ),
    "utf8"
  );
  console.log("summary JSON:", summaryPath);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
