import * as tf from '@tensorflow/tfjs';
import '@tensorflow/tfjs-backend-webgpu';
import { ProcessedDraw, createDataset } from './pipeline';

// Initialize TensorFlow backend (WebGPU when available, WebGL fallback).
// Returns the active backend name so callers can display it.
export async function initTensorFlow(): Promise<string> {
  await tf.ready();
  if (tf.engine().backendName !== 'webgpu') {
    try {
      await tf.setBackend('webgpu');
      console.log('Backend WebGPU activé');
    } catch {
      console.warn('WebGPU non supporté, repli sur WebGL');
      await tf.setBackend('webgl');
    }
  }
  return tf.getBackend()?.toUpperCase() || 'CPU';
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

  for (let i = 0; i < predArray.length; i++) {
    const p = predArray[i].map((val, j) => Math.round((val * stds[j]) + means[j]));
    const t = YTest[i].map((val, j) => Math.round((val * stds[j]) + means[j]));

    let bons = 0;
    const vraisNumeros = t.slice(0, 10);
    for (let j = 0; j < 10; j++) {
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
