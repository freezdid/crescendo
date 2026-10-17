import { NextResponse } from 'next/server';
import { saveToBlob, loadFromBlob } from '@/lib/blob';

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
    const { data, type } = await req.json();
    let path = 'crescendo_history.json';
    if (type === 'predictions') path = 'crescendo_predictions.json';
    if (type === 'model') path = 'crescendo_model_meta.json';
    
    const url = await saveToBlob(data, path);
    return NextResponse.json({ success: true, url });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
