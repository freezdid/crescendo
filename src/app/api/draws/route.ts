import { NextResponse } from 'next/server';
import { getAllDrawsFromDB } from '@/lib/db';

export async function GET() {
  try {
    const results = getAllDrawsFromDB();
    return NextResponse.json({ success: true, results: (results || []).reverse() });
  } catch (error: any) {
    console.error("Draws API error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

