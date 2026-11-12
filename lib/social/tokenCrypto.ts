import { createCipheriv, createDecipheriv, createHmac, randomBytes, timingSafeEqual } from "crypto";

const ALGO = "aes-256-gcm";

function encryptionKey(): Buffer {
  const hex = process.env.SOCIAL_TOKEN_ENCRYPTION_KEY || "";
  if (!/^[0-9a-fA-F]{64}$/.test(hex)) {
    throw new Error("SOCIAL_TOKEN_ENCRYPTION_KEY must be 64 hex chars (32 bytes)");
  }
  return Buffer.from(hex, "hex");
}

function stateSecret(): string {
  const s = process.env.SOCIAL_OAUTH_STATE_SECRET || process.env.SOCIAL_TOKEN_ENCRYPTION_KEY || "";
  if (!s || s.length < 32) {
    throw new Error("SOCIAL_OAUTH_STATE_SECRET (or SOCIAL_TOKEN_ENCRYPTION_KEY) missing/too short");
  }
  return s;
}

/** AES-256-GCM. Format: ivHex:tagHex:cipherHex */
export function encryptSecret(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGO, encryptionKey(), iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("hex")}:${tag.toString("hex")}:${enc.toString("hex")}`;
}

export function decryptSecret(payload: string): string {
  const [ivHex, tagHex, dataHex] = payload.split(":");
  if (!ivHex || !tagHex || !dataHex) throw new Error("Invalid encrypted payload");
  const decipher = createDecipheriv(ALGO, encryptionKey(), Buffer.from(ivHex, "hex"));
  decipher.setAuthTag(Buffer.from(tagHex, "hex"));
  const dec = Buffer.concat([decipher.update(Buffer.from(dataHex, "hex")), decipher.final()]);
  return dec.toString("utf8");
}

export type OAuthStatePayload = {
  influencerId: string;
  uid: string;
  /**
   * Admin-only OAuth spike purpose.
   * Instagram callbacks must continue to require "admin_ig_test".
   * TikTok callbacks (Phase 4+) must require "admin_tt_test".
   */
  purpose?: "admin_ig_test" | "admin_tt_test";
  nonce: string;
  exp: number;
};

export function signOAuthState(payload: Omit<OAuthStatePayload, "nonce" | "exp">, ttlSec = 600): string {
  const body: OAuthStatePayload = {
    ...payload,
    nonce: randomBytes(16).toString("hex"),
    exp: Math.floor(Date.now() / 1000) + ttlSec,
  };
  const raw = Buffer.from(JSON.stringify(body), "utf8").toString("base64url");
  const sig = createHmac("sha256", stateSecret()).update(raw).digest("base64url");
  return `${raw}.${sig}`;
}

export function verifyOAuthState(
  state: string,
  opts?: { nowSec?: number }
): OAuthStatePayload | null {
  const [raw, sig] = state.split(".");
  if (!raw || !sig) return null;
  const expected = createHmac("sha256", stateSecret()).update(raw).digest("base64url");
  try {
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  } catch {
    return null;
  }
  try {
    const body = JSON.parse(Buffer.from(raw, "base64url").toString("utf8")) as OAuthStatePayload;
    if (!body?.influencerId || !body?.uid || !body?.exp || !body?.nonce) return null;
    const now = opts?.nowSec ?? Math.floor(Date.now() / 1000);
    if (body.exp < now) return null;
    return body;
  } catch {
    return null;
  }
}

/** In-memory one-shot nonce store (unit tests + process-local fallback). */
export class MemoryOAuthNonceStore {
  private used = new Map<string, number>();

  /** @returns true if first use; false if replay. */
  tryConsume(nonce: string, expiresAtSec: number): boolean {
    this.prune(Math.floor(Date.now() / 1000));
    if (this.used.has(nonce)) return false;
    this.used.set(nonce, expiresAtSec);
    return true;
  }

  clear() {
    this.used.clear();
  }

  private prune(nowSec: number) {
    for (const [n, exp] of this.used) {
      if (exp < nowSec) this.used.delete(n);
    }
  }
}

export const processLocalOAuthNonceStore = new MemoryOAuthNonceStore();

/**
 * Persist a consumed OAuth nonce. Prefer DB primary-key insert for multi-instance replay protection.
 * Returns "ok" | "replay" | "error".
 */
export type ConsumeNonceResult = "ok" | "replay" | "error";

export async function consumeOAuthNonceViaInsert(
  insert: (row: {
    nonce: string;
    influencer_id: string;
    expires_at: string;
  }) => Promise<{ error: { code?: string; message?: string } | null }>
): Promise<(payload: OAuthStatePayload) => Promise<ConsumeNonceResult>> {
  return async (payload) => {
    const { error } = await insert({
      nonce: payload.nonce,
      influencer_id: payload.influencerId,
      expires_at: new Date(payload.exp * 1000).toISOString(),
    });
    if (!error) return "ok";
    // Postgres unique_violation
    if (error.code === "23505") return "replay";
    return "error";
  };
}
