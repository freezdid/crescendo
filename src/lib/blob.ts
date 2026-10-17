import { put, get } from '@vercel/blob';

const DEFAULT_BLOB_PATH = 'crescendo_history.json';

/**
 * This project's Blob store has private access:
 * - writes must declare `access: 'private'` (public puts are rejected)
 * - repeated writes to the same pathname need `allowOverwrite: true`
 * - reads must go through the authenticated `get()` call (raw blob URLs return 403)
 */
export async function saveToBlob(data: unknown, pathname: string = DEFAULT_BLOB_PATH) {
  try {
    const { url } = await put(pathname, JSON.stringify(data), {
      access: 'private',
      addRandomSuffix: false,
      allowOverwrite: true,
    });
    return url;
  } catch (e) {
    console.error(`Vercel Blob Save Error [${pathname}]:`, e);
    return null;
  }
}

export async function loadFromBlob(pathname: string = DEFAULT_BLOB_PATH) {
  try {
    const result = await get(pathname, { access: 'private' });
    if (!result || result.statusCode !== 200 || !result.stream) return null;
    return await new Response(result.stream).json();
  } catch (e) {
    console.error(`Vercel Blob Load Error [${pathname}]:`, e);
    return null;
  }
}
