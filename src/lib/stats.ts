import { ProcessedDraw } from './model';

export function calculateFrequencies(data: ProcessedDraw[]) {
  const counts: Record<number, number> = {};
  const letterCounts: Record<number, number> = {};

  data.forEach(draw => {
    [draw.num0, draw.num1, draw.num2, draw.num3, draw.num4, draw.num5, draw.num6, draw.num7, draw.num8, draw.num9].forEach(n => {
      counts[n] = (counts[n] || 0) + 1;
    });
    letterCounts[draw.letterNum] = (letterCounts[draw.letterNum] || 0) + 1;
  });

  return {
    topNums: Object.entries(counts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([n]) => parseInt(n)),
    topLetters: Object.entries(letterCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3)
      .map(([n]) => parseInt(n))
  };
}

export function analyzeTypicality(numbers: number[]) {
  const sum = numbers.slice(0, 10).reduce((a, b) => a + b, 0);
  const evens = numbers.slice(0, 10).filter(n => n % 2 === 0).length;
  const odds = 10 - evens;
  
  // Typical Crescendo sum (10 nums from 1-25) is around 130
  const sumStatus = sum >= 100 && sum <= 160 ? 'Optimal' : 'Atypique';
  // Typical balance for 10 numbers is 4-6 or 5-5 or 6-4
  const balanceStatus = (evens >= 4 && evens <= 6) ? 'Équilibré' : 'Déséquilibré';

  return { sum, sumStatus, balanceStatus, evens, odds };
}

