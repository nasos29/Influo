/**
 * Resolve vm/vt.tiktok.com portfolio URLs locally (where TikTok redirects work)
 * and upsert official embed URLs into video_embed_cache for Vercel to serve.
 *
 * Run: node scripts/warm-tiktok-embed-cache.mjs
 */
import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

const envText = fs.readFileSync('.env.local', 'utf8');
for (const line of envText.split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && process.env[m[1]] == null) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
}

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

function tikTokIdFromUrl(url) {
  return url.match(/\/(?:video|photo)\/(\d+)/)?.[1] ?? null;
}

async function resolveTikTokVideoId(url) {
  const clean = url.split('?')[0].split('#')[0].trim();
  const direct = tikTokIdFromUrl(clean);
  if (direct) return direct;
  if (!/(vm|vt)\.tiktok\.com/i.test(clean)) return null;
  let current = clean;
  for (let hop = 0; hop < 5; hop++) {
    const res = await fetch(current, {
      method: 'GET',
      redirect: 'manual',
      signal: AbortSignal.timeout(8000),
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
    });
    try {
      await res.body?.cancel?.();
    } catch {
      /* ignore */
    }
    const loc = res.headers.get('location');
    if (!(res.status >= 300 && res.status < 400) || !loc) return tikTokIdFromUrl(current);
    current = new URL(loc, current).href;
    const id = tikTokIdFromUrl(current);
    if (id) return id;
  }
  return null;
}

const shortRe = /(vm|vt)\.tiktok\.com/i;
const urls = new Set();

for (let from = 0; ; from += 1000) {
  const { data, error } = await admin.from('influencers').select('id, videos').range(from, from + 999);
  if (error) throw error;
  const rows = data || [];
  for (const row of rows) {
    for (const v of row.videos || []) {
      if (typeof v === 'string' && shortRe.test(v)) urls.add(v.trim());
    }
  }
  if (rows.length < 1000) break;
}

console.log(`Found ${urls.size} TikTok short portfolio URLs`);
let ok = 0;
let fail = 0;
const expiresAt = new Date();
expiresAt.setDate(expiresAt.getDate() + 90);

for (const original of urls) {
  process.stdout.write(`${original} ... `);
  try {
    const id = await resolveTikTokVideoId(original);
    if (!id) {
      console.log('FAIL no id');
      fail += 1;
      continue;
    }
    const embedUrl = `https://www.tiktok.com/embed/v2/${id}`;
    const { error } = await admin.from('video_embed_cache').upsert(
      {
        original_url: original,
        embed_url: embedUrl,
        provider: 'tiktok',
        cached_at: new Date().toISOString(),
        expires_at: expiresAt.toISOString(),
      },
      { onConflict: 'original_url' }
    );
    if (error) throw error;
    console.log(`OK ${id}`);
    ok += 1;
  } catch (e) {
    console.log(`FAIL ${e instanceof Error ? e.message : e}`);
    fail += 1;
  }
}

console.log(`DONE ok=${ok} fail=${fail} total=${urls.size}`);
