import { NextResponse } from 'next/server';
import { saveToBlob, loadFromBlob } from '@/lib/blob';
import { isWriteAuthorized, unauthorizedResponse } from '@/lib/auth';
import { MAX_BODY_BYTES, resolveSyncKind, validateSyncPayload } from '@/lib/validate';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const type = searchParams.get('type') || 'draws';
    
    let path = 'crescendo_history.json';
    let fallbackPath = 'loto_history.json';
    if (type === 'predictions') {
      path = 'crescendo_predictions.json';
      fallbackPath = 'predictions_history.json';
    } else if (type === 'model') {
      path = 'crescendo_model_meta.json';
      fallbackPath = 'loto_model_meta.json';
    }
    
    let data = await loadFromBlob(path);
    if (!data && fallbackPath) {
      data = await loadFromBlob(fallbackPath);
    }

    return NextResponse.json({ success: true, data: data || [] });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    // Writes require the admin key once SYNC_SECRET is configured
    if (!isWriteAuthorized(req)) return unauthorizedResponse();

    const contentLength = Number(req.headers.get('content-length') || 0);
    if (contentLength > MAX_BODY_BYTES) {
      return NextResponse.json({ success: false, error: 'Charge utile trop volumineuse.' }, { status: 413 });
    }

    let body: { data?: unknown; type?: unknown };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ success: false, error: 'Corps JSON invalide.' }, { status: 400 });
    }

    const kind = resolveSyncKind(body?.type);
    const validationError = validateSyncPayload(kind, body?.data);
    if (validationError) {
      return NextResponse.json({ success: false, error: validationError }, { status: 400 });
    }

    let path = 'crescendo_history.json';
    if (kind === 'predictions') path = 'crescendo_predictions.json';
    if (kind === 'model') path = 'crescendo_model_meta.json';

    const url = await saveToBlob(body.data, path);
    if (!url) {
      return NextResponse.json({ success: false, error: 'Stockage cloud indisponible.' }, { status: 502 });
    }
    return NextResponse.json({ success: true, url });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
