import { NextResponse } from 'next/server';
import * as cheerio from 'cheerio';
import { saveDrawsToDB, getAllDrawsFromDB } from '@/lib/db';

async function scrapePage(url: string) {
  const res = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
    },
    cache: 'no-store'
  });

  if (!res.ok) return { results: [], prevUrl: null };

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

  // Find previous link
  let prevUrl = null;
  $('a').each((i, el) => {
    if ($(el).text().trim() === '<') {
      const href = $(el).attr('href');
      if (href) {
        prevUrl = href.startsWith('http') ? href : `https://www.secretsdujeu.com${href}`;
      }
    }
  });

  return { results: scrapedResults, prevUrl };
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const deep = searchParams.get('deep') === 'true';
    
    let currentUrl = "https://www.secretsdujeu.com/crescendo/resultat";
    const visited = new Set<string>();
    let allScraped: any[] = [];
    
    // We limit the number of pages to avoid timeouts (e.g. 50 pages)
    const maxPages = deep ? 50 : 1;
    let pageCount = 0;

    while (currentUrl && pageCount < maxPages) {
      const { results, prevUrl } = await scrapePage(currentUrl);
      if (results.length > 0) {
        allScraped = [...allScraped, ...results];
        saveDrawsToDB(results.reverse());
      }
      
      visited.add(currentUrl);
      if (prevUrl && !visited.has(prevUrl)) {
        currentUrl = prevUrl;
        pageCount++;
      } else {
        currentUrl = "";
      }
    }

    const results = getAllDrawsFromDB();
    return NextResponse.json({ success: true, results, pagesScraped: pageCount + 1 });

  } catch (error: any) {
    console.error("Scraping route crash:", error);
    return NextResponse.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
}

