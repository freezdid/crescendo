import { NextResponse } from 'next/server';
import { saveToBlob, loadFromBlob } from '@/lib/blob';

// Simplified automated update for the Cron trigger
async function fetchLatestDraws() {
  const baseUrl = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000';
  const res = await fetch(`${baseUrl}/api/crescendo`, { cache: 'no-store' });
  return await res.json();
}

export async function GET(req: Request) {
  try {
    console.log("Démarrage du Cron Crescendo Quantum...");
    
    // 1. Fetch latest draws via API
    const scrapeRes = await fetchLatestDraws();
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
