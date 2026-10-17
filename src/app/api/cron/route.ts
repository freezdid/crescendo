import { NextResponse } from 'next/server';
import { saveToBlob, loadFromBlob } from '@/lib/blob';
import { fetchWithTimeout } from '@/lib/net';

// Simplified automated update for the Cron trigger
async function fetchLatestDraws(origin: string) {
  const baseUrl = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : origin;
  const res = await fetchWithTimeout(`${baseUrl}/api/crescendo`, { cache: 'no-store' }, 45000);
  return await res.json();
}

export async function GET(req: Request) {
  try {
    // Optional protection: when CRON_SECRET is configured, Vercel automatically sends it
    // as `Authorization: Bearer <CRON_SECRET>` for cron invocations.
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret && req.headers.get('authorization') !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    console.log("Démarrage du Cron Crescendo Quantum...");
    
    // 1. Fetch latest draws via API (self-referencing the incoming request origin
    //    so it works on any deployment URL as well as localhost with a custom port)
    const scrapeRes = await fetchLatestDraws(new URL(req.url).origin);
    if (!scrapeRes.success) throw new Error("Échec de la récupération des tirages");
    
    // 2. Load current Cloud Data
    const currentCloudData = await loadFromBlob('crescendo_history.json') || [];
    
    // 3. Update if new
    if (scrapeRes.results && scrapeRes.results.length > currentCloudData.length) {
      console.log(`Nouveaux tirages détectés (${scrapeRes.results.length} vs ${currentCloudData.length}). Mise à jour Cloud...`);
      await saveToBlob(scrapeRes.results, 'crescendo_history.json');
      
      return NextResponse.json({ 
        success: true, 
        message: "Synchronisation Cloud réussie avec de nouveaux tirages",
        total: scrapeRes.results.length 
      });
    }

    return NextResponse.json({ 
      success: true, 
      message: "Base de données Cloud déjà à jour",
      total: currentCloudData.length 
    });
  } catch (error: any) {
    console.error("Cron Error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
