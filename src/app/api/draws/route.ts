import { NextResponse } from 'next/server';
import { getAllDrawsFromDB } from '@/lib/db';

export async function GET() {
  try {
    const results = getAllDrawsFromDB();
    // Chronological order (oldest first) — consumers reverse when they need newest-first display
    return NextResponse.json({ success: true, results: results || [] });
  } catch (error: any) {
    console.error("Draws API error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

