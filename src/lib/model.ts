import * as tf from '@tensorflow/tfjs';
import '@tensorflow/tfjs-backend-webgpu';

export async function initTensorFlow() {
  await tf.ready();
  if (tf.engine().backendName !== 'webgpu') {
    try {
      await tf.setBackend('webgpu');
      console.log('Backend WebGPU activé');
    } catch (e) {
      console.warn('WebGPU non supporté, repli sur WebGL');
      await tf.setBackend('webgl');
    }
  }
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

const pairs = new Set([2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24]);
const impairs = new Set([1, 3, 5, 7, 9, 11, 13, 15, 17, 19, 21, 23, 25]);

function countPairs(nums: number[]) { return nums.filter(n => pairs.has(n)).length; }
function countImpairs(nums: number[]) { return nums.filter(n => impairs.has(n)).length; }
function countUnder(nums: number[], val: number) { return nums.filter(n => n <= val).length; }

export function processData(draws: LotoDraw[]): ProcessedDraw[] {
  const reversed = [...draws].reverse();
  
  const freqMap: Record<string, number> = {};
  const lastSeenMap: Record<number, number> = {};
  const lastSeenLetterMap: Record<number, number> = {};

  return reversed.map((d, i) => {
    const nums = [d.num0, d.num1, d.num2, d.num3, d.num4, d.num5, d.num6, d.num7, d.num8, d.num9];
    const letterNum = d.letter ? d.letter.charCodeAt(0) - 64 : 1; // A=1
    
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

    const parseDate = () => {
      try {
        const parts = d.date.split(' ');
        // e.g. "samedi 25 avril 2026" -> ["samedi", "25", "avril", "2026"]
        const dayPart = parts[1];
        const monthPart = parts[2];
        const yearPart = parts[3];
        const months: any = { "janvier": 0, "février": 1, "mars": 2, "avril": 3, "mai": 4, "juin": 5, "juillet": 6, "août": 7, "septembre": 8, "octobre": 9, "novembre": 10, "décembre": 11 };
        
        let timeHours = parseInt(d.time.replace('h', ''), 10);
        return new Date(parseInt(yearPart), months[monthPart.toLowerCase()] || 0, parseInt(dayPart), timeHours).getTime();
      } catch(e) { return Date.now(); }
    };

    return {
      ...d,
      fullDate: parseDate(),
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

export function buildAdvancedModel(windowLength: number, numFeatures: number, numLabels: number) {
  const input = tf.input({ shape: [windowLength, numFeatures] });
  
  const lstm1 = tf.layers.bidirectional({
    layer: tf.layers.lstm({ 
      units: 128, 
      returnSequences: true, 
      kernelInitializer: 'glorotNormal',
      recurrentInitializer: 'glorotNormal' 
    }) as any,
    mergeMode: 'concat'
  }).apply(input) as tf.SymbolicTensor;
  
  const dropout1 = tf.layers.dropout({ rate: 0.2 }).apply(lstm1) as tf.SymbolicTensor;
  
  const lstm2 = tf.layers.bidirectional({
    layer: tf.layers.lstm({ 
      units: 64, 
      returnSequences: true, 
      kernelInitializer: 'glorotNormal',
      recurrentInitializer: 'glorotNormal'
    }) as any,
    mergeMode: 'concat'
  }).apply(dropout1) as tf.SymbolicTensor;

  const attentionWeights = tf.layers.dense({ 
    units: 1, 
    activation: 'tanh',
    kernelInitializer: 'glorotNormal'
  }).apply(lstm2) as tf.SymbolicTensor;
  
  const flattenedWeights = tf.layers.flatten().apply(attentionWeights) as tf.SymbolicTensor;
  const softWeights = tf.layers.softmax().apply(flattenedWeights) as tf.SymbolicTensor;
  const reshapedWeights = tf.layers.reshape({ targetShape: [windowLength, 1] }).apply(softWeights) as tf.SymbolicTensor;
  
  const weighted = tf.layers.multiply().apply([lstm2, reshapedWeights]) as tf.SymbolicTensor;
  const pooled = tf.layers.globalAveragePooling1d().apply(weighted) as tf.SymbolicTensor;

  const dense1 = tf.layers.dense({ units: 64, activation: 'relu', kernelInitializer: 'glorotNormal' }).apply(pooled) as tf.SymbolicTensor;
  const output = tf.layers.dense({ units: numLabels, kernelInitializer: 'glorotNormal' }).apply(dense1) as tf.SymbolicTensor;

  const model = tf.model({ inputs: input, outputs: output });

  model.compile({
    loss: 'meanAbsoluteError',
    optimizer: tf.train.adam(0.0005),
    metrics: ['accuracy']
  });

  return model;
}

export function buildFastModel(windowLength: number, numFeatures: number, numLabels: number) {
  const model = tf.sequential();
  model.add(tf.layers.lstm({
    units: 64,
    inputShape: [windowLength, numFeatures],
    kernelInitializer: 'glorotNormal'
  }));
  model.add(tf.layers.dense({ units: 32, activation: 'relu' }));
  model.add(tf.layers.dense({ units: numLabels }));

  model.compile({
    loss: 'meanAbsoluteError',
    optimizer: tf.train.adam(0.001)
  });

  return model;
}

export async function runBacktest(data: ProcessedDraw[], windowLength: number, testSize: number = 50, onProgress?: (p: number) => void) {
  if (data.length <= testSize + windowLength) return null;
  
  const trainData = data.slice(0, data.length - testSize);
  const testData = data.slice(data.length - testSize - windowLength);
  
  const { X: xTrain, Y: yTrain, scaler } = createDataset(trainData, windowLength);
  
  const testFeatures = testData.map(d => [
    d.num0, d.num1, d.num2, d.num3, d.num4, d.num5, d.num6, d.num7, d.num8, d.num9, d.letterNum,
    d.freq_num0, d.freq_num1, d.freq_num2, d.freq_num3, d.freq_num4, d.freq_num5, d.freq_num6, d.freq_num7, d.freq_num8, d.freq_num9, d.freq_letter,
    d.pair, d.impair, d.is_under_12,
    d.last_seen_num0, d.last_seen_num1, d.last_seen_num2, d.last_seen_num3, d.last_seen_num4, d.last_seen_num5, d.last_seen_num6, d.last_seen_num7, d.last_seen_num8, d.last_seen_num9, d.last_seen_letter
  ]);
  const scaledTest = scaler.transform(testFeatures);
  const XTest: number[][][] = [];
  const YTest: number[][] = [];
  
  for (let i = 0; i < scaledTest.length - windowLength; i++) {
    XTest.push(scaledTest.slice(i, i + windowLength));
    YTest.push(scaledTest[i + windowLength].slice(0, 11));
  }
  
  // 36 features
  const model = buildAdvancedModel(windowLength, 36, 11);
  
  const xs = tf.tensor3d(xTrain);
  const ys = tf.tensor2d(yTrain);
  const epochs = 30; 
  await model.fit(xs, ys, { 
    epochs, 
    batchSize: 32, 
    shuffle: true,
    callbacks: {
      onEpochEnd: async (epoch) => {
        if (onProgress) onProgress(Math.round(((epoch + 1) / epochs) * 100));
        await tf.nextFrame();
      }
    }
  });
  
  const xTestTensor = tf.tensor3d(XTest);
  const predictions = model.predict(xTestTensor) as tf.Tensor;
  const predArray = await predictions.array() as number[][];
  
  let totalBonsNumeros = 0;
  let grillesGagnantes = 0; // Win condition ? maybe 4 numbers
  
  const means = scaler.means.slice(0, 11);
  const stds = scaler.stds.slice(0, 11);
  
  for(let i=0; i<predArray.length; i++) {
    const p = predArray[i].map((val, j) => Math.round((val * stds[j]) + means[j]));
    const t = YTest[i].map((val, j) => Math.round((val * stds[j]) + means[j]));
    
    let bons = 0;
    const vraisNumeros = t.slice(0,10);
    for(let j=0; j<10; j++) {
      if (vraisNumeros.includes(p[j])) bons++;
    }
    const letterOk = p[10] === t[10];
    
    totalBonsNumeros += bons;
    if (bons >= 6 || letterOk) grillesGagnantes++;
  }
  
  xs.dispose();
  ys.dispose();
  xTestTensor.dispose();
  predictions.dispose();
  model.dispose();
  
  return {
    testSize: predArray.length,
    avgBonsNumeros: (totalBonsNumeros / predArray.length).toFixed(2),
    winRate: ((grillesGagnantes / predArray.length) * 100).toFixed(1)
  };
}
