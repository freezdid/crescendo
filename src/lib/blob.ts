import { put, list } from '@vercel/blob';

const DEFAULT_BLOB_PATH = 'crescendo_history.json';

export async function saveToBlob(data: any, pathname: string = DEFAULT_BLOB_PATH) {
  try {
    const { url } = await put(pathname, JSON.stringify(data), {
      access: 'public',
      addRandomSuffix: false,
    });
    return url;
  } catch (e) {
    console.error(`Vercel Blob Save Error [${pathname}]:`, e);
    return null;
  }
}

export async function loadFromBlob(pathname: string = DEFAULT_BLOB_PATH) {
  try {
    const { blobs } = await list();
    const blob = blobs.find(b => b.pathname === pathname);
    if (!blob) return null;

    const response = await fetch(blob.url);
    return await response.json();
  } catch (e) {
    console.error(`Vercel Blob Load Error [${pathname}]:`, e);
    return null;
  }
}
