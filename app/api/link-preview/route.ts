import { NextResponse } from "next/server";
import { lookup } from "node:dns/promises";
import { userFromBearer } from "@/lib/apiAuth";
import { isPrivateHost, parseMeta } from "@/lib/linkify";

export const dynamic = "force-dynamic";
const cache = new Map<string, { at: number; data: unknown }>();
const TTL = 24 * 3600 * 1000;

export async function GET(request: Request) {
  if (!(await userFromBearer(request))) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const raw = new URL(request.url).searchParams.get("url") || "";
  let target: URL;
  try {
    target = new URL(raw);
  } catch {
    return NextResponse.json({ error: "bad url" }, { status: 400 });
  }
  if (!/^https?:$/.test(target.protocol) || isPrivateHost(target.hostname)) return NextResponse.json({ error: "blocked" }, { status: 400 });
  const key = target.toString();
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL) return NextResponse.json(hit.data, { headers: { "Cache-Control": "private, max-age=86400" } });
  try {
    const { address } = await lookup(target.hostname);
    if (isPrivateHost(address)) return NextResponse.json({ error: "blocked" }, { status: 400 });
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 4000);
    const res = await fetch(key, { signal: ctrl.signal, redirect: "follow", headers: { "User-Agent": "Mozilla/5.0 (compatible; InfluoLinkPreview/1.0)", Accept: "text/html" } });
    if (isPrivateHost(new URL(res.url).hostname)) throw new Error("blocked");
    let html = "";
    if (res.ok && (res.headers.get("content-type") || "").includes("text/html") && res.body) {
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      while (html.length < 200_000) {
        const { done, value } = await reader.read();
        if (done) break;
        html += dec.decode(value, { stream: true });
        if (/<\/head>/i.test(html)) break;
      }
      void reader.cancel().catch(() => {});
    }
    clearTimeout(timer);
    const meta = parseMeta(html);
    if (meta.image) {
      try {
        meta.image = new URL(meta.image, res.url).toString();
        if (!meta.image.startsWith("https://")) meta.image = undefined;
      } catch {
        meta.image = undefined;
      }
    }
    const data = { url: key, host: target.hostname.replace(/^www\./, ""), ...meta };
    if (cache.size > 500) cache.clear();
    cache.set(key, { at: Date.now(), data });
    return NextResponse.json(data, { headers: { "Cache-Control": "private, max-age=86400" } });
  } catch {
    return NextResponse.json({ url: key, host: target.hostname.replace(/^www\./, "") });
  }
}
