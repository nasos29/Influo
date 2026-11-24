import assert from "node:assert/strict";
import { generateKeyPairSync } from "node:crypto";
import test from "node:test";
import { base64UrlEncode, buildServiceAccountJwt } from "../lib/ga4Jwt.ts";

test("base64UrlEncode avoids padding and url-safe alphabet", () => {
  const encoded = base64UrlEncode('{"alg":"RS256","typ":"JWT"}');
  assert.ok(!encoded.includes("="));
  assert.ok(!encoded.includes("+"));
  assert.ok(!encoded.includes("/"));
  assert.match(encoded, /^[A-Za-z0-9_-]+$/);
});

test("buildServiceAccountJwt has three RS256 segments", () => {
  const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const pem = privateKey.export({ type: "pkcs8", format: "pem" }) as string;
  const jwt = buildServiceAccountJwt("svc@test.iam.gserviceaccount.com", pem, 1_700_000_000);
  const parts = jwt.split(".");
  assert.equal(parts.length, 3);
  const header = JSON.parse(Buffer.from(parts[0].replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8"));
  const payload = JSON.parse(Buffer.from(parts[1].replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8"));
  assert.equal(header.alg, "RS256");
  assert.equal(header.typ, "JWT");
  assert.equal(payload.iss, "svc@test.iam.gserviceaccount.com");
  assert.equal(payload.aud, "https://oauth2.googleapis.com/token");
  assert.equal(payload.scope, "https://www.googleapis.com/auth/analytics.readonly");
  assert.equal(payload.iat, 1_700_000_000);
  assert.equal(payload.exp, 1_700_000_000 + 3600);
});