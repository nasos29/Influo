/** In-memory fixed-window rate limit (per process). Fine for Fluid/serverless best-effort. */

type Bucket = { count: number; resetAt: number };

const stores = new Map<string, Map<string, Bucket>>();

export function clientIpFromRequest(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return req.headers.get("x-real-ip") || "unknown";
}

export function allowRateLimit(
  namespace: string,
  key: string,
  max: number,
  windowMs: number
): boolean {
  let hits = stores.get(namespace);
  if (!hits) {
    hits = new Map();
    stores.set(namespace, hits);
  }
  const now = Date.now();
  if (hits.size > 2000) {
    for (const [k, row] of hits) {
      if (now >= row.resetAt) hits.delete(k);
    }
  }
  const row = hits.get(key);
  if (!row || now >= row.resetAt) {
    hits.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (row.count >= max) return false;
  row.count += 1;
  return true;
}
