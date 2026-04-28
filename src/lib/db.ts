import Database from 'better-sqlite3';
import path from 'path';
import { LotoDraw } from './model';

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

export function getAllDrawsFromDB(): LotoDraw[] {
  return db.prepare('SELECT * FROM draws ORDER BY id ASC').all() as LotoDraw[];
}

export function getLastDrawDate(): { date: string, time: string } | null {
  return db.prepare('SELECT date, time FROM draws ORDER BY id DESC LIMIT 1').get() as any || null;
}

