import { NextResponse } from 'next/server';
import * as cheerio from 'cheerio';
import { saveDrawsToDB, getAllDrawsFromDB } from '@/lib/db';

export async function GET() {
  try {
    const res = await fetch("https://www.secretsdujeu.com/crescendo/resultat", {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
      },
      cache: 'no-store'
    });

    if (!res.ok) {
      throw new Error(`Failed to fetch: ${res.status}`);
    }

    const html = await res.text();
    const $ = cheerio.load(html);

    const scrapedResults: any[] = [];
    const text = $('body').text();
    const regex = /La combinaison gagnante du tirage du Crescendo du (.+?) à (\d+h) est composée des numéros ([\d-]+) et de la lettre ([A-Z])/g;
    
    let match;
    while ((match = regex.exec(text)) !== null) {
      const numbers = match[3].split('-').map(Number);
      if (numbers.length === 10) {
        scrapedResults.push({
          date: match[1].replace(/\u00a0/g, ' '),
          time: match[2],
          num0: numbers[0],
          num1: numbers[1],
          num2: numbers[2],
          num3: numbers[3],
          num4: numbers[4],
          num5: numbers[5],
          num6: numbers[6],
          num7: numbers[7],
          num8: numbers[8],
          num9: numbers[9],
          letter: match[4]
        });
      }
    }

    // Save to SQLite
    try {
      if (scrapedResults.length > 0) {
        saveDrawsToDB(scrapedResults.reverse()); // Reverse to save oldest to newest
      }
    } catch (dbError) {
      console.error("Database save error:", dbError);
    }

    // Get full history from DB
    let results = [];
    try {
      results = getAllDrawsFromDB();
      if (results.length === 0 && scrapedResults.length > 0) {
        results = scrapedResults.reverse(); // put back in normal order for return
      }
    } catch (dbError) {
      console.error("Database read error:", dbError);
      results = scrapedResults;
    }

    return NextResponse.json({ success: true, results });

  } catch (error: any) {
    console.error("Scraping route crash:", error);
    return NextResponse.json({ 
      success: false, 
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined 
    }, { status: 500 });
  }
}

