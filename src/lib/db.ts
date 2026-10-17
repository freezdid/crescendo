import path from 'path';
import fs from 'fs';
import { LotoDraw } from './pipeline';
import { parseDrawDate } from './dates';

const isVercel = process.env.VERCEL === '1';
const dbPath = isVercel 
  ? path.join('/tmp', 'crescendo.db')
  : path.resolve(process.cwd(), 'crescendo.db');

console.log("DB Path:", dbPath);
let db: any;

try {
  // better-sqlite3 is a native dependency, it might fail to load in some environments
  const BetterSqlite3 = require('better-sqlite3');
  db = new BetterSqlite3(dbPath);
} catch (e) {
  console.error("Failed to initialize SQLite:", e);
  // Mock db object to avoid crashes and allow the app to run without persistence
  db = {
    exec: () => {},
    prepare: () => ({ 
      run: () => ({ changes: 0 }), 
      all: () => [], 
      get: () => null 
    }),
    transaction: (fn: any) => fn
  };
}

// Initialize table
db.exec(`
  CREATE TABLE IF NOT EXISTS draws (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT,
    time TEXT,
    num0 INTEGER,
    num1 INTEGER,
    num2 INTEGER,
    num3 INTEGER,
    num4 INTEGER,
    num5 INTEGER,
    num6 INTEGER,
    num7 INTEGER,
    num8 INTEGER,
    num9 INTEGER,
    letter TEXT,
    UNIQUE(date, time)
  )
`);

export function saveDrawsToDB(draws: LotoDraw[]) {
  const insert = db.prepare(`
    INSERT OR IGNORE INTO draws (date, time, num0, num1, num2, num3, num4, num5, num6, num7, num8, num9, letter)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertMany = db.transaction((items: LotoDraw[]) => {
    for (const item of items) {
      insert.run(
        item.date, item.time,
        item.num0, item.num1, item.num2, item.num3, item.num4,
        item.num5, item.num6, item.num7, item.num8, item.num9,
        item.letter
      );
    }
  });

  insertMany(draws);
}

// Seed the SQLite DB from the bundled snapshot when empty (fresh deployment)
try {
  const count = db.prepare('SELECT COUNT(*) as c FROM draws').get() as { c: number } | null;
  if (!count || count.c === 0) {
    const seedPath = path.resolve(process.cwd(), 'public', 'seed-draws.json');
    if (fs.existsSync(seedPath)) {
      const seed = JSON.parse(fs.readFileSync(seedPath, 'utf-8')) as LotoDraw[];
      if (Array.isArray(seed) && seed.length > 0) {
        const ordered = [...seed].sort((a, b) => parseDrawDate(a) - parseDrawDate(b));
        saveDrawsToDB(ordered);
        console.log(`Seeded SQLite with ${seed.length} historical draws from public/seed-draws.json`);
      }
    }
  }
} catch (e) {
  console.error("Seed error:", e);
}

export function getAllDrawsFromDB(): LotoDraw[] {
  // Row ids are not guaranteed to be chronological (scrapes insert week by week,
  // seeds may be ordered differently), so always sort by parsed date.
  const rows = db.prepare('SELECT * FROM draws ORDER BY id ASC').all() as LotoDraw[];
  return rows.sort((a, b) => parseDrawDate(a) - parseDrawDate(b));
}

export function getLastDrawDate(): { date: string, time: string } | null {
  const draws = getAllDrawsFromDB();
  if (draws.length === 0) return null;
  const last = draws[draws.length - 1];
  return { date: last.date, time: last.time };
}

