import { NextResponse } from 'next/server';
import { saveToBlob, loadFromBlob } from '@/lib/blob';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const type = searchParams.get('type') || 'draws';
    let path = 'loto_history.json';
    if (type === 'predictions') path = 'predictions_history.json';
    if (type === 'model') path = 'loto_model_meta.json';
    
    const data = await loadFromBlob(path);
    return NextResponse.json({ success: true, data: data || [] });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { data, type } = await req.json();
    let path = 'loto_history.json';
    if (type === 'predictions') path = 'predictions_history.json';
    if (type === 'model') path = 'loto_model_meta.json';
    
    const url = await saveToBlob(data, path);
    return NextResponse.json({ success: true, url });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
