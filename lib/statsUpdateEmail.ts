/**
 * "Stats updated" email to approved creators after a successful social-refresh-batch apply.
 * Sent only when something material changed. No unsubscribe link (owner decision).
 */
import { parseFollowerString } from "@/lib/parseFollowers";
import { escapeHtml } from "@/lib/proposalParty";
import { buttonHtml, send, shell, siteUrl, todayAthens } from "@/lib/proposalMail";
import { publicProfilePath } from "@/lib/profileSlug";
import { isProtectedTestAccount } from "@/lib/protectedAccount";

export type StatsAccount = {
  platform?: string | null;
  username?: string | null;
  followers?: string | number | null;
  engagement_rate?: string | number | null;
  avg_views?: number | null;
  top_posts?: unknown[] | null;
};

type Audit = { strengthsNote?: string | null } | null | undefined;

export type StatsChange = {
  platform: string;
  followers: number;
  diff: number | null;
  er: number | null;
  avgViews: number | null;
};

const PLATFORM_LABEL: Record<string, string> = {
  instagram: "Instagram",
  tiktok: "TikTok",
  youtube: "YouTube",
  facebook: "Facebook",
};

function parseEr(value: unknown): number | null {
  if (value == null) return null;
  const n = parseFloat(String(value).replace("%", "").replace(",", ".").trim());
  return Number.isFinite(n) ? n : null;
}

function key(acc: StatsAccount): string {
  return `${String(acc.platform || "").toLowerCase()}:${String(acc.username || "").replace(/^@+/, "").toLowerCase()}`;
}

function hasTopPosts(accounts: StatsAccount[]): boolean {
  return accounts.some((a) => Array.isArray(a.top_posts) && a.top_posts.length > 0);
}

/** Greek number format: dot thousands, comma decimals. */
export function grNumber(value: number, decimals = 0): string {
  return value.toLocaleString("el-GR", { minimumFractionDigits: decimals, maximumFractionDigits: decimals, useGrouping: true });
}

function grInt(value: number): string {
  // el-GR does not group 4-digit numbers; force dot grouping for consistency.
  return Math.round(value).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

export function diffStats(
  oldAccounts: StatsAccount[],
  newAccounts: StatsAccount[],
  oldAudit: Audit,
  newAudit: Audit
): { material: boolean; rows: StatsChange[]; topPostsAdded: boolean; strengthsAdded: boolean } {
  const before = new Map(oldAccounts.map((a) => [key(a), a]));
  let material = false;
  const rows: StatsChange[] = [];
  for (const acc of newAccounts) {
    const platform = String(acc.platform || "").toLowerCase();
    if (!PLATFORM_LABEL[platform] || !acc.username) continue;
    const followers = parseFollowerString(acc.followers ?? null);
    if (!followers) continue;
    const prev = before.get(key(acc));
    const prevFollowers = prev ? parseFollowerString(prev.followers ?? null) : 0;
    const er = parseEr(acc.engagement_rate);
    const prevEr = prev ? parseEr(prev.engagement_rate) : null;
    if (prevFollowers > 0 && Math.abs(followers - prevFollowers) / prevFollowers >= 0.05) material = true;
    if (er != null && prevEr != null && Math.abs(er - prevEr) >= 0.3) material = true;
    rows.push({
      platform,
      followers,
      diff: prevFollowers > 0 ? followers - prevFollowers : null,
      er,
      avgViews: acc.avg_views != null && Number(acc.avg_views) > 0 ? Number(acc.avg_views) : null,
    });
  }
  const topPostsAdded = !hasTopPosts(oldAccounts) && hasTopPosts(newAccounts);
  const strengthsAdded = !String(oldAudit?.strengthsNote || "").trim() && !!String(newAudit?.strengthsNote || "").trim();
  if (topPostsAdded || strengthsAdded) material = true;
  return { material, rows, topPostsAdded, strengthsAdded };
}

export function buildStatsEmail(input: {
  name: string;
  slug: string | null;
  influencerId: string;
  rows: StatsChange[];
  topPostsAdded: boolean;
  showTip: boolean;
}): { subject: string; html: string } {
  const lines = input.rows
    .map((r) => {
      const diff =
        r.diff == null || r.diff === 0 ? "" : ` (${r.diff > 0 ? "+" : "−"}${grInt(Math.abs(r.diff))})`;
      const er = r.er != null ? ` · Engagement ${grNumber(r.er, 1)}%` : "";
      const views = r.avgViews != null ? ` · Μ.Ο. προβολών ${grInt(r.avgViews)}` : "";
      return `<strong>${escapeHtml(PLATFORM_LABEL[r.platform] || r.platform)}:</strong> ${grInt(r.followers)} followers${diff}${er}${views}`;
    })
    .join("<br/>");
  const profileUrl = `${siteUrl()}${publicProfilePath(input.slug, input.influencerId)}`;
  const body = `<p>Γεια σου ${escapeHtml(input.name)},</p>
    <p>Ανανεώσαμε τα στατιστικά του προφίλ σου στις ${escapeHtml(todayAthens())}:</p>
    <p style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px 14px;">${lines}</p>
    ${input.topPostsAdded ? "<p>Προστέθηκαν τα κορυφαία posts σου στην καρτέλα Στατιστικά.</p>" : ""}
    ${buttonHtml(profileUrl, "Δες το προφίλ σου")}
    ${
      input.showTip
        ? `<p>💡 Τα προφίλ με πακέτα και δεξιότητες εμφανίζονται πιο ολοκληρωμένα στις επιχειρήσεις. Πρόσθεσέ τα σε 2 λεπτά από το <a href="${siteUrl()}/dashboard">dashboard σου</a>.</p>`
        : ""
    }
    <p style="font-size: 12px; color: #6b7280;">Τα στατιστικά ανανεώνονται αυτόματα κάθε 15 μέρες.</p>`;
  return { subject: "Ενημερώσαμε τα στατιστικά σου στο Influo 📈", html: shell("Ενημερώσαμε τα στατιστικά σου", body) };
}

const sentThisProcess = new Set<string>();
const perRunCount = new Map<string, number>();

function cap(): number {
  const n = Number(process.env.STATS_EMAIL_MAX_PER_RUN);
  return Number.isFinite(n) && n >= 0 ? n : 400;
}

function nonEmpty(value: unknown): boolean {
  if (Array.isArray(value)) return value.length > 0;
  if (value && typeof value === "object") return Object.keys(value).length > 0;
  return !!String(value ?? "").trim();
}

/** Never throws. */
export async function maybeSendStatsEmail(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabaseAdmin: any,
  runId: string,
  info: { id: string; oldAccounts: StatsAccount[]; newAccounts: StatsAccount[]; oldAudit: Audit; newAudit: Audit }
): Promise<void> {
  try {
    const dedupeKey = `${runId}:${info.id}`;
    if (sentThisProcess.has(dedupeKey)) return;
    const changes = diffStats(info.oldAccounts, info.newAccounts, info.oldAudit, info.newAudit);
    if (!changes.material || !changes.rows.length) return;
    const used = perRunCount.get(runId) || 0;
    if (used >= cap()) {
      console.warn("[stats email] cap reached for run", runId);
      return;
    }
    const { data: row } = await supabaseAdmin
      .from("influencers")
      .select("id, display_name, approved, profile_slug, contact_email, service_packages, skills")
      .eq("id", info.id)
      .maybeSingle();
    if (!row || row.approved !== true) return;
    const priv = await supabaseAdmin.from("influencer_private").select("contact_email").eq("influencer_id", info.id).maybeSingle();
    const email = String(priv?.data?.contact_email || row.contact_email || "").trim();
    if (!email.includes("@")) return;
    if (isProtectedTestAccount({ display_name: row.display_name, contact_email: email })) return;
    sentThisProcess.add(dedupeKey);
    perRunCount.set(runId, used + 1);
    const mail = buildStatsEmail({
      name: row.display_name || "Influencer",
      slug: typeof row.profile_slug === "string" ? row.profile_slug : null,
      influencerId: info.id,
      rows: changes.rows,
      topPostsAdded: changes.topPostsAdded,
      showTip: !nonEmpty(row.service_packages) || !nonEmpty(row.skills),
    });
    await send("stats_updated", email, mail.subject, mail.html);
  } catch (err) {
    console.error("[stats email]", err instanceof Error ? err.message : "failed");
  }
}
