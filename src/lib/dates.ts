const MONTHS: Record<string, number> = {
  "janvier": 0, "février": 1, "mars": 2, "avril": 3, "mai": 4, "juin": 5,
  "juillet": 6, "août": 7, "septembre": 8, "octobre": 9, "novembre": 10, "décembre": 11
};

export function parseDrawDate(d: { date: string; time: string }): number {
  try {
    const parts = d.date.split(' ');
    // e.g. "samedi 25 avril 2026" -> ["samedi", "25", "avril", "2026"] ("1er" is handled by parseInt)
    const day = parseInt(parts[1], 10);
    const month = MONTHS[parts[2]?.toLowerCase()] ?? 0;
    const year = parseInt(parts[3], 10);
    const hours = parseInt(d.time.replace('h', ''), 10) || 0;
    return new Date(year, month, day, hours).getTime();
  } catch {
    return Date.now();
  }
}
