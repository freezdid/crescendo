import { parseDrawDate } from './dates';

export interface LotoDraw {
  date: string;
  time: string;
  num0: number;
  num1: number;
  num2: number;
  num3: number;
  num4: number;
  num5: number;
  num6: number;
  num7: number;
  num8: number;
  num9: number;
  letter: string;
}

export interface ProcessedDraw extends LotoDraw {
  fullDate: number;
  letterNum: number;
  freq_num0: number;
  freq_num1: number;
  freq_num2: number;
  freq_num3: number;
  freq_num4: number;
  freq_num5: number;
  freq_num6: number;
  freq_num7: number;
  freq_num8: number;
  freq_num9: number;
  freq_letter: number;
  pair: number;
  impair: number;
  is_under_12: number;
  last_seen_num0: number;
  last_seen_num1: number;
  last_seen_num2: number;
  last_seen_num3: number;
  last_seen_num4: number;
  last_seen_num5: number;
  last_seen_num6: number;
  last_seen_num7: number;
  last_seen_num8: number;
  last_seen_num9: number;
  last_seen_letter: number;
}

export const TRAINING_CONFIG = {
  fast: {
    epochs: 25,
    batchSize: 128,
    label: 'Turbo (Rapide)',
    desc: 'Idéal pour le quotidien'
  },
  precise: {
    epochs: 50,
    batchSize: 64,
    label: 'Elite (Précis)',
    desc: 'Analyse approfondie'
  }
};

const pairs = new Set([2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24]);
const impairs = new Set([1, 3, 5, 7, 9, 11, 13, 15, 17, 19, 21, 23, 25]);

function countPairs(nums: number[]) { return nums.filter(n => pairs.has(n)).length; }
function countImpairs(nums: number[]) { return nums.filter(n => impairs.has(n)).length; }
function countUnder(nums: number[], val: number) { return nums.filter(n => n <= val).length; }

export function processData(draws: LotoDraw[]): ProcessedDraw[] {
  // Normalize to chronological order (index 0 = oldest, last = newest) regardless of input order.
  // The stats engine, backtest and neural dataset all assume this convention.
  const ordered = [...draws].sort((a, b) => parseDrawDate(a) - parseDrawDate(b));

  const freqMap: Record<string, number> = {};
  const lastSeenMap: Record<number, number> = {};
  const lastSeenLetterMap: Record<number, number> = {};

  return ordered.map((d, i) => {
    const nums = [d.num0, d.num1, d.num2, d.num3, d.num4, d.num5, d.num6, d.num7, d.num8, d.num9];
    const letterMap: Record<string, number> = { 'S': 1, 'A': 2, 'M': 3, 'E': 4, 'D': 5, 'I': 6 };
    const letterNum = d.letter ? (letterMap[d.letter.toUpperCase()] || 1) : 1;

    const updateFreq = (key: string, val: number) => {
      const compositeKey = `${key}_${val}`;
      freqMap[compositeKey] = (freqMap[compositeKey] || 0) + 1;
      return freqMap[compositeKey];
    };

    const lastSeen = nums.map(n => {
      const dist = lastSeenMap[n] !== undefined ? i - lastSeenMap[n] : i;
      lastSeenMap[n] = i;
      return dist;
    });
    const distLetter = lastSeenLetterMap[letterNum] !== undefined ? i - lastSeenLetterMap[letterNum] : i;
    lastSeenLetterMap[letterNum] = i;

    return {
      ...d,
      fullDate: parseDrawDate(d),
      letterNum,
      freq_num0: updateFreq('num0', d.num0),
      freq_num1: updateFreq('num1', d.num1),
      freq_num2: updateFreq('num2', d.num2),
      freq_num3: updateFreq('num3', d.num3),
      freq_num4: updateFreq('num4', d.num4),
      freq_num5: updateFreq('num5', d.num5),
      freq_num6: updateFreq('num6', d.num6),
      freq_num7: updateFreq('num7', d.num7),
      freq_num8: updateFreq('num8', d.num8),
      freq_num9: updateFreq('num9', d.num9),
      freq_letter: updateFreq('letter', letterNum),
      pair: countPairs(nums),
      impair: countImpairs(nums),
      is_under_12: countUnder(nums, 12),
      last_seen_num0: lastSeen[0],
      last_seen_num1: lastSeen[1],
      last_seen_num2: lastSeen[2],
      last_seen_num3: lastSeen[3],
      last_seen_num4: lastSeen[4],
      last_seen_num5: lastSeen[5],
      last_seen_num6: lastSeen[6],
      last_seen_num7: lastSeen[7],
      last_seen_num8: lastSeen[8],
      last_seen_num9: lastSeen[9],
      last_seen_letter: distLetter
    };
  });
}

export class StandardScaler {
  means: number[] = [];
  stds: number[] = [];

  fit(data: number[][]) {
    if (!data || data.length === 0 || !data[0]) return;
    const rows = data.length;
    const cols = data[0].length;
    for (let j = 0; j < cols; j++) {
      let sum = 0;
      for (let i = 0; i < rows; i++) sum += data[i][j];
      const mean = sum / rows;
      this.means.push(mean);

      let sqSum = 0;
      for (let i = 0; i < rows; i++) sqSum += Math.pow(data[i][j] - mean, 2);
      const std = Math.sqrt(sqSum / rows) || 1;
      this.stds.push(std);
    }
  }

  transform(data: number[][]): number[][] {
    return data.map(row =>
      row.map((val, j) => (val - this.means[j]) / this.stds[j])
    );
  }

  inverseTransform(data: number[][]): number[][] {
    return data.map(row =>
      row.map((val, j) => (val * this.stds[j]) + this.means[j])
    );
  }
}

export function createDataset(processed: ProcessedDraw[], windowLength: number = 12) {
  const data = processed.map(d => [
    d.num0, d.num1, d.num2, d.num3, d.num4, d.num5, d.num6, d.num7, d.num8, d.num9, d.letterNum,
    d.freq_num0, d.freq_num1, d.freq_num2, d.freq_num3, d.freq_num4, d.freq_num5, d.freq_num6, d.freq_num7, d.freq_num8, d.freq_num9, d.freq_letter,
    d.pair, d.impair, d.is_under_12,
    d.last_seen_num0, d.last_seen_num1, d.last_seen_num2, d.last_seen_num3, d.last_seen_num4, d.last_seen_num5, d.last_seen_num6, d.last_seen_num7, d.last_seen_num8, d.last_seen_num9, d.last_seen_letter
  ]);

  const scaler = new StandardScaler();
  scaler.fit(data);
  const scaled = scaler.transform(data);

  const X: number[][][] = [];
  const Y: number[][] = [];

  for (let i = 0; i < scaled.length - windowLength; i++) {
    const xWindow = scaled.slice(i, i + windowLength);
    // Labels are the first 11 features of the NEXT draw
    const yTarget = scaled[i + windowLength].slice(0, 11);
    X.push(xWindow);
    Y.push(yTarget);
  }

  return { X, Y, scaler, lastTwelve: scaled.slice(scaled.length - windowLength) };
}
