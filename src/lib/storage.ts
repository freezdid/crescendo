import { ProcessedDraw } from './model';
import * as tf from '@tensorflow/tfjs';

const DB_NAME = 'CrescendoIAVisionDB';
const DB_VERSION = 2; // Incremented for predictions store
const DRAWS_STORE = 'draws';
const PREDICTIONS_STORE = 'predictions';
const METADATA_STORE = 'metadata';

export interface SavedPrediction {
  timestamp: string;
  grilles: number[][];
}

export async function initDB() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event: any) => {
      const db = request.result;
      if (!db.objectStoreNames.contains(DRAWS_STORE)) {
        db.createObjectStore(DRAWS_STORE);
      }
      if (!db.objectStoreNames.contains(PREDICTIONS_STORE)) {
        db.createObjectStore(PREDICTIONS_STORE);
      }
      if (!db.objectStoreNames.contains(METADATA_STORE)) {
        db.createObjectStore(METADATA_STORE);
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function saveDraws(draws: ProcessedDraw[]) {
  const db = await initDB();
  const tx = db.transaction(DRAWS_STORE, 'readwrite');
  const store = tx.objectStore(DRAWS_STORE);
  store.put(draws, 'all_draws');
  return new Promise((resolve) => (tx.oncomplete = resolve));
}

export async function loadDraws(): Promise<ProcessedDraw[] | null> {
  const db = await initDB();
  return new Promise((resolve) => {
    const request = db.transaction(DRAWS_STORE).objectStore(DRAWS_STORE).get('all_draws');
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => resolve(null);
  });
}

export async function savePredictions(preds: SavedPrediction[]) {
  const db = await initDB();
  const tx = db.transaction(PREDICTIONS_STORE, 'readwrite');
  const store = tx.objectStore(PREDICTIONS_STORE);
  store.put(preds, 'history');
  return new Promise((resolve) => (tx.oncomplete = resolve));
}

export async function loadPredictions(): Promise<SavedPrediction[] | null> {
  const db = await initDB();
  return new Promise((resolve) => {
    const request = db.transaction(PREDICTIONS_STORE).objectStore(PREDICTIONS_STORE).get('history');
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => resolve(null);
  });
}

// Persist the current active prediction shown on dashboard
export async function saveLastPrediction(preds: number[][]) {
  const db = await initDB();
  const tx = db.transaction(PREDICTIONS_STORE, 'readwrite');
  tx.objectStore(PREDICTIONS_STORE).put(preds, 'last_active');
  return new Promise((resolve) => (tx.oncomplete = resolve));
}

export async function loadLastPrediction(): Promise<number[][] | null> {
  const db = await initDB();
  return new Promise((resolve) => {
    const request = db.transaction(PREDICTIONS_STORE).objectStore(PREDICTIONS_STORE).get('last_active');
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => resolve(null);
  });
}

// Model persistence using TensorFlow.js built-in IndexedDB support
const MODEL_PATH = `indexeddb://${DB_NAME}-model`;

export async function saveModel(model: tf.LayersModel) {
  await model.save(MODEL_PATH);
}

export async function loadModel(): Promise<tf.LayersModel | null> {
  try {
    const model = await tf.loadLayersModel(MODEL_PATH);
    return model;
  } catch (e) {
    return null;
  }
}

export async function hasSavedModel(): Promise<boolean> {
  const models = await tf.io.listModels();
  return !!models[MODEL_PATH];
}

// Cloud Model Sync (Experimental for Cron)
export async function exportModel() {
  if (!(await hasSavedModel())) return null;
  // This is tricky in browser. We'll use a virtual IO handler to get the data.
  let modelData: any = {};
  await (await loadModel())?.save(tf.io.withSaveHandler(async (artifacts) => {
    modelData = artifacts;
    return { modelArtifactsInfo: { dateSaved: new Date(), modelTopologyType: 'JSON' } };
  }));
  return modelData;
}

export async function importModel(artifacts: any) {
  const model = await tf.loadLayersModel(tf.io.fromMemory(artifacts));
  await saveModel(model);
  return model;
}
