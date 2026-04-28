import { NextResponse } from 'next/server';
import { saveToBlob, loadFromBlob } from '@/lib/blob';

// We'll use a simplified version of scraping for the Cron
async function scrapeFDJ() {
  const url = "https://www.loto-vision.com/resultats-loto.html";
  const response = await fetch(url);
  const html = await response.text();
  
  // Basic regex or simple parser for server-side
  // For now, let's assume we reuse the logic from our /api/loto if possible
  // But Next.js API routes can call each other via fetch
  const baseUrl = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000';
  const res = await fetch(`${baseUrl}/api/loto`);
  return await res.json();
}

export async function GET(req: Request) {
  // Security check for Cron (optional but recommended)
  // if (req.headers.get('Authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
  //   return new Response('Unauthorized', { status: 401 });
  // }

  try {
    console.log("Starting Cron Job...");
    
    // 1. Scrape
    const scrapeRes = await scrapeFDJ();
    if (!scrapeRes.success) throw new Error("Scraping failed");
    
    // 2. Load current Cloud Data
    const currentCloudData = await loadFromBlob('loto_history.json') || [];
    
    // 3. Update if new
    if (scrapeRes.results.length > currentCloudData.length) {
      console.log("New draws found! Updating cloud...");
      // In a real scenario, we'd process the data here.
      // For the cron, we'll just push the new results.
      await saveToBlob(scrapeRes.results, 'loto_history.json');
      
      // 4. Automatic Prediction (Placeholder for Server-side TFJS)
      // Since running full TFJS in a serverless function is complex/heavy,
      // we'll record that a sync is needed.
      // Real predictions will happen when the user next opens the app.
      
      return NextResponse.json({ success: true, message: "Cloud updated with new draws" });
    }

    return NextResponse.json({ success: true, message: "No new draws found" });
  } catch (error: any) {
    console.error("Cron Error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
