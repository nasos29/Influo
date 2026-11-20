/**
 * Detects messages that push the other party off Influo chat
 * (Instagram / TikTok DM / WhatsApp / phone / email / etc.) rather than discussing deliverables.
 */

import { findContactInfo } from "@/lib/contactFilter";

/** Stored message prefix; rendered as an in-flow safety notice in chat. */
export const OFF_PLATFORM_TIP_MARKER = "⟦influo:keep-in-app⟧";

export const OFF_PLATFORM_TIP_EL =
  "Για τη δική σας ασφάλεια, προτιμήστε να γίνεται η συζήτηση μέσα στο Influo και όχι εκτός πλατφόρμας. Έτσι διατηρείται το ιστορικό της συμφωνίας. Αν θέλετε να στείλετε κάποιο αρχείο ή βίντεο, χρησιμοποιήστε την επισύναψη στο chat.";

export const OFF_PLATFORM_TIP_EN =
  "For your safety, please keep this conversation inside Influo rather than off-platform. That preserves the agreement history. If you want to send a file or video, use the attachment button in the chat.";

/** Instagram + common typos (instagrm, instgram, …) + Greeklish. */
const IG =
  "(?:instagram|instagrm|instgram|instgaram|insta\\s*gram|\\binsta\\b|\\big\\b|ινστα(?:γκραμ)?|ινσταγραμ|instagr?am)";

/** TikTok + short forms / Greek spellings. */
const TT = "(?:tik\\s*tok|tiktok|\\btt\\b|τικ\\s*τοκ|τικτοκ|τιικτοκ)";

const CHANNEL = `(?:${IG}|${TT}|whats?app|viber|telegram|messenger|snapchat|\\bsnap\\b)`;

/** Email / mail spellings (EL, EN, Greeklish) and file hosts used to move deliverables off-platform. */
const EMAIL_MAIL =
  "(?:e-?mail|\\bmail\\b|μειλ|ημειλ|ημε\\s*ιλ|με\\s*ιλ)";
const FILE_HOST = "(?:google\\s*drive|\\bdrive\\b|wetransfer|we\\s*transfer|we\\.tl)";
const FILE_TRANSFER_OFF_PLATFORM = `(?:${EMAIL_MAIL}|${FILE_HOST})`;

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

  // Direct contact details (phone / email) — same soft tip, never blocks send.
  const contactKind = findContactInfo(raw);
  if (contactKind === "email" || contactKind === "phone") return true;

  // Profile / chat deep links (not post / reel / TV / video URLs)
  if (/instagram\.com\/(?!(?:p|reel|tv|stories)\/)[a-z0-9._]+/i.test(raw)) return true;
  // TikTok profile (exclude /@user/video/… — those are deliverables)
  if (/tiktok\.com\/@[\w.-]+/i.test(raw) && !/tiktok\.com\/@[\w.-]+\/video\//i.test(raw)) return true;
  if (/(?:wa\.me\/|api\.whatsapp\.com|chat\.whatsapp\.com|t\.me\/|viber\.com\/)/i.test(raw)) return true;

  const aboutDeliverable =
    /(αναρτησ|δημοσιευ|παραδοτ|content|story|stories|reel|reels|\bpost\b|\bposts\b|video|βιντεο|αρχει)/i.test(t);

  if (new RegExp(FILE_TRANSFER_OFF_PLATFORM, "i").test(t)) {
    const asksForEmailMail =
      (/(?:δωσ(?:ε|τε)|πε(?:ς|τε)|στε\s*ιλ(?:ε|τε)?|γραψ(?:ε|τε)|give\s+me|send\s+me|tell\s+me)/i.test(t) &&
        new RegExp(EMAIL_MAIL, "i").test(t)) ||
      new RegExp(`${EMAIL_MAIL}.{0,30}(?:σου|σας|your)`, "i").test(t);
    const sendViaFileHost =
      new RegExp(FILE_HOST, "i").test(t) &&
      /(?:στε\s*ιλ|στειλ|send|θα\s+(?:σου|σας|το)|με\s+)/i.test(t);
    const emailMailForFiles =
      new RegExp(EMAIL_MAIL, "i").test(t) &&
      /(?:για\s+τα\s+αρχει|αρχει|file|files|so\s+i\s+can\s+send)/i.test(t);
    if (asksForEmailMail || sendViaFileHost || emailMailForFiles) return true;
  }

  if (/(?:drive\.google\.com|wetransfer\.com|we\.tl\/)/i.test(raw)) return true;

  const contactVerb =
    /(γραψ(?:ε|τε|ω)|στειλ(?:ε|τε|ω)|μιλ(?:α|αμε|ηστε|ατε)|λεμε|πουμε|leme|poyme|mila(?:me)?|grapse|steile|talk(?:\s+on|\s+in)?|chat(?:\s+on|\s+in)?|επικοινων|συνομιλ|inbox|\bdm\b|message me|text me|hit me up)/i.test(
      t
    );
  const channel = new RegExp(CHANNEL, "i").test(t);

  if (contactVerb && channel && !aboutDeliverable) return true;

  if (
    new RegExp(`\\bστο\\s+(?:${CHANNEL})\\b`, "i").test(t) &&
    !aboutDeliverable &&
    /(γραψ|στειλ|μιλ|λεμ|πουμ|leme|poyme|mila|grapse|steile|talk|chat|επικοινων|dm|inbox|μηνυμ)/i.test(t)
  ) {
    return true;
  }

  return false;
}
