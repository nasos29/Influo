import { createSign } from "node:crypto";

const ANALYTICS_READONLY_SCOPE = "https://www.googleapis.com/auth/analytics.readonly";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";

/** Base64url without padding (JWT segment encoding). */
export function base64UrlEncode(input: string | Buffer): string {
  const buf = typeof input === "string" ? Buffer.from(input, "utf8") : input;
  return buf
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

export function buildServiceAccountJwt(
  clientEmail: string,
  privateKeyPem: string,
  nowSec = Math.floor(Date.now() / 1000)
): string {
  const header = base64UrlEncode(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const payload = base64UrlEncode(
    JSON.stringify({
      iss: clientEmail,
      scope: ANALYTICS_READONLY_SCOPE,
      aud: GOOGLE_TOKEN_URL,
      iat: nowSec,
      exp: nowSec + 3600,
    })
  );
  const unsigned = `${header}.${payload}`;
  const signature = createSign("RSA-SHA256").update(unsigned).sign(privateKeyPem);
  return `${unsigned}.${base64UrlEncode(signature)}`;
}