import { timingSafeEqual } from 'crypto';

/**
 * Write endpoints are protected by an optional admin key.
 * - When SYNC_SECRET is not configured, writes stay open (backward compatible,
 *   e.g. local development or a private deployment without a key).
 * - When configured, every write must send it as the `x-sync-key` header.
 */
export function isWriteAuthorized(req: Request): boolean {
  const secret = process.env.SYNC_SECRET;
  if (!secret) return true;

  const provided = req.headers.get('x-sync-key') || '';
  const a = Buffer.from(provided);
  const b = Buffer.from(secret);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export function unauthorizedResponse() {
  return Response.json(
    { success: false, error: 'Clé admin manquante ou invalide (en-tête x-sync-key).' },
    { status: 401 }
  );
}
