import type { PublicUserKind } from "@/lib/publicAccountNav";
import { hasLikelySupabaseAuthSession } from "@/lib/authStorage";

export type HeaderAvatarSnapshot = {
  userKind: Exclude<PublicUserKind, "none">;
  accountName: string;
  avatarUrl: string;
  avatarName: string;
};

type StoreSnapshot = HeaderAvatarSnapshot & { ready: true } | {
  userKind: "none";
  accountName: "";
  avatarUrl: "";
  avatarName: "";
  ready: boolean;
};

export const HEADER_AVATAR_STORAGE_KEY = "influo:header-avatar";

const STORAGE_KEY = HEADER_AVATAR_STORAGE_KEY;

/**
 * Runs from the document head before first paint.
 * - Cached avatar: hide guest login/signup and paint the photo or initial.
 * - Likely session, no cache: hide guest login/signup and show the pending circle.
 * - No session hint: leave SSR guest «Σύνδεση» alone (no grey circle).
 */
export const HEADER_AVATAR_BOOT_SCRIPT = `(function(){try{var root=document.documentElement;var raw=localStorage.getItem(${JSON.stringify(HEADER_AVATAR_STORAGE_KEY)});if(raw){var data=JSON.parse(raw);var kind=data&&data.userKind;if(kind==="brand"||kind==="influencer"||kind==="admin"||kind==="signed-in"){root.classList.add("header-avatar-hot");var url=typeof data.avatarUrl==="string"?data.avatarUrl.trim():"";var css;if(/^https:\\/\\//i.test(url)&&!/["'()\\\\\\s]/.test(url)){root.style.setProperty("--header-avatar-image",'url("'+url+'")');css="html.header-avatar-hot .header-avatar-pending{display:none!important}html.header-avatar-hot .header-login-link,html.header-avatar-hot .header-signup-btn{display:none!important}html.header-avatar-hot .header-avatar-hot-slot{display:flex!important;background-image:var(--header-avatar-image);background-size:cover;background-position:center}";}else{var name=(typeof data.avatarName==="string"&&data.avatarName.trim())||(typeof data.accountName==="string"&&data.accountName.trim())||"U";var initial=name.charAt(0).toUpperCase()||"U";if(/["\\\\\\n\\r]/.test(initial))initial="U";root.classList.add("header-avatar-initial");root.style.setProperty("--header-avatar-initial",'"'+initial+'"');css="html.header-avatar-hot .header-avatar-pending{display:none!important}html.header-avatar-hot .header-login-link,html.header-avatar-hot .header-signup-btn{display:none!important}html.header-avatar-hot .header-avatar-hot-slot{display:flex!important;align-items:center;justify-content:center;background-image:linear-gradient(to bottom right,#3b82f6,#a855f7);color:#fff;font-size:14px;font-weight:600}html.header-avatar-initial .header-avatar-hot-slot::before{content:var(--header-avatar-initial)}";}var style=document.createElement("style");style.id="header-avatar-boot";style.textContent=css;document.head.appendChild(style);return;}}var hasAuth=false;try{var ls=localStorage;if(ls&&typeof ls.length==="number"){for(var i=0;i<ls.length;i++){var k=ls.key(i);if(k&&k!=="influo-logged-out"&&(/^sb-/i.test(k)||/auth-token/i.test(k)||/supabase/i.test(k))){hasAuth=true;break;}}}}catch(e){}if(!hasAuth){try{if(document.cookie&&/(?:^|;\\s*)sb-[^=]+=/.test(document.cookie))hasAuth=true;}catch(e){}}if(!hasAuth)return;root.classList.add("header-auth-pending");var pending=document.createElement("style");pending.id="header-avatar-boot";pending.textContent="html.header-auth-pending .header-login-link,html.header-auth-pending .header-signup-btn{display:none!important}html.header-auth-pending .header-avatar-pending{display:inline-block!important}";document.head.appendChild(pending);}catch(e){}})();`;

/** Guest / logged-out: show «Σύνδεση» immediately (SSR + client). */
const GUEST: StoreSnapshot = {
  userKind: "none",
  accountName: "",
  avatarUrl: "",
  avatarName: "",
  ready: true,
};

/** Session likely but identity not resolved yet — show the grey circle only then. */
const PENDING: StoreSnapshot = {
  userKind: "none",
  accountName: "",
  avatarUrl: "",
  avatarName: "",
  ready: false,
};

const listeners = new Set<() => void>();
let current: StoreSnapshot = GUEST;
let storageLoaded = false;

function same(a: StoreSnapshot, b: StoreSnapshot): boolean {
  return a.userKind === b.userKind
    && a.accountName === b.accountName
    && a.avatarUrl === b.avatarUrl
    && a.avatarName === b.avatarName
    && a.ready === b.ready;
}

function notify(next: StoreSnapshot): void {
  if (same(current, next)) return;
  current = next;
  listeners.forEach((listener) => listener());
}

function readStorage(): HeaderAvatarSnapshot | null {
  if (typeof localStorage === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<HeaderAvatarSnapshot>;
    const userKind = parsed.userKind;
    if (userKind !== "brand" && userKind !== "influencer" && userKind !== "admin" && userKind !== "signed-in") {
      return null;
    }
    return {
      userKind,
      accountName: typeof parsed.accountName === "string" ? parsed.accountName : "",
      avatarUrl: typeof parsed.avatarUrl === "string" ? parsed.avatarUrl : "",
      avatarName: typeof parsed.avatarName === "string" ? parsed.avatarName : "",
    };
  } catch {
    return null;
  }
}

function ensureStorage(): void {
  if (storageLoaded || typeof localStorage === "undefined") return;
  storageLoaded = true;
  const stored = readStorage();
  if (stored) {
    current = { ...stored, ready: true };
    return;
  }
  // Only block on a skeleton when auth storage/cookies suggest a session.
  current = hasLikelySupabaseAuthSession() ? PENDING : GUEST;
}

export function subscribeHeaderAvatar(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** SSR defaults to guest so the login label is in the HTML — no grey circle for visitors. */
export function getHeaderAvatarServerSnapshot(): StoreSnapshot {
  return GUEST;
}

export function getHeaderAvatarSnapshot(): StoreSnapshot {
  ensureStorage();
  return current;
}

export function writeHeaderAvatarCache(value: HeaderAvatarSnapshot): void {
  const next: StoreSnapshot = { ...value, ready: true };
  if (typeof localStorage !== "undefined") {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
    } catch {
      /* quota / private mode */
    }
  }
  if (typeof document !== "undefined") {
    document.documentElement.classList.remove("header-auth-pending");
  }
  storageLoaded = true;
  notify(next);
}

export function clearHeaderAvatarCache(): void {
  if (typeof localStorage !== "undefined") {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
  }
  if (typeof document !== "undefined") {
    document.documentElement.classList.remove("header-avatar-hot", "header-avatar-initial", "header-auth-pending");
    document.documentElement.style.removeProperty("--header-avatar-image");
    document.documentElement.style.removeProperty("--header-avatar-initial");
    document.getElementById("header-avatar-boot")?.remove();
  }
  storageLoaded = true;
  notify(GUEST);
}

/** Test helper. Resets the in-memory snapshot between cases. */
export function resetHeaderAvatarCacheForTests(): void {
  current = GUEST;
  storageLoaded = false;
  listeners.clear();
}
