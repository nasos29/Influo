import { parseFollowerString } from "./parseFollowers.ts";

/** On-the-fly data-quality checks for admin (no AI, no network). */
export type DataQualityCode =
  | "views_vs_followers"
  | "likes_gt_followers"
  | "er_high"
  | "small_high_er"
  | "duplicate_stats"
  | "private"
  | "followers_jump";

export type DataQualityFlag = { code: DataQualityCode; platform?: string; username?: string; message: string };

type Acc = {
  platform?: string | null;
  username?: string | null;
  followers?: string | number | null;
  engagement_rate?: string | null;
  avg_likes?: string | number | null;
  avg_views?: string | number | null;
  is_private?: boolean | null;
};

const num = (v: unknown): number => {
  if (v == null || v === "") return 0;
  const n = Number(String(v).replace(/[^\d.]/g, ""));
  return Number.isFinite(n) ? n : 0;
};
const fmt = (n: number) => Math.round(n).toLocaleString("el-GR");

export function creatorDataQualityFlags(
  accounts: unknown,
  snapshots?: Array<{ total_followers: number | null; snapshot_at: string; accounts?: Array<{ platform: string; username: string; followers: number }> | null }> | null
): DataQualityFlag[] {
  const flags: DataQualityFlag[] = [];
  const list = (Array.isArray(accounts) ? accounts : []) as Acc[];
  for (const a of list) {
    if (!a?.platform) continue;
    const platform = String(a.platform);
    const username = String(a.username || "").trim();
    const followers = parseFollowerString(String(a.followers ?? "")) || 0;
    const likes = num(a.avg_likes);
    const views = num(a.avg_views);
    const er = num(a.engagement_rate);
    const at = `${platform} @${username.replace(/^@/, "")}`;
    if (a.is_private) flags.push({ code: "private", platform, username, message: `${at}: ο λογαριασμός εμφανίζεται ιδιωτικός, δεν διαβάζονται στατιστικά.` });
    if (followers > 0 && views > followers * 20)
      flags.push({ code: "views_vs_followers", platform, username, message: `${at}: μέσες προβολές ${fmt(views)} είναι ${fmt(views / followers)}× τους ακόλουθους (${fmt(followers)}). Πιθανό λάθος username ή followers.` });
    if (followers > 0 && likes > followers)
      flags.push({ code: "likes_gt_followers", platform, username, message: `${at}: μέσα likes ${fmt(likes)} > ακόλουθοι ${fmt(followers)}.` });
    if (er > 25)
      flags.push({ code: "er_high", platform, username, message: `${at}: engagement ${er.toFixed(1)}% (πάνω από 25%, ασυνήθιστα υψηλό).` });
    else if (followers > 0 && followers < 500 && er > 10)
      flags.push({ code: "small_high_er", platform, username, message: `${at}: μόνο ${fmt(followers)} ακόλουθοι με engagement ${er.toFixed(1)}%.` });
  }
  // Same platform twice with identical averages → likely the same posts counted twice.
  const seen = new Map<string, Acc>();
  for (const a of list) {
    if (!a?.platform) continue;
    const likes = num(a.avg_likes), views = num(a.avg_views);
    if (!(likes > 0 || views > 0)) continue;
    const key = `${String(a.platform).toLowerCase()}|${likes}|${views}`;
    const prev = seen.get(key);
    if (prev)
      flags.push({ code: "duplicate_stats", platform: String(a.platform), message: `${a.platform}: @${String(prev.username || "").replace(/^@/, "")} και @${String(a.username || "").replace(/^@/, "")} έχουν ίδια μέσα στατιστικά (likes ${fmt(likes)}, views ${fmt(views)}). Πιθανή διπλή μέτρηση.` });
    else seen.set(key, a);
  }
  const snaps = (snapshots || []).filter((s) => Number(s.total_followers) > 0).slice(0, 2);
  if (snaps.length === 2) {
    // Like-for-like: only accounts present (same platform+username) in both snapshots.
    const a0 = snaps[0].accounts || [], a1 = snaps[1].accounts || [];
    let cur = Number(snaps[0].total_followers), prev = Number(snaps[1].total_followers);
    if (a0.length && a1.length) {
      const old = new Map(a1.map((r) => [`${r.platform}:${r.username}`, Number(r.followers) || 0]));
      const both = a0.filter((r) => old.has(`${r.platform}:${r.username}`));
      cur = both.reduce((n, r) => n + (Number(r.followers) || 0), 0);
      prev = both.reduce((n, r) => n + (old.get(`${r.platform}:${r.username}`) || 0), 0);
    } else if (a0.length !== a1.length) {
      cur = prev = 0;
    }
    if (cur > 0 && prev > 0) {
    const change = (cur - prev) / prev;
    if (Math.abs(change) >= 0.5 && Math.abs(cur - prev) >= 300)
      flags.push({ code: "followers_jump", message: `Σύνολο ακολούθων άλλαξε από ${fmt(prev)} σε ${fmt(cur)} (${change > 0 ? "+" : ""}${Math.round(change * 100)}%) μεταξύ των δύο τελευταίων ανανεώσεων.` });
    }
  }
  return flags;
}

/** Problem-specific email drafts (admin reviews/edits and sends manually). */
export function dataQualityEmailTemplate(code: DataQualityCode, name: string, flag: DataQualityFlag): { subject: string; body: string } {
  const hi = `Γεια σου ${name || ""},`.replace(" ,", ",");
  const acc = flag.username ? `@${flag.username.replace(/^@/, "")} (${flag.platform})` : flag.platform || "ο λογαριασμός σου";
  const sign = "\n\nΑν χρειάζεσαι βοήθεια, απάντησε σε αυτό το email.\n\nΗ ομάδα του Influo";
  switch (code) {
    case "private":
      return {
        subject: "Influo: ο λογαριασμός σου εμφανίζεται ιδιωτικός",
        body: `${hi}\n\nΚατά την ενημέρωση των στατιστικών σου, ο λογαριασμός ${acc} εμφανίστηκε ιδιωτικός, οπότε δεν μπορούμε να διαβάσουμε ακόλουθους και αλληλεπιδράσεις. Έτσι το προφίλ σου φαίνεται με ελλιπή στοιχεία στα brands.\n\nΤι μπορείς να κάνεις:\n• Κάνε τον λογαριασμό δημόσιο (Ρυθμίσεις → Απόρρητο λογαριασμού) ή άλλαξέ τον σε επαγγελματικό/creator.\n• Αν έχεις και άλλο, δημόσιο λογαριασμό, πρόσθεσέ τον στο προφίλ σου στο Influo.\n• Μόλις γίνει δημόσιος, πάτησε «Ανανέωση στατιστικών» στο dashboard σου.${sign}`,
      };
    case "duplicate_stats":
      return {
        subject: "Influo: διπλός λογαριασμός στο προφίλ σου",
        body: `${hi}\n\nΣτο προφίλ σου έχεις δύο λογαριασμούς ${flag.platform} που δείχνουν ακριβώς τα ίδια στατιστικά. Συνήθως σημαίνει ότι ο ίδιος λογαριασμός έχει προστεθεί δύο φορές ή ότι το ένα username είναι λάθος.\n\nΤι μπορείς να κάνεις:\n• Έλεγξε τα usernames στο προφίλ σου και κράτησε μόνο τους λογαριασμούς που είναι πράγματι δικοί σου.\n• Αφαίρεσε τον διπλό λογαριασμό και πάτησε «Ανανέωση στατιστικών».${sign}`,
      };
    case "er_high":
    case "small_high_er":
      return {
        subject: "Influo: έλεγχος στατιστικών του λογαριασμού σου",
        body: `${hi}\n\nΤο engagement του λογαριασμού ${acc} βγαίνει ασυνήθιστα υψηλό σε σχέση με τους ακολούθους. Συχνά αυτό σημαίνει ότι οι ακόλουθοι δεν διαβάστηκαν σωστά (π.χ. λάθος username ή πρόσφατη μεγάλη αλλαγή).\n\nΤι μπορείς να κάνεις:\n• Επιβεβαίωσε ότι το username στο προφίλ σου είναι ακριβώς ίδιο με του Instagram/TikTok (π.χ. τελείες, underscores).\n• Ανέβασε ένα πρόσφατο στιγμιότυπο από τα Insights (ακόλουθοι, προσέγγιση), ώστε να επιβεβαιώσουμε τα νούμερα.\n• Πάτησε «Ανανέωση στατιστικών» στο dashboard σου.${sign}`,
      };
    case "followers_jump":
      return {
        subject: "Influo: μεγάλη αλλαγή στους ακολούθους σου",
        body: `${hi}\n\nΣτην τελευταία ενημέρωση οι ακόλουθοί σου άλλαξαν απότομα (${flag.message.replace(/^Σύνολο ακολούθων /, "")}). Θέλουμε να βεβαιωθούμε ότι τα στοιχεία στο προφίλ σου είναι σωστά.\n\nΤι μπορείς να κάνεις:\n• Έλεγξε ότι τα usernames στο προφίλ σου είναι σωστά.\n• Αν άλλαξες username ή λογαριασμό, ενημέρωσέ το στο προφίλ σου και πάτησε «Ανανέωση στατιστικών».${sign}`,
      };
    case "views_vs_followers":
    case "likes_gt_followers":
    default:
      return {
        subject: "Influo: πιθανό λάθος username στο προφίλ σου",
        body: `${hi}\n\nΣτον λογαριασμό ${acc} οι ακόλουθοι που διαβάζουμε είναι πολύ λίγοι σε σχέση με τα likes/προβολές των βίντεό σου (${flag.message.split(": ").slice(1).join(": ")}). Αυτό συνήθως σημαίνει ότι το username στο προφίλ είναι λάθος (π.χ. λείπει μια τελεία ή ένα underscore) και διαβάζουμε άλλον λογαριασμό.\n\nΤι μπορείς να κάνεις:\n• Άνοιξε το προφίλ σου στο Instagram/TikTok και αντέγραψε το username ακριβώς όπως εμφανίζεται.\n• Διόρθωσέ το στο προφίλ σου στο Influo και πάτησε «Ανανέωση στατιστικών».\n• Με σωστά νούμερα το προφίλ σου εμφανίζεται πιο ψηλά στις προτάσεις προς τα brands.${sign}`,
      };
  }
}
