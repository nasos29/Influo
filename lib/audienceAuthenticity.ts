import { parseFollowerString } from "./parseFollowers";
import { parseErPercent } from "./engagementFlags";

export type AudienceAuthenticityStatus = "clean" | "review" | "suspicious" | "insufficient";

export type AuthenticityReason = { el: string; en: string };

export type PlatformAuthenticity = {
  platform: string;
  status: AudienceAuthenticityStatus;
  score: number | null;
  followers: number;
};

export type AudienceAuthenticity = {
  status: AudienceAuthenticityStatus;
  labelEl: string;
  labelEn: string;
  score: number | null;
  reasons: AuthenticityReason[];
  reasonsEn: AuthenticityReason[];
  platforms: PlatformAuthenticity[];
};

export type AuthenticityListFilter = "all" | "suspicious" | "review";

const LABELS: Record<AudienceAuthenticityStatus, { el: string; en: string }> = {
  clean: { el: "Καθαρό", en: "Clean" },
  review: { el: "Για έλεγχο", en: "For review" },
  suspicious: { el: "Ύποπτο", en: "Suspicious" },
  insufficient: { el: "Χωρίς δεδομένα", en: "Insufficient data" },
};

const STATUS_RANK: Record<AudienceAuthenticityStatus, number> = {
  suspicious: 0,
  review: 1,
  clean: 2,
  insufficient: 3,
};

const SCORABLE_PLATFORMS = new Set(["instagram", "tiktok", "youtube"]);

type TopPost = { likes?: number | string | null; comments?: number | string | null; views?: number | string | null };
type Acc = {
  platform?: string | null;
  username?: string | null;
  followers?: string | number | null;
  engagement_rate?: string | null;
  avg_likes?: string | number | null;
  avg_comments?: string | number | null;
  avg_views?: string | number | null;
  is_private?: boolean | null;
  engagement_hidden?: boolean | null;
  suspected_fake_penalty?: boolean | null;
  fake_follower_percent?: string | number | null;
  fake_followers_percent?: string | number | null;
  suspected_fake_percent?: string | number | null;
  top_posts?: TopPost[] | null;
};

type Tier = "micro" | "mid" | "macro" | "mega";

type ThresholdPair = { erHeavy: number; erMedium: number; viewsHeavy: number; viewsMedium: number };

const IG_THRESHOLDS: Record<Tier, ThresholdPair> = {
  micro: { erHeavy: 0.4, erMedium: 1.0, viewsHeavy: 1, viewsMedium: 5 },
  mid: { erHeavy: 0.25, erMedium: 0.6, viewsHeavy: 0.8, viewsMedium: 3 },
  macro: { erHeavy: 0.15, erMedium: 0.4, viewsHeavy: 0.5, viewsMedium: 2 },
  mega: { erHeavy: 0.1, erMedium: 0.25, viewsHeavy: 0.4, viewsMedium: 1.2 },
};

const TT_THRESHOLDS: Record<Tier, ThresholdPair> = {
  micro: { erHeavy: 1.0, erMedium: 2.5, viewsHeavy: 5, viewsMedium: 12 },
  mid: { erHeavy: 0.6, erMedium: 1.5, viewsHeavy: 3, viewsMedium: 8 },
  macro: { erHeavy: 0.4, erMedium: 1.0, viewsHeavy: 2, viewsMedium: 5 },
  mega: { erHeavy: 0.4, erMedium: 1.0, viewsHeavy: 2, viewsMedium: 5 },
};

const num = (v: unknown): number => {
  if (v == null || v === "") return 0;
  const n = Number(String(v).replace(/[^\d.]/g, ""));
  return Number.isFinite(n) ? n : 0;
};

const fmtK = (n: number): string => {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1)}M`;
  if (n >= 10_000) return `${Math.round(n / 1000)}k`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(Math.round(n));
};

const fmtPct = (n: number): string => {
  if (n < 1) return `${n.toFixed(1)}%`;
  return `${n.toFixed(n >= 10 ? 0 : 1)}%`;
};

function tierFromFollowers(followers: number): Tier {
  if (followers >= 200_000) return "mega";
  if (followers >= 50_000) return "macro";
  if (followers >= 10_000) return "mid";
  return "micro";
}

function platformKey(raw: string | null | undefined): string {
  return String(raw || "").trim().toLowerCase();
}

function erStringUsable(erStr: string): boolean {
  if (!erStr.trim()) return false;
  if (erStr.trim().toUpperCase() === "N/A" || erStr.trim() === "-") return false;
  return true;
}

function accountHasUsableMetrics(a: Acc): boolean {
  const er = String(a.engagement_rate ?? "").trim();
  if (erStringUsable(er)) return true;
  if (num(a.avg_likes) > 0) return true;
  if (num(a.avg_views) > 0) return true;
  const posts = Array.isArray(a.top_posts) ? a.top_posts : [];
  if (posts.some((p) => num(p?.likes) > 0 || num(p?.views) > 0)) return true;
  return false;
}

function isScorableAccount(a: Acc): boolean {
  const p = platformKey(a.platform);
  if (!SCORABLE_PLATFORMS.has(p)) return false;
  if (a.is_private) return false;
  const followers = parseFollowerString(a.followers);
  if (followers < 500) return false;
  return accountHasUsableMetrics(a);
}

function erPenalizable(a: Acc): boolean {
  if (a.engagement_hidden) return false;
  const erStr = String(a.engagement_rate ?? "").trim();
  if (!erStringUsable(erStr)) return false;
  if (erStr.startsWith("~")) return false;
  return parseErPercent(erStr) != null;
}

function medianViewsFromTopPosts(posts: TopPost[]): number {
  const views = posts.map((p) => num(p?.views)).filter((v) => v > 0).sort((x, y) => x - y);
  if (!views.length) return 0;
  const mid = Math.floor(views.length / 2);
  return views.length % 2 ? views[mid] : (views[mid - 1] + views[mid]) / 2;
}

function viewsRatio(a: Acc, followers: number): number | null {
  if (followers <= 0) return null;
  const avgV = num(a.avg_views);
  if (avgV > 0) return (avgV / followers) * 100;
  const posts = Array.isArray(a.top_posts) ? a.top_posts : [];
  const med = medianViewsFromTopPosts(posts);
  if (med > 0) return (med / followers) * 100;
  return null;
}

function thresholdsFor(platform: string): Record<Tier, ThresholdPair> {
  return platform === "tiktok" ? TT_THRESHOLDS : IG_THRESHOLDS;
}

type Signal = { severity: "heavy" | "medium"; reason: AuthenticityReason };

function pushSignal(signals: Signal[], severity: "heavy" | "medium", el: string, en: string) {
  signals.push({ severity, reason: { el, en } });
}

function scoreFromSignals(signals: Signal[], microLoose: boolean): number {
  let score = 100;
  const factor = microLoose ? 0.85 : 1;
  for (const s of signals) {
    const cut = (s.severity === "heavy" ? 40 : 20) * factor;
    score -= cut;
  }
  return Math.max(0, Math.min(100, Math.round(score)));
}

function statusFromScore(score: number): AudienceAuthenticityStatus {
  if (score >= 70) return "clean";
  if (score >= 40) return "review";
  return "suspicious";
}

function scoreAccount(a: Acc, platform: string): { status: AudienceAuthenticityStatus; score: number | null; signals: Signal[]; followers: number } {
  const followers = parseFollowerString(a.followers);
  const tier = tierFromFollowers(followers);
  const microLoose = tier === "micro" && followers < 1000;
  const th = thresholdsFor(platform)[tier];
  const signals: Signal[] = [];

  if (erPenalizable(a)) {
    const er = parseErPercent(a.engagement_rate) ?? 0;
    if (er < th.erHeavy) {
      pushSignal(signals, "heavy", `Χαμηλό engagement rate (${fmtPct(er)} για ${fmtK(followers)} followers)`, `Low engagement rate (${fmtPct(er)} for ${fmtK(followers)} followers)`);
    } else if (er < th.erMedium) {
      pushSignal(signals, "medium", `Χαμηλό engagement rate (${fmtPct(er)} για ${fmtK(followers)} followers)`, `Low engagement rate (${fmtPct(er)} for ${fmtK(followers)} followers)`);
    }
  }

  const vr = viewsRatio(a, followers);
  if (vr != null) {
    if (vr < th.viewsHeavy) {
      pushSignal(signals, "heavy", `Πολύ χαμηλά views σε σχέση με τους followers (${fmtPct(vr)})`, `Very low views vs followers (${fmtPct(vr)})`);
    } else if (vr < th.viewsMedium) {
      pushSignal(signals, "medium", `Πολύ χαμηλά views σε σχέση με τους followers (${fmtPct(vr)})`, `Low views vs followers (${fmtPct(vr)})`);
    }
  }

  const avgLikes = num(a.avg_likes);
  let commentLikes: number | null = null;
  const avgComments = num(a.avg_comments);
  if (avgLikes > 0 && avgComments > 0) {
    commentLikes = avgComments / avgLikes;
  } else {
    const posts = Array.isArray(a.top_posts) ? a.top_posts : [];
    const pairs = posts.filter((p) => num(p.likes) > 0 && num(p.comments) >= 0);
    if (pairs.length >= 2) {
      const meanLikes = pairs.reduce((s, p) => s + num(p.likes), 0) / pairs.length;
      const meanComments = pairs.reduce((s, p) => s + num(p.comments), 0) / pairs.length;
      if (meanLikes > 0) commentLikes = meanComments / meanLikes;
      if (avgLikes <= 0 && meanLikes > 0) {
        /* use meanLikes as proxy for threshold checks */
      }
    }
  }

  const likesForCommentCheck = avgLikes > 0 ? avgLikes : (() => {
    const posts = Array.isArray(a.top_posts) ? a.top_posts : [];
    const likes = posts.map((p) => num(p.likes)).filter((v) => v > 0);
    if (!likes.length) return 0;
    return likes.reduce((s, v) => s + v, 0) / likes.length;
  })();

  if (commentLikes != null && likesForCommentCheck >= 50) {
    const ratioPct = commentLikes * 100;
    if (ratioPct < 0.2 && likesForCommentCheck >= 100) {
      pushSignal(signals, "heavy", `Πολύ λίγα σχόλια σε σχέση με τα likes (${ratioPct < 0.1 ? ratioPct.toFixed(2) : ratioPct.toFixed(1)}%)`, `Very few comments vs likes (${ratioPct < 0.1 ? ratioPct.toFixed(2) : ratioPct.toFixed(1)}%)`);
    } else if (ratioPct < 0.5) {
      pushSignal(signals, "medium", `Πολύ λίγα σχόλια σε σχέση με τα likes (${ratioPct.toFixed(1)}%)`, `Few comments vs likes (${ratioPct.toFixed(1)}%)`);
    }
  }

  const posts = Array.isArray(a.top_posts) ? a.top_posts : [];
  const withViews = posts.map((p) => num(p.views)).filter((v) => v > 0);
  if (withViews.length >= 4) {
    const sorted = [...withViews].sort((x, y) => x - y);
    const minV = sorted[0];
    const maxV = sorted[sorted.length - 1];
    const med = medianViewsFromTopPosts(posts);
    if (withViews.length >= 5 && minV > 0 && maxV / minV < 1.15) {
      pushSignal(signals, "medium", "Περίεργη ομοιομορφία στα views μεταξύ posts", "Unusual sameness in views across posts");
    } else if (med > 0 && maxV / med >= 10 && vr != null && vr < th.viewsMedium) {
      pushSignal(signals, "medium", "Μεγάλη ασυνέπεια στα views", "Large inconsistency in views");
    }
  }

  const fakePct = Math.max(
    parseErPercent(a.fake_follower_percent) ?? 0,
    parseErPercent(a.fake_followers_percent) ?? 0,
    parseErPercent(a.suspected_fake_percent) ?? 0
  );
  if (a.suspected_fake_penalty === true) {
    pushSignal(signals, "medium", "Υπάρχει σημείωση ποιότητας κοινού (ύποπτο)", "Audience quality note flagged as suspicious");
  } else if (fakePct >= 20) {
    pushSignal(signals, "medium", `Αποθηκευμένο ποσοστό ύποπτων followers (~${fmtPct(fakePct)})`, `Stored suspected-follower share (~${fmtPct(fakePct)})`);
  }

  const score = scoreFromSignals(signals, microLoose);
  return { status: statusFromScore(score), score, signals, followers };
}

function followerJumpSignals(
  snapshots?: Array<{
    snapshot_at: string;
    total_followers: number | null;
    accounts?: Array<{ platform: string; username: string; followers: number }> | null;
  }> | null
): Signal[] {
  const snaps = (snapshots || []).filter((s) => Number(s.total_followers) > 0).slice(0, 2);
  if (snaps.length < 2) return [];
  const a0 = snaps[0].accounts || [];
  const a1 = snaps[1].accounts || [];
  let cur = Number(snaps[0].total_followers);
  let prev = Number(snaps[1].total_followers);
  if (a0.length && a1.length) {
    const old = new Map(a1.map((r) => [`${r.platform}:${r.username}`, Number(r.followers) || 0]));
    const both = a0.filter((r) => old.has(`${r.platform}:${r.username}`));
    cur = both.reduce((n, r) => n + (Number(r.followers) || 0), 0);
    prev = both.reduce((n, r) => n + (old.get(`${r.platform}:${r.username}`) || 0), 0);
  } else if (a0.length !== a1.length) {
    return [];
  }
  if (!(cur > 0 && prev > 0)) return [];
  const change = (cur - prev) / prev;
  const delta = cur - prev;
  if (delta <= 0) return [];
  const out: Signal[] = [];
  if (change >= 0.5 && delta >= 1000) {
    out.push({
      severity: "heavy",
      reason: {
        el: `Απότομο άλμα followers (+${Math.round(change * 100)}%, ${fmtK(prev)} → ${fmtK(cur)})`,
        en: `Sharp follower jump (+${Math.round(change * 100)}%, ${fmtK(prev)} → ${fmtK(cur)})`,
      },
    });
  } else if (change >= 0.4 && delta >= 1000) {
    out.push({
      severity: "medium",
      reason: {
        el: `Απότομο άλμα followers (+${Math.round(change * 100)}%, ${fmtK(prev)} → ${fmtK(cur)})`,
        en: `Sharp follower jump (+${Math.round(change * 100)}%, ${fmtK(prev)} → ${fmtK(cur)})`,
      },
    });
  } else if (change >= 0.5 && delta >= 300) {
    out.push({
      severity: "medium",
      reason: {
        el: `Απότομο άλμα followers (+${Math.round(change * 100)}%, ${fmtK(prev)} → ${fmtK(cur)})`,
        en: `Sharp follower jump (+${Math.round(change * 100)}%, ${fmtK(prev)} → ${fmtK(cur)})`,
      },
    });
  }
  return out;
}

function pickLargestAccount(list: Acc[], platform: string): Acc | null {
  let best: Acc | null = null;
  let bestF = 0;
  for (const a of list) {
    if (platformKey(a.platform) !== platform) continue;
    if (!isScorableAccount(a)) continue;
    const f = parseFollowerString(a.followers);
    if (f > bestF) {
      bestF = f;
      best = a;
    }
  }
  return best;
}

function mergeReasons(signals: Signal[], max = 3): AuthenticityReason[] {
  const heavy = signals.filter((s) => s.severity === "heavy");
  const medium = signals.filter((s) => s.severity === "medium");
  const ordered = [...heavy, ...medium];
  const seen = new Set<string>();
  const out: AuthenticityReason[] = [];
  for (const s of ordered) {
    if (seen.has(s.reason.el)) continue;
    seen.add(s.reason.el);
    out.push(s.reason);
    if (out.length >= max) break;
  }
  return out;
}

export function computeAudienceAuthenticity(input: {
  accounts: unknown;
  snapshots?: Array<{
    snapshot_at: string;
    total_followers: number | null;
    accounts?: Array<{ platform: string; username: string; followers: number }> | null;
  }> | null;
}): AudienceAuthenticity {
  const list = (Array.isArray(input.accounts) ? input.accounts : []) as Acc[];
  const scorable = list.filter(isScorableAccount);
  const maxFollowers = scorable.reduce((m, a) => Math.max(m, parseFollowerString(a.followers)), 0);

  const insufficient = (): AudienceAuthenticity => ({
    status: "insufficient",
    labelEl: LABELS.insufficient.el,
    labelEn: LABELS.insufficient.en,
    score: null,
    reasons: [],
    reasonsEn: [],
    platforms: [],
  });

  if (!scorable.length || maxFollowers < 500) return insufficient();

  const jumpSignals = followerJumpSignals(input.snapshots);
  const platforms: PlatformAuthenticity[] = [];
  let worstPlatform: { status: AudienceAuthenticityStatus; score: number; signals: Signal[]; microLoose: boolean } | null = null;

  for (const platform of ["instagram", "tiktok", "youtube"] as const) {
    const acc = pickLargestAccount(list, platform);
    if (!acc) continue;
    const result = scoreAccount(acc, platform);
    const microLoose = tierFromFollowers(result.followers) === "micro" && result.followers < 1000;
    const score = scoreFromSignals(result.signals, microLoose);
    const status = statusFromScore(score);
    platforms.push({ platform, status, score, followers: result.followers });
    if (
      !worstPlatform ||
      STATUS_RANK[status] < STATUS_RANK[worstPlatform.status] ||
      (status === worstPlatform.status && score < worstPlatform.score)
    ) {
      worstPlatform = { status, score, signals: result.signals, microLoose };
    }
  }

  if (!platforms.length || !worstPlatform) return insufficient();

  const overallSignals = [...worstPlatform.signals, ...jumpSignals];
  const worstScore = scoreFromSignals(overallSignals, worstPlatform.microLoose);
  const worstStatus = statusFromScore(worstScore);
  const reasons = mergeReasons(overallSignals);
  return {
    status: worstStatus,
    labelEl: LABELS[worstStatus].el,
    labelEn: LABELS[worstStatus].en,
    score: worstScore,
    reasons,
    reasonsEn: reasons,
    platforms,
  };
}

export function parseAuthenticityListFilter(raw: string | null | undefined): AuthenticityListFilter {
  const v = String(raw || "").trim().toLowerCase();
  if (v === "suspicious" || v === "review") return v;
  return "all";
}

export function matchesAuthenticityListFilter(
  auth: AudienceAuthenticity,
  filter: AuthenticityListFilter
): boolean {
  if (filter === "all") return true;
  return auth.status === filter;
}