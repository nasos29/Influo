/**
 * Object-store list/delete for creator media.
 * Database rows stay in Supabase; only the file backend can switch to R2
 * via MEDIA_STORAGE_BACKEND. No R2 resources are provisioned here.
 */
import { createHash, createHmac } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { CREATOR_VIDEOS_BUCKET } from "@/lib/creatorMedia";
import { mediaBucket, mediaStorageBackend } from "@/lib/mediaStorage";

const PAGE = 100;

export type MediaObjectStore = {
  listAllUnderPrefix: (prefix: string) => Promise<string[]>;
  remove: (paths: string[]) => Promise<void>;
};

function tidyPrefix(prefix: string): string {
  return prefix.replace(/^\/+|\/+$/g, "");
}

async function listSupabase(supabase: SupabaseClient, prefix: string): Promise<string[]> {
  const paths: string[] = [];
  const prefixes = [tidyPrefix(prefix)];
  const seen = new Set<string>();

  while (prefixes.length) {
    const current = prefixes.pop()!;
    if (seen.has(current)) continue;
    seen.add(current);
    let offset = 0;
    for (;;) {
      const { data, error } = await supabase.storage
        .from(CREATOR_VIDEOS_BUCKET)
        .list(current, { limit: PAGE, offset });
      if (error) throw new Error(error.message);
      if (!data?.length) break;
      for (const entry of data) {
        const full = current ? `${current}/${entry.name}` : entry.name;
        const isFile = Boolean(entry.id) || Boolean(entry.metadata);
        if (isFile) paths.push(full);
        else prefixes.push(full);
      }
      if (data.length < PAGE) break;
      offset += PAGE;
    }
  }
  return paths;
}

async function removeSupabase(supabase: SupabaseClient, paths: string[]): Promise<void> {
  if (!paths.length) return;
  for (let i = 0; i < paths.length; i += PAGE) {
    const chunk = paths.slice(i, i + PAGE);
    const { error } = await supabase.storage.from(CREATOR_VIDEOS_BUCKET).remove(chunk);
    if (error) throw new Error(error.message);
  }
}

function r2Config() {
  const accountId = (process.env.R2_ACCOUNT_ID || "").trim();
  const accessKey = (process.env.R2_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY_ID || "").trim();
  const secretKey = (process.env.R2_SECRET_ACCESS_KEY || process.env.AWS_SECRET_ACCESS_KEY || "").trim();
  const bucket = mediaBucket();
  const endpoint = (
    process.env.R2_ENDPOINT || (accountId ? `https://${accountId}.r2.cloudflarestorage.com` : "")
  ).replace(/\/+$/, "");
  if (!accessKey || !secretKey || !endpoint || !bucket) {
    throw new Error(
      "MEDIA_STORAGE_BACKEND=r2 needs R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET, and R2_ACCOUNT_ID or R2_ENDPOINT"
    );
  }
  return { accessKey, secretKey, bucket, endpoint, region: "auto" };
}

function sha256Hex(data: string | Buffer): string {
  return createHash("sha256").update(data).digest("hex");
}

function hmac(key: Buffer | string, data: string): Buffer {
  return createHmac("sha256", key).update(data).digest();
}

async function r2Request(method: string, pathAndQuery: string, body?: Buffer, extra?: Record<string, string>): Promise<Buffer> {
  const cfg = r2Config();
  const url = new URL(`${cfg.endpoint}/${cfg.bucket}${pathAndQuery}`);
  const payload = body || Buffer.alloc(0);
  const amzDate = new Date().toISOString().replace(/[:-]|\.\d{3}/g, "").slice(0, 15) + "Z";
  const dateStamp = amzDate.slice(0, 8);
  const payloadHash = sha256Hex(payload);
  const headers: Record<string, string> = {
    host: url.host,
    "x-amz-date": amzDate,
    "x-amz-content-sha256": payloadHash,
    ...(extra || {}),
  };
  if (payload.length && !headers["content-type"]) headers["content-type"] = "application/octet-stream";
  const signedNames = Object.keys(headers)
    .map((k) => k.toLowerCase())
    .sort();
  const map = new Map(Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v]));
  const canonicalHeaders = signedNames.map((n) => `${n}:${map.get(n)}\n`).join("");
  const signedHeaders = signedNames.join(";");
  const canonicalQuery = [...url.searchParams.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join("&");
  const canonical = [
    method,
    url.pathname,
    canonicalQuery,
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join("\n");
  const scope = `${dateStamp}/${cfg.region}/s3/aws4_request`;
  const stringToSign = `AWS4-HMAC-SHA256\n${amzDate}\n${scope}\n${sha256Hex(canonical)}`;
  const kSigning = hmac(hmac(hmac(hmac(`AWS4${cfg.secretKey}`, dateStamp), cfg.region), "s3"), "aws4_request");
  const signature = createHmac("sha256", kSigning).update(stringToSign).digest("hex");
  headers.Authorization = `AWS4-HMAC-SHA256 Credential=${cfg.accessKey}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;
  const res = await fetch(url, { method, headers, body: payload.length ? new Uint8Array(payload) : undefined });
  const buf = Buffer.from(await res.arrayBuffer());
  if (!res.ok) {
    throw new Error(`R2 ${method} ${url.pathname} -> ${res.status}: ${buf.toString("utf8").slice(0, 300)}`);
  }
  return buf;
}

async function listR2(prefix: string): Promise<string[]> {
  const paths: string[] = [];
  let token: string | null = null;
  const pref = tidyPrefix(prefix);
  do {
    const params = new URLSearchParams({ "list-type": "2", "max-keys": "1000" });
    if (pref) params.set("prefix", `${pref}/`);
    if (token) params.set("continuation-token", token);
    const xml = (await r2Request("GET", `?${params.toString()}`)).toString("utf8");
    paths.push(...[...xml.matchAll(/<Key>([^<]+)<\/Key>/g)].map((m) => m[1]));
    const isTruncated = /<IsTruncated>true<\/IsTruncated>/i.test(xml);
    const next = xml.match(/<NextContinuationToken>([^<]+)<\/NextContinuationToken>/);
    token = isTruncated && next ? next[1] : null;
  } while (token);
  return paths;
}

async function removeR2(paths: string[]): Promise<void> {
  if (!paths.length) return;
  for (let i = 0; i < paths.length; i += PAGE) {
    const chunk = paths.slice(i, i + PAGE);
    const xml = `<?xml version="1.0" encoding="UTF-8"?><Delete>${chunk
      .map((key) => `<Object><Key>${key.replace(/&/g, "&amp;").replace(/</g, "&lt;")}</Key></Object>`)
      .join("")}</Delete>`;
    const body = Buffer.from(xml);
    await r2Request("POST", "?delete", body, {
      "content-type": "application/xml",
      "content-md5": createHash("md5").update(body).digest("base64"),
    });
  }
}

export function createMediaObjectStore(supabase: SupabaseClient): MediaObjectStore {
  if (mediaStorageBackend() === "r2") {
    return {
      listAllUnderPrefix: (prefix) => listR2(prefix),
      remove: (paths) => removeR2(paths),
    };
  }
  return {
    listAllUnderPrefix: (prefix) => listSupabase(supabase, prefix),
    remove: (paths) => removeSupabase(supabase, paths),
  };
}

export async function removePrefix(store: MediaObjectStore, prefix: string): Promise<number> {
  const paths = await store.listAllUnderPrefix(prefix);
  if (!paths.length) return 0;
  await store.remove(paths);
  return paths.length;
}
