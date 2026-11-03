import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { supabaseService, userFromBearer } from "@/lib/apiAuth";
import { CATEGORIES, categoryLabel, parseStoredCategories } from "@/lib/categories";
import { findContactInfo } from "@/lib/contactFilter";
import { statsFromAccounts, parseFollowerNumber } from "@/lib/platformStats";
import { sharedCategoryKeys } from "@/lib/recommendations";

export const maxDuration = 30;

/** Cheapest model; one call per draft, compact prompt, short JSON. */
const MODEL = (process.env.GEMINI_CAMPAIGN_MODEL || "gemini-2.0-flash-lite").trim();
const PER_DAY = 8;
const MIN_GAP_MS = 20_000;

type Limits = Map<string, { day: string; count: number; last: number }>;
const store = globalThis as unknown as { __influoAiDraft?: Limits };
const limits = (store.__influoAiDraft ??= new Map());

const GOALS: Record<string, string> = {
  awareness: "αναγνωρισιμότητα brand",
  launch: "λανσάρισμα νέου προϊόντος",
  sales: "πωλήσεις / κωδικός έκπτωσης",
  traffic: "επισκέψεις σε κατάστημα ή site",
  ugc: "UGC περιεχόμενο για τα κανάλια του brand",
  event: "κάλυψη εκδήλωσης",
};
const AGES = new Set(["18-24", "25-34", "35-44", "45+", "all"]);
const GENDERS = new Set(["women", "men", "all"]);
const PLATFORMS = new Set(["instagram", "tiktok", "youtube", "facebook"]);
const CONTENT = new Set(["reel", "story", "post", "tiktok", "youtube", "ugc"]);
const TIMING = new Set(["asap", "2weeks", "month", "flexible"]);

function pick<T extends string>(value: unknown, allowed: Set<string>, fallback: T): T {
  const v = typeof value === "string" ? value : "";
  return (allowed.has(v) ? v : fallback) as T;
}

function clean(value: unknown, max: number): string {
  return (typeof value === "string" ? value : "").replace(/\s+/g, " ").trim().slice(0, max);
}

function rateLimit(brandId: string): string | null {
  const today = new Date().toISOString().slice(0, 10);
  const row = limits.get(brandId);
  const now = Date.now();
  if (row && row.day === today) {
    if (now - row.last < MIN_GAP_MS) return "wait";
    if (row.count >= PER_DAY) return "daily";
    row.count += 1;
    row.last = now;
  } else {
    limits.set(brandId, { day: today, count: 1, last: now });
  }
  return null;
}

export async function POST(request: NextRequest) {
  const user = await userFromBearer(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const admin = supabaseService();
  const { data: brand } = await admin.from("brands").select("id, brand_name").eq("id", user.id).maybeSingle();
  if (!brand) return NextResponse.json({ error: "Brand not found" }, { status: 403 });

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const goal = pick(body.goal, new Set(Object.keys(GOALS)), "awareness");
  const category = typeof body.category === "string" && (CATEGORIES as readonly string[]).includes(body.category) ? body.category : "";
  const product = clean(body.product, 140);
  const age: string = pick(body.age, AGES, "all");
  const gender: string = pick(body.gender, GENDERS, "all");
  const inPerson = body.inPerson === true;
  const location = inPerson ? clean(body.location, 60) : "";
  const platforms = (Array.isArray(body.platforms) ? body.platforms : []).filter((p): p is string => typeof p === "string" && PLATFORMS.has(p)).slice(0, 4);
  const content = (Array.isArray(body.content) ? body.content : []).filter((p): p is string => typeof p === "string" && CONTENT.has(p)).slice(0, 6);
  const budget = Math.max(0, Math.min(100000, Math.round(Number(body.budget) || 0)));
  const slotsRaw = Math.round(Number(body.slots) || 0);
  const slots = slotsRaw > 0 ? Math.min(100, slotsRaw) : null;
  const timing = pick(body.timing, TIMING, "flexible");

  if (!category) return NextResponse.json({ error: "category", message: { el: "Επιλέξτε κατηγορία.", en: "Pick a category." } }, { status: 400 });
  if (!platforms.length) return NextResponse.json({ error: "platforms", message: { el: "Επιλέξτε τουλάχιστον μία πλατφόρμα.", en: "Pick at least one platform." } }, { status: 400 });
  if (product && findContactInfo(product)) {
    return NextResponse.json({ error: "contact_info_not_allowed", message: { el: "Χωρίς links, email ή τηλέφωνα.", en: "No links, emails or phone numbers." } }, { status: 400 });
  }

  const limited = rateLimit(user.id);
  if (limited) {
    return NextResponse.json(
      {
        error: "rate_limited",
        message:
          limited === "wait"
            ? { el: "Περιμένετε λίγα δευτερόλεπτα πριν ξαναδοκιμάσετε.", en: "Wait a few seconds before trying again." }
            : { el: "Φτάσατε το ημερήσιο όριο δημιουργιών με AI. Συνεχίστε με τη φόρμα ή δοκιμάστε αύριο.", en: "Daily AI limit reached. Use the form or try tomorrow." },
      },
      { status: 429 }
    );
  }

  const apiKey = (process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY || "").trim();
  if (!apiKey) return NextResponse.json({ error: "ai_unavailable", message: { el: "Το AI δεν είναι διαθέσιμο τώρα. Χρησιμοποιήστε τη φόρμα.", en: "AI is unavailable. Use the form." } }, { status: 503 });

  const perCreatorHint = budget > 0 ? Math.max(20, Math.round(budget / (slots || 3))) : 0;
  // Compact prompt: facts only, strict short JSON.
  const prompt = [
    "Γράψε σε σωστά ελληνικά μια καμπάνια influencer για ελληνική πλατφόρμα. Επαγγελματικό, σύντομο ύφος, χωρίς emoji, χωρίς links/email/τηλέφωνα.",
    `Brand: ${clean(brand.brand_name, 60) || "-"}. Στόχος: ${GOALS[goal]}. Κατηγορία: ${categoryLabel(category, "el") || category}.`,
    product ? `Προϊόν/υπηρεσία: ${product}.` : "",
    `Κοινό: ηλικία ${age === "all" ? "όλες" : age}, φύλο ${gender === "women" ? "γυναίκες" : gender === "men" ? "άνδρες" : "όλοι"}.`,
    inPerson ? `Απαιτείται φυσική παρουσία${location ? ` στην περιοχή ${location}` : ""}.` : "Δεν απαιτείται φυσική παρουσία.",
    `Πλατφόρμες: ${platforms.join(", ")}. Περιεχόμενο: ${content.join(", ") || "ελεύθερο"}.`,
    budget > 0 ? `Συνολικό budget: ${budget} €.` : "Αμοιβή: προϊόν/ανταλλαγή.",
    slots ? `Creators: ${slots}.` : "Creators: χωρίς όριο.",
    `Χρονισμός: ${{ asap: "άμεσα", "2weeks": "σε 2 εβδομάδες", month: "μέσα στον μήνα", flexible: "ευέλικτος" }[timing]}.`,
    'Επέστρεψε ΜΟΝΟ JSON: {"title":"<=70 χαρ.","description":"2-4 προτάσεις, <=600 χαρ.","deliverables":"π.χ. 1 Reel, 3 Stories","slots":αριθμός ή null,"price_per_creator":ακέραιος σε € ή 0}',
  ]
    .filter(Boolean)
    .join("\n");

  let draft: { title?: string; description?: string; deliverables?: string; slots?: number | null; price_per_creator?: number };
  try {
    const model = new GoogleGenerativeAI(apiKey).getGenerativeModel({
      model: MODEL,
      generationConfig: { responseMimeType: "application/json", temperature: 0.5, maxOutputTokens: 400 },
    });
    const result = await model.generateContent(prompt);
    draft = JSON.parse(result.response.text() || "{}");
  } catch (err) {
    console.error("[ai-draft] gemini", MODEL, err instanceof Error ? err.message.slice(0, 200) : "failed");
    return NextResponse.json({ error: "ai_failed", message: { el: "Το AI δεν απάντησε. Δοκιμάστε ξανά ή χρησιμοποιήστε τη φόρμα.", en: "AI did not respond. Try again or use the form." } }, { status: 502 });
  }

  const stripContact = (text: string) => (findContactInfo(text) ? "" : text);
  const title = stripContact(clean(draft.title, 90));
  const description = stripContact(clean(draft.description, 900));
  const deliverables = stripContact(clean(draft.deliverables, 200));
  const aiPrice = Math.round(Number(draft.price_per_creator) || 0);
  const price = aiPrice > 0 ? Math.min(aiPrice, budget > 0 ? budget : aiPrice) : perCreatorHint;
  const outSlots = slots ?? (Number.isFinite(Number(draft.slots)) && Number(draft.slots) > 0 ? Math.min(100, Math.round(Number(draft.slots))) : null);
  console.log("[ai-draft] ok", user.id.slice(0, 8), MODEL);

  // Matching creators: approved, available, same category, active on a chosen platform.
  const { data: rows } = await admin
    .from("influencers")
    .select("id, display_name, category, accounts, avatar_url, profile_slug, location, availability_status")
    .eq("approved", true)
    .limit(400);
  const matches = (rows || [])
    .filter((r) => (!r.availability_status || r.availability_status === "available") && sharedCategoryKeys(category, r.category).length > 0)
    .map((r) => {
      const stats = statsFromAccounts(r.accounts).filter((s) => platforms.includes(String(s.platform).toLowerCase()));
      const followers = stats.reduce((n, s) => Math.max(n, parseFollowerNumber(s.followers)), 0);
      return { r, followers, onPlatform: stats.length > 0 };
    })
    .filter((m) => m.onPlatform)
    .sort((a, b) => b.followers - a.followers)
    .slice(0, 6)
    .map(({ r, followers }) => ({
      id: r.id,
      display_name: r.display_name || "Creator",
      avatar_url: r.avatar_url || null,
      profile_slug: r.profile_slug || null,
      categories: parseStoredCategories(r.category),
      followers,
    }));

  return NextResponse.json({
    ok: true,
    draft: {
      title,
      description,
      deliverables,
      slots: outSlots,
      pricePerCreator: price > 0 ? price : null,
      category,
      platforms,
      location,
      compensation: budget > 0 ? "money" : "product",
      budget: budget || null,
      timing,
    },
    matches,
  });
}
