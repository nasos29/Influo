/**
 * Detects messages that push the other party off Influo chat
 * (Instagram / TikTok DM / WhatsApp / etc.) rather than discussing deliverables.
 */

/** Stored message prefix; rendered as an in-flow safety notice in chat. */
export const OFF_PLATFORM_TIP_MARKER = "⟦influo:keep-in-app⟧";

export const OFF_PLATFORM_TIP_EL =
  "Για τη δική σας ασφάλεια, προτιμήστε να γίνεται η συζήτηση μέσα στο Influo και όχι εκτός πλατφόρμας. Έτσι διατηρείται το ιστορικό της συμφωνίας.";

export const OFF_PLATFORM_TIP_EN =
  "For your safety, please keep this conversation inside Influo rather than off-platform. That preserves the agreement history.";

/** Instagram + common typos (instagrm, instgram, …). */
const IG =
  "(?:instagram|instagrm|instgram|instgaram|insta\\s*gram|\\binsta\\b|\\big\\b|ινστα(?:γκραμ)?|ινσταγραμ)";

/** TikTok + short forms / Greek spellings. */
const TT = "(?:tik\\s*tok|tiktok|\\btt\\b|τικ\\s*τοκ|τικτοκ|τιικτοκ)";

const CHANNEL = `(?:${IG}|${TT}|whats?app|viber|telegram|messenger|snapchat|\\bsnap\\b)`;

export function isOffPlatformTipMessage(content: string | null | undefined): boolean {
  return String(content || "").startsWith(OFF_PLATFORM_TIP_MARKER);
}

export function offPlatformTipBody(lang: "el" | "en" = "el"): string {
  return lang === "en" ? OFF_PLATFORM_TIP_EN : OFF_PLATFORM_TIP_EL;
}

export function offPlatformTipContent(): string {
  return `${OFF_PLATFORM_TIP_MARKER}${OFF_PLATFORM_TIP_EL}`;
}

export function looksLikeOffPlatformContact(text: string): boolean {
  const raw = String(text || "").trim();
  if (!raw) return false;
  if (isOffPlatformTipMessage(raw)) return false;

  const t = raw
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "");

  // Profile / chat deep links (not post / reel / TV / video URLs)
  if (/instagram\.com\/(?!(?:p|reel|tv|stories)\/)[a-z0-9._]+/i.test(raw)) return true;
  if (/tiktok\.com\/@[\w.-]+/i.test(raw)) return true;
  if (/(?:wa\.me\/|api\.whatsapp\.com|chat\.whatsapp\.com|t\.me\/|viber\.com\/)/i.test(raw)) return true;

  const aboutDeliverable =
    /(αναρτησ|δημοσιευ|παραδοτ|content|story|stories|reel|reels|\bpost\b|\bposts\b|video|βιντεο)/i.test(t);

  const contactVerb =
    /(γραψ(?:ε|τε|ω)|στειλ(?:ε|τε|ω)|μιλ(?:α|αμε|ηστε|ατε)|λεμε|πουμε|leme|poyme|talk(?:\s+on|\s+in)?|chat(?:\s+on|\s+in)?|επικοινων|συνομιλ|inbox|\bdm\b|message me|text me|hit me up)/i.test(
      t
    );
  const channel = new RegExp(CHANNEL, "i").test(t);

  if (contactVerb && channel && !aboutDeliverable) return true;

  if (
    new RegExp(`\\bστο\\s+(?:${CHANNEL})\\b`, "i").test(t) &&
    !aboutDeliverable &&
    /(γραψ|στειλ|μιλ|λεμ|πουμ|leme|poyme|talk|chat|επικοινων|dm|inbox|μηνυμ)/i.test(t)
  ) {
    return true;
  }

  return false;
}
