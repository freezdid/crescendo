/**
 * Minimal in-memory sliding-window rate limiter.
 * Per serverless instance (not shared across instances), which is enough to
 * stop casual abuse of the expensive scrape endpoint.
 */
const buckets = new Map<string, number[]>();

export function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number
): { allowed: boolean; retryAfterSec: number } {
  const now = Date.now();
  const recent = (buckets.get(key) || []).filter((t) => now - t < windowMs);

  if (recent.length >= limit) {
    const retryAfterSec = Math.max(1, Math.ceil((windowMs - (now - recent[0])) / 1000));
    buckets.set(key, recent);
    return { allowed: false, retryAfterSec };
  }

  recent.push(now);
  buckets.set(key, recent);

  // Opportunistic cleanup so the map never grows unbounded
  if (buckets.size > 500) {
    for (const [k, v] of buckets) {
      const alive = v.filter((t) => now - t < windowMs);
      if (alive.length === 0) buckets.delete(k);
      else buckets.set(k, alive);
    }
  }

  return { allowed: true, retryAfterSec: 0 };
}

export function clientIp(req: Request): string {
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  return req.headers.get('x-real-ip') || 'local';
}

export function tooManyRequestsResponse(retryAfterSec: number) {
  return Response.json(
    { success: false, error: 'Trop de requêtes. Réessayez dans quelques instants.' },
    { status: 429, headers: { 'Retry-After': String(retryAfterSec) } }
  );
}
