"use client";

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Activity, Database, Play, Sparkles, RefreshCw, ChevronRight, Trophy, Target, ListOrdered, Brain, History, Settings, Calendar } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import * as tf from '@tensorflow/tfjs';
import { 
  processData, 
  createDataset, 
  buildAdvancedModel, 
  buildFastModel,
  runBacktest, 
  ProcessedDraw,
  initTensorFlow,
  TRAINING_CONFIG
} from '../lib/model';

import { calculateFrequencies, analyzeTypicality } from '../lib/stats';
import { loadDraws, saveDraws, saveModel, loadModel, hasSavedModel, loadPredictions, savePredictions, SavedPrediction, exportModel, saveLastPrediction, loadLastPrediction } from '../lib/storage';
import Link from 'next/link';

export default function Home() {
  const [data, setData] = useState<ProcessedDraw[]>([]);
  const [isScraping, setIsScraping] = useState(false);
  const [isTraining, setIsTraining] = useState(false);
  const [progress, setProgress] = useState(0);
  const [scrapeStatus, setScrapeStatus] = useState("");
  const [syncStatus, setSyncStatus] = useState("Local");
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(true);

  const [lossHistory, setLossHistory] = useState<{ epoch: number; loss: number }[]>([]);
  const [hasModel, setHasModel] = useState(false);
  const [modelReady, setModelReady] = useState(false);
  const [isBacktesting, setIsBacktesting] = useState(false);
  const [backtestStats, setBacktestStats] = useState<{ testSize: number, avgBonsNumeros: string, winRate: string } | null>(null);
  const [windowLength, setWindowLength] = useState(12);
  const [numPredictions, setNumPredictions] = useState(1);
  const [predictions, setPredictions] = useState<number[][]>([]);
  const [frequencies, setFrequencies] = useState<{ topNums: number[], topLetters: number[] } | null>(null);
  const [predictionHistory, setPredictionHistory] = useState<SavedPrediction[]>([]);
  const [simNumbers, setSimNumbers] = useState<number[]>([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 1]);
  const [simResult, setSimResult] = useState<{ score: number, analysis: string } | null>(null);
  const [isSyncingModel, setIsSyncingModel] = useState(false);
  const [trainingMode, setTrainingMode] = useState<'fast' | 'precise'>('precise');
  const [backendName, setBackendName] = useState("Chargement...");


  // Keep references for tensorflow model and data
  const tfModel = useRef<tf.LayersModel | null>(null);

  const scalerRef = useRef<any>(null);
  const lastTwelveRef = useRef<number[][] | null>(null);

  // Load and Auto-Update on mount
  useEffect(() => {
    async function init() {
      // 0. Init TensorFlow Backend (WebGPU/WebGL)
      await initTensorFlow();
      setBackendName(tf.getBackend().toUpperCase());

      // 1. Load from cache first

      const savedDraws = await loadDraws();
      if (savedDraws && savedDraws.length > 0) {
        setData(savedDraws);
        setFrequencies(calculateFrequencies(savedDraws));
        updateModelReferences(savedDraws);
      }

      // 2. Sync with Cloud (Vercel Blob)
      setSyncStatus("Syncing...");
      try {
        const syncRes = await fetch('/api/sync', { cache: 'no-store' });
        const syncJson = await syncRes.json();
        if (syncJson.success && syncJson.data && syncJson.data.length > (savedDraws?.length || 0)) {
          setData(syncJson.data);
          await saveDraws(syncJson.data);
          updateModelReferences(syncJson.data);
          setSyncStatus("Cloud");
        } else if (syncJson.success && (!syncJson.data || syncJson.data.length === 0) && savedDraws && savedDraws.length > 0) {
          console.log("Cloud empty, forcing push of local draws...");
          await fetch('/api/sync', {
            method: 'POST',
            body: JSON.stringify({ data: savedDraws, type: 'draws' })
          });
          setSyncStatus("Cloud (Migrated)");
        } else {
          setSyncStatus("Cloud Synced");
        }
      } catch (e) { 
        console.error("Sync failed:", e);
        setSyncStatus("Local Only");
      }

      // 3. Load Predictions History
      const savedPreds = await loadPredictions();
      if (savedPreds) setPredictionHistory(savedPreds);
      
      const lastActive = await loadLastPrediction();
      if (lastActive) setPredictions(lastActive);

      try {
        const predSync = await fetch('/api/sync?type=predictions', { cache: 'no-store' });
        const predJson = await predSync.json();
        if (predJson.success && predJson.data && predJson.data.length > 0) {
          setPredictionHistory(predJson.data);
          await savePredictions(predJson.data);
        } else if (predJson.success && (!predJson.data || predJson.data.length === 0) && savedPreds && savedPreds.length > 0) {
          // Cloud predictions empty, push local
          console.log("Cloud predictions empty, forcing push...");
          await fetch('/api/sync', {
            method: 'POST',
            body: JSON.stringify({ data: savedPreds, type: 'predictions' })
          });
        }
      } catch (e) { console.error("Pred sync failed:", e); }
      
      const exists = await hasSavedModel();
      setHasModel(exists);
      if (exists) {
        try {
          const model = await loadModel();
          if (model) {
            // Vérifier la compatibilité des features (25 attendues)
            const inputShape = model.inputs[0].shape;
            if (inputShape[2] === 25) {
              tfModel.current = model;
              setModelReady(true);
            } else {
              console.warn("Modèle obsolète détecté (ancienne version), un nouveau sera créé.");
              setHasModel(false);
            }
          }
        } catch (e) { console.error(e); }
      }

      // 3. Auto-update from server (Scraping)
      await handleScrape();
      setIsInitialLoading(false);
    }

    init();
  }, []);

  const updateModelReferences = (currentData: ProcessedDraw[], length: number = windowLength) => {
    const { scaler, lastTwelve } = createDataset(currentData, length);
    scalerRef.current = scaler;
    lastTwelveRef.current = lastTwelve;
  };

  const handleScrape = async (deep: boolean = false) => {
    setIsScraping(true);
    setScrapeStatus(deep ? "Récupération historique complet (2025-2026)..." : "Vérification nouveaux tirages...");
    try {
      const res = await fetch(`/api/crescendo${deep ? '?deep=true' : ''}`);
      const json = await res.json();
        if (json.success && json.results.length > 0) {
          const processed = processData(json.results);
          
          // Check if we actually have NEW data compared to current state
          const isNewData = processed.length > data.length;
          
          setData(processed);
          setFrequencies(calculateFrequencies(processed));
          await saveDraws(processed);
          updateModelReferences(processed);
        
          if (!tfModel.current) {
            tfModel.current = buildAdvancedModel(windowLength, 36, 11);
            setModelReady(true);
          }
          setScrapeStatus(deep ? `Historique chargé (${json.pagesScraped} pages)` : (isNewData ? "Nouveaux tirages détectés !" : "Données à jour"));

          // Push to Cloud
          try {
            await fetch('/api/sync', {
              method: 'POST',
              body: JSON.stringify({ data: processed })
            });
            setSyncStatus("Cloud Updated");
          } catch (e) { console.error("Cloud push failed:", e); }

          // AUTO-TRAIN if new data and not deep (deep is usually manual)
          if (isNewData && data.length > 0 && !deep) {
            console.log("Auto-training starting due to new data...");
            handleTrain();
          }
        }

    } catch (e) {
      console.error(e);
      setScrapeStatus("Erreur mise à jour");
    }
    setIsScraping(false);
    setTimeout(() => setScrapeStatus(""), 4000);
  };

  const handleTrain = async () => {
    if (data.length === 0) return;
    setIsTraining(true);
    setLossHistory([]);
    setProgress(0);

    // Fine-tuning: check if model exists, if not create it
    // OU si le mode d'entraînement a changé, ou si la taille de la fenêtre a changé
    let shouldBuild = !tfModel.current;
    if (tfModel.current) {
      const modelWindow = tfModel.current.inputs[0].shape[1];
      const modelIsAdvanced = tfModel.current.layers.length > 5; // Simple check: Advanced has more layers
      const wantAdvanced = trainingMode === 'precise';

      if (modelWindow !== windowLength || modelIsAdvanced !== wantAdvanced) {
        console.log(`Reconstruction du modèle : fenêtre ${modelWindow}->${windowLength}, mode ${modelIsAdvanced ? 'Elite' : 'Turbo'}->${wantAdvanced ? 'Elite' : 'Turbo'}`);
        shouldBuild = true;
      }
    }

    if (shouldBuild) {
      tfModel.current = trainingMode === 'precise' 
        ? buildAdvancedModel(windowLength, 36, 11) 
        : buildFastModel(windowLength, 36, 11);
    }

    const { X, Y } = createDataset(data, windowLength);
    if (X.length === 0 || Y.length === 0) {
      console.error("Dataset empty - cannot train");
      setIsTraining(false);
      return;
    }

    const config = TRAINING_CONFIG[trainingMode];
    const xs = tf.tensor3d(X);
    const ys = tf.tensor2d(Y);
    const epochs = config.epochs;

    await tfModel.current!.fit(xs, ys, {
      epochs,
      batchSize: config.batchSize,
      shuffle: true,
      callbacks: {
        onEpochEnd: (epoch, logs) => {
          setProgress(Math.round(((epoch + 1) / epochs) * 100));
          if (logs) setLossHistory(prev => [...prev, { epoch: epoch + 1, loss: logs.loss }]);
        }
      }
    });

    
    await saveModel(tfModel.current!);
    setHasModel(true);
    
    // Dispose tensors
    xs.dispose();
    ys.dispose();
    
    setIsTraining(false);

    // Auto-predict and save after training
    await handlePredict(true);
  };


  const handlePredict = async (autoSave: boolean = false) => {
    if (!tfModel.current || !lastTwelveRef.current || !scalerRef.current) return;
    setIsOptimizing(true);
    
    const candidates: { grille: number[], score: number }[] = [];
    const scaler = scalerRef.current;
    const means = scaler.means.slice(0, 11);
    const stds = scaler.stds.slice(0, 11);
    const modelWindow = tfModel.current.inputs[0].shape[1] as number;
    
    // Si la fenêtre du modèle est différente de la fenêtre actuelle, on recalcule le dernier segment
    let inputData = lastTwelveRef.current;
    if (modelWindow !== inputData.length) {
      const { lastTwelve } = createDataset(data, modelWindow);
      inputData = lastTwelve;
    }

    const currentWindow = inputData.length;

    // Phase 1 : Générer un large pool de candidats (100+)
    for (let p = 0; p < 150; p++) {
      tf.tidy(() => {
        const noise = tf.randomNormal([1, currentWindow, 36], 0, 0.01 + (p * 0.001));
        const input = tf.add(tf.tensor3d([inputData]), noise);
        const output = tfModel.current!.predict(input) as tf.Tensor;
        const scaledPred = output.arraySync() as number[][];
        
        if (scaledPred && scaledPred[0]) {
          let finalPred = scaledPred[0].map((val, i) => Math.round((val * stds[i]) + means[i]));
          for(let i=0; i<10; i++) finalPred[i] = Math.max(1, Math.min(25, finalPred[i]));
          finalPred[10] = Math.max(1, Math.min(13, finalPred[10])); // A-M
          
          let mainNums = Array.from(new Set(finalPred.slice(0, 10))).sort((a,b) => a-b);
          while(mainNums.length < 10) {
            const extra = Math.floor(Math.random() * 25) + 1;
            if(!mainNums.includes(extra)) mainNums.push(extra);
          }
          const grille = [...mainNums.sort((a,b) => a-b), finalPred[10]];
          
          // Phase 2 : Scoring GTO (Game Theory Optimal)
          let score = 0;
          const stats = analyzeTypicality(grille);
          if (stats.sumStatus === 'Optimal') score += 50;
          if (stats.balanceStatus === 'Équilibré') score += 30;
          
          // Bonus si contient des numéros fréquents
          if (frequencies) {
            grille.slice(0,10).forEach(n => {
              if (frequencies.topNums.includes(n)) score += 5;
            });
            if (frequencies.topLetters.includes(grille[10])) score += 10;
          }
          
          candidates.push({ grille, score });
        }
      });
      // Yield every 50 grilles for UI
      if (p % 50 === 0) await tf.nextFrame();
    }

    // Phase 3 : Sélection des meilleurs
    const topGrilles = candidates
      .sort((a, b) => b.score - a.score)
      .slice(0, numPredictions)
      .map(c => c.grille);

    setPredictions(topGrilles);
    setIsOptimizing(false);

    if (autoSave || topGrilles.length > 0) {
      const newSaved: SavedPrediction = {
        timestamp: new Date().toISOString(),
        grilles: topGrilles
      };
      
      // 1. Calculate new history
      const updatedHistory = [newSaved, ...predictionHistory].slice(0, 50);
      
      // 2. State updates (immediate UI feedback)
      setPredictions(topGrilles);
      setPredictionHistory(updatedHistory);
      
      // 3. PERSISTENCE (Blocking and robust)
      setSyncStatus("Saving...");
      try {
        // Save current active balls
        await saveLastPrediction(topGrilles);
        // Save history to local
        await savePredictions(updatedHistory);
        // Save to cloud
        await fetch(`/api/sync?type=predictions&t=${Date.now()}`, {
          method: 'POST',
          headers: { 'Cache-Control': 'no-cache' },
          body: JSON.stringify({ data: updatedHistory, type: 'predictions' })
        });
        setSyncStatus("Cloud Synced");
      } catch (e) { 
        console.error("Critical Save Error:", e);
        setSyncStatus("Error Saving");
      }
    }
  };

  const handleExport = () => {
    const blob = new Blob([JSON.stringify(predictionHistory, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `loto_ia_predictions_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
  };

  const handleSimulate = () => {
    if (!data.length) return;
    const { topNums, topLetters } = calculateFrequencies(data);
    const stats = analyzeTypicality(simNumbers);
    
    // Simple scoring logic
    let score = 0;
    // 1. Frequencies
    simNumbers.slice(0, 10).forEach(n => { if (topNums.includes(n)) score += 5; });
    if (topLetters.includes(simNumbers[10])) score += 15;
    
    // 2. Typicality
    if (stats.sumStatus === 'Optimal') score += 20;
    if (stats.balanceStatus === 'Équilibré') score += 15;
    
    // 3. Spacing
    const sorted = [...simNumbers.slice(0, 5)].sort((a, b) => a - b);
    let gaps = 0;
    for(let i=1; i<5; i++) gaps += (sorted[i] - sorted[i-1]);
    if (gaps > 20 && gaps < 40) score += 20;

    let analysis = "";
    if (score > 60) analysis = "Excellente conformité aux patterns historiques.";
    else if (score > 40) analysis = "Combinaison équilibrée, dans la moyenne.";
    else analysis = "Cette grille s'éloigne des statistiques habituelles.";

    setSimResult({ score, analysis });
  };

  const handleSyncModel = async () => {
    if (!modelReady) return;
    setIsSyncingModel(true);
    try {
      const modelData = await exportModel();
      if (modelData) {
        await fetch('/api/sync', {
          method: 'POST',
          body: JSON.stringify({ data: modelData, type: 'model' })
        });
        setSyncStatus("IA Cloud Ready");
      }
    } catch (e) {
      console.error("Sync model failed:", e);
    }
    setIsSyncingModel(false);
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        if (Array.isArray(json)) {
          setData(json);
          await saveDraws(json);
          updateModelReferences(json);
          alert("Import réussi !");
        }
      } catch (e) { alert("Format invalide"); }
    };
    reader.readAsText(file);
  };

  const handleBacktest = async () => {
    if (data.length === 0) return;
    setIsBacktesting(true);
    setBacktestStats(null);
    setProgress(0);
    try {
      const stats = await runBacktest(data, windowLength, 50, (p) => setProgress(p));
      if (stats) setBacktestStats(stats);
    } catch (e) { console.error(e); }
    setIsBacktesting(false);
  };


  return (
    <main className="min-h-screen p-6 md:p-12 lg:p-16 flex flex-col gap-12 relative">
      <AnimatePresence>
        {isInitialLoading && (
          <motion.div 
            initial={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-background flex flex-col items-center justify-center p-6 text-center"
          >
            <div className="relative mb-8">
              <motion.div 
                animate={{ rotate: 360 }}
                transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
                className="w-24 h-24 rounded-full border-2 border-primary/20 border-t-primary shadow-[0_0_30px_rgba(0,85,164,0.2)]"
              />
              <div className="absolute inset-0 flex items-center justify-center">
                <Brain className="w-8 h-8 text-primary animate-pulse" />
              </div>
            </div>
            <h2 className="text-2xl font-black tracking-tighter mb-2">INITIALISATION <span className="text-primary">IA</span> VISION</h2>
            <p className="text-slate-500 font-medium max-w-xs">{scrapeStatus || "Synchronisation des données en cours..."}</p>
            <div className="mt-8 flex gap-1">
               {[0,1,2].map(i => (
                 <motion.div key={i} animate={{ scale: [1, 1.5, 1] }} transition={{ duration: 1, repeat: Infinity, delay: i * 0.2 }} className="w-1.5 h-1.5 rounded-full bg-primary" />
               ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header Section */}
      <header className="flex flex-col md:flex-row justify-between items-end gap-6">
        <div className="space-y-4">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-bold uppercase tracking-widest"
          >
            <Brain className="w-3.5 h-3.5" />
            <span>Neural Intelligence • {syncStatus} • {scrapeStatus || "Stable"}</span>
          </motion.div>
          <h1 className="text-4xl md:text-6xl font-black tracking-tighter">
            CRESCENDO <span className="text-primary italic">IA</span> VISION
          </h1>
          <p className="text-slate-400 max-w-xl text-lg font-medium leading-relaxed">
            Exploitez la puissance des réseaux de neurones LSTM avec Fine-Tuning et stockage persistant.
          </p>
        </div>
        <div className="flex flex-wrap gap-4">
            <Link href="/journal" className="btn-ghost text-accent">
              <History className="w-5 h-5" />
              <span>Journal</span>
            </Link>
            <Link href="/history" className="btn-ghost">
              <Calendar className="w-5 h-5" />
              <span>Historique</span>
            </Link>
            <button 
                onClick={handleSyncModel}
                disabled={!modelReady || isSyncingModel}
                className={`btn-ghost ${isSyncingModel ? 'animate-pulse' : ''}`}
              >
                <RefreshCw className={`w-5 h-5 ${isSyncingModel ? 'animate-spin' : ''}`} />
                <span>Sync IA</span>
            </button>
            <button 
                onClick={() => handleScrape(true)} 
                disabled={isScraping}
                className="btn-ghost text-primary"
              >
                <Database className={`w-5 h-5 ${isScraping ? 'animate-pulse' : ''}`} />
                <span>Full Scraping 2025</span>
            </button>
            <button onClick={handleTrain} disabled={data.length === 0 || isTraining} className="btn-primary">
              {isTraining ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Play className="w-5 h-5" />}
              <span>{hasModel ? "Fine-Tune" : "Entraîner"}</span>
            </button>
        </div>
      </header>

      {/* Bento Grid Layout */}
      <div className="grid grid-cols-1 md:grid-cols-6 gap-6">
        
        {/* Prediction Display */}
        <motion.div className="md:col-span-4 glass-panel p-8 flex flex-col gap-8 relative group">
          <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:opacity-20 transition-opacity">
            <Sparkles className="w-24 h-24 text-primary" />
          </div>
          
          <div className="z-10 flex justify-between items-start">
            <div>
              <h2 className="text-2xl font-bold flex items-center gap-2 mb-2">
                <Target className="w-6 h-6 text-primary" /> Vision Prédictive
              </h2>
              <p className="text-slate-400 font-medium">Algorithme basé sur {windowLength} tirages</p>
            </div>
            <div className="flex flex-col items-end gap-2">
              <label className="text-[10px] font-black text-slate-500 uppercase">Nombre de Visions</label>
              <div className="flex items-center gap-3">
                <input type="range" min="1" max="10" value={numPredictions} onChange={(e) => setNumPredictions(parseInt(e.target.value))} className="w-32 accent-primary" />
                <span className="text-xl font-black text-primary">{numPredictions}</span>
              </div>
            </div>
          </div>

          <div className="z-10 space-y-6 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
            <AnimatePresence mode="popLayout">
              {predictions.length > 0 ? predictions.map((pred, pIdx) => {
                const stats = analyzeTypicality(pred);
                return (
                  <motion.div 
                    key={pIdx} 
                    initial={{ opacity: 0, x: -20 }} 
                    animate={{ opacity: 1, x: 0 }}
                    className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 rounded-2xl bg-slate-900/40 border border-white/5"
                  >
                    <div className="flex items-center gap-4">
                      <span className="text-[10px] font-black text-slate-500 w-6">#{pIdx + 1}</span>
                      <div className="flex gap-2">
                        {pred.map((num, i) => (
                          <div key={i} className={`number-ball ${i === 10 ? 'chance' : ''}`}>
                            {i === 10 ? String.fromCharCode(num + 64) : num}
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="flex gap-2">
                       <span className={`px-2 py-1 rounded-lg text-[9px] font-bold uppercase tracking-tight ${stats.sumStatus === 'Optimal' ? 'bg-primary/20 text-white border border-primary/30' : 'bg-slate-800 text-slate-400'}`}>
                         Somme {stats.sum} ({stats.sumStatus})
                       </span>
                       <span className={`px-2 py-1 rounded-lg text-[9px] font-bold uppercase tracking-tight ${stats.balanceStatus === 'Équilibré' ? 'bg-accent/20 text-white border border-accent/30' : 'bg-slate-800 text-slate-400'}`}>
                         {stats.evens}P / {stats.odds}I ({stats.balanceStatus})
                       </span>
                    </div>
                  </motion.div>
                );
              }) : (
                <div className="py-12 flex flex-col items-center justify-center border-2 border-dashed border-white/5 rounded-3xl opacity-20">
                   <Target className="w-12 h-12 mb-4" />
                   <p className="font-bold uppercase tracking-widest text-xs text-center px-4">Prêt pour l'analyse prédictive</p>
                </div>
              )}
            </AnimatePresence>
          </div>

          <button onClick={() => handlePredict(false)} disabled={!modelReady || isTraining || isOptimizing} className="btn-accent w-full md:w-fit z-10 mt-auto">
            {isOptimizing ? <RefreshCw className="w-5 h-5 animate-spin" /> : <ChevronRight className="w-5 h-5" />}
            {isOptimizing ? "Optimisation GTO..." : "Lancer les Calculs"}
          </button>
        </motion.div>

        {/* Configuration Card */}
        <motion.div className="md:col-span-2 glass-panel p-6 flex flex-col gap-6">
          <div className="flex justify-between items-start">
            <div>
              <h3 className="font-bold text-lg">Paramètres</h3>
              <p className="text-slate-400 text-sm">Gestion des données</p>
            </div>
            <Settings className="text-accent w-5 h-5" />
          </div>
          
          <div className="space-y-6">
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase">Fenêtre Temporelle (LSTMs)</label>
              <input 
                type="range" min="4" max="24" value={windowLength} 
                onChange={(e) => {
                  const val = parseInt(e.target.value);
                  setWindowLength(val);
                  updateModelReferences(data, val);
                }}
                className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-primary" 
              />
              <div className="flex justify-between text-[10px] font-bold text-slate-500">
                <span>4 TIRAGES</span>
                <span className="text-primary">{windowLength}</span>
                <span>24 TIRAGES</span>
              </div>
            </div>

            <div className="space-y-3 pt-4 border-t border-slate-800/50">
               <label className="text-xs font-bold text-slate-500 uppercase block">Persistance (Multi-Navigateur)</label>
               <div className="grid grid-cols-2 gap-3">
                 <button onClick={handleExport} className="btn-ghost !py-2 !text-xs !px-2">
                    <Database className="w-3.5 h-3.5" /> Exporter JSON
                 </button>
                 <label className="btn-ghost !py-2 !text-xs !px-2 cursor-pointer">
                    <History className="w-3.5 h-3.5" /> Importer
                    <input type="file" accept=".json" onChange={handleImport} className="hidden" />
                 </label>
               </div>
               <p className="text-[10px] text-slate-500 italic leading-tight">
                 Utilisez l'export pour transférer vos données SQLite/IndexedDB vers un autre navigateur.
               </p>
            </div>

            <div className="p-3 rounded-xl bg-slate-900/50 border border-slate-800/50 space-y-2">
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-tighter">Accélération Matérielle</p>
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono text-accent">{backendName}</span>
                <span className="flex h-2 w-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]" />
              </div>
            </div>

            <div className="space-y-3 pt-4 border-t border-slate-800/50">
               <label className="text-xs font-bold text-slate-500 uppercase block">Mode d'Entraînement</label>
               <div className="grid grid-cols-2 gap-2">
                 {(['fast', 'precise'] as const).map(mode => (
                   <button 
                     key={mode}
                     onClick={() => setTrainingMode(mode)}
                     className={`px-3 py-2 rounded-xl text-[10px] font-black uppercase transition-all border ${
                       trainingMode === mode 
                        ? 'bg-primary text-white border-primary shadow-[0_0_15px_rgba(59,130,246,0.3)]' 
                        : 'bg-slate-900/50 text-slate-500 border-white/5 hover:border-white/10'
                     }`}
                   >
                     {TRAINING_CONFIG[mode].label.split(' ')[0]}
                   </button>
                 ))}
               </div>
               <p className="text-[9px] text-slate-500 italic px-1">
                 {TRAINING_CONFIG[trainingMode].desc} • {TRAINING_CONFIG[trainingMode].epochs} époques
               </p>
            </div>

          </div>
        </motion.div>

        {/* Performance Chart */}
        <motion.div className="md:col-span-3 glass-panel p-6 flex flex-col gap-6 relative overflow-hidden">
          <div className="flex justify-between items-start z-10">
            <div>
              <h3 className="font-bold text-lg flex items-center gap-2"><Activity className="w-4 h-4 text-accent" /> Loss History</h3>
              <p className="text-[10px] text-slate-500 uppercase font-black">Précision des neurones</p>
            </div>
            {isTraining && (
               <span className="flex h-2 w-2 rounded-full bg-accent animate-ping" />
            )}
          </div>

          <AnimatePresence>
            {isTraining && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="space-y-2 z-10"
              >
                <div className="flex justify-between text-[10px] font-black uppercase">
                  <span className="text-accent">Entraînement en cours</span>
                  <span className="text-white">{progress}%</span>
                </div>
                <div className="h-1.5 w-full bg-slate-900 rounded-full overflow-hidden">
                  <motion.div 
                    className="h-full bg-accent"
                    initial={{ width: 0 }}
                    animate={{ width: `${progress}%` }}
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="h-48 md:h-64 w-full min-h-[250px] min-w-full z-10 flex items-center justify-center">
            {lossHistory.length > 0 ? (
              <ResponsiveContainer width="99%" height="100%" minHeight={180}>
                <LineChart data={lossHistory}>
                   <Line type="monotone" dataKey="loss" stroke="#3b82f6" strokeWidth={2} dot={false} isAnimationActive={false} />
                   <Tooltip contentStyle={{ backgroundColor: '#020617', border: '1px solid rgba(59,130,246,0.2)', borderRadius: '12px' }} itemStyle={{ color: '#3b82f6' }} labelClassName="hidden" />
                 </LineChart>
               </ResponsiveContainer>
            ) : (
              <div className="text-slate-600 text-[10px] uppercase font-black">En attente de données d'entraînement...</div>
            )}
          </div>
        </motion.div>

        {/* Grid Simulator */}
        <motion.div className="md:col-span-3 glass-panel p-6 flex flex-col gap-6">
          <div className="flex justify-between items-center">
            <h3 className="font-bold text-lg flex items-center gap-2"><Target className="w-4 h-4 text-accent" /> Simulateur de Grille</h3>
            {simResult && (
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black text-slate-500">SCORE IA:</span>
                <span className={`text-sm font-black ${simResult.score > 50 ? 'text-green-400' : 'text-loto-yellow'}`}>{simResult.score}%</span>
              </div>
            )}
          </div>
          
          <div className="grid grid-cols-6 gap-2">
            {[0,1,2,3,4,5,6,7,8,9,10].map(idx => (
              <div key={idx} className="space-y-1">
                <input 
                  type={idx === 10 ? "text" : "number"}
                  min="1" 
                  max="25"
                  value={idx === 10 ? String.fromCharCode(simNumbers[idx] + 64) : simNumbers[idx]}
                  onChange={(e) => {
                    const next = [...simNumbers];
                    if (idx === 10) {
                      next[idx] = e.target.value.toUpperCase().charCodeAt(0) - 64 || 1;
                    } else {
                      next[idx] = parseInt(e.target.value) || 1;
                    }
                    setSimNumbers(next);
                  }}
                  className={`w-full bg-slate-900/50 border ${idx === 10 ? 'border-loto-red/30 focus:border-loto-red' : 'border-white/10 focus:border-accent'} rounded-lg p-2 text-center text-sm font-bold outline-none transition-colors`}
                />
                <span className="block text-center text-[8px] font-black text-slate-600 uppercase">{idx === 10 ? 'Lettre' : `N°${idx+1}`}</span>
              </div>
            ))}
          </div>

          <button onClick={handleSimulate} className="btn-primary w-full py-2 text-xs">
            Analyser la Combinaison
          </button>

          {simResult && (
            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-[10px] text-center text-slate-400 italic">
              "{simResult.analysis}"
            </motion.p>
          )}
        </motion.div>

        {/* Heatmap Card */}
        <motion.div className="md:col-span-3 glass-panel p-6 flex flex-col gap-6">
          <div className="flex items-center justify-between mb-4">
             <h3 className="font-bold text-lg flex items-center gap-2"><ListOrdered className="w-4 h-4 text-loto-yellow" /> Chaleur des Numéros</h3>
             <Link href="/journal" className="flex items-center gap-2 text-sm font-bold text-slate-400 hover:text-accent transition-colors">
                <History className="w-4 h-4" />
                Journal
              </Link>
          </div>
          <p className="text-[10px] text-slate-500 uppercase font-black -mt-4">Les 10 numéros les plus fréquents</p>
          <div className="flex flex-wrap gap-3">
             {frequencies?.topNums.map((num, i) => (
               <div key={i} className="flex flex-col items-center gap-1">
                 <div className="w-10 h-10 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center font-bold text-primary">
                    {num}
                 </div>
                 <span className="text-[8px] font-bold text-slate-600">RANK {i+1}</span>
               </div>
             ))}
          </div>
          <div className="pt-4 border-t border-white/5">
             <p className="text-[10px] text-slate-500 uppercase font-black mb-3">Lettres Favorites</p>
             <div className="flex gap-4">
                {frequencies?.topLetters.map((c, i) => (
                  <div key={i} className="w-8 h-8 rounded-full bg-loto-yellow text-slate-900 flex items-center justify-center font-black text-xs shadow-lg">
                    {String.fromCharCode(c + 64)}
                  </div>
                ))}
             </div>
          </div>
        </motion.div>

        {/* Quick Backtest */}
        <motion.div className="md:col-span-3 glass-panel p-6 flex flex-col justify-between overflow-hidden relative">
          <div className="space-y-4 z-10">
            <h3 className="text-xl font-bold flex items-center gap-2"><Trophy className="w-6 h-6 text-yellow-500" /> Validation</h3>
            
            <AnimatePresence mode="wait">
              {isBacktesting ? (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }} 
                  animate={{ opacity: 1, y: 0 }} 
                  exit={{ opacity: 0, y: -10 }}
                  className="space-y-4 py-4"
                >
                  <div className="flex justify-between items-end mb-1">
                    <span className="text-[10px] font-black text-primary uppercase">Calcul en cours...</span>
                    <span className="text-xl font-black text-white">{progress}%</span>
                  </div>
                  <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden">
                    <motion.div 
                      className="h-full bg-primary"
                      initial={{ width: 0 }}
                      animate={{ width: `${progress}%` }}
                    />
                  </div>
                  <p className="text-[10px] text-slate-500 italic">L'IA simule 50 tirages passés pour valider sa précision...</p>
                </motion.div>
              ) : (
                <motion.div 
                  initial={{ opacity: 0 }} 
                  animate={{ opacity: 1 }}
                  className="grid grid-cols-3 gap-3"
                >
                  <div className="p-3 rounded-xl bg-slate-900/80 border border-white/5 text-center">
                    <span className="text-[10px] uppercase font-bold text-slate-500 block">Win Rate</span>
                    <span className="text-lg font-black text-primary">{backtestStats?.winRate || '0'}%</span>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-900/80 border border-white/5 text-center">
                    <span className="text-[10px] uppercase font-bold text-slate-500 block">Avg Numeros</span>
                    <span className="text-lg font-black text-white">{backtestStats?.avgBonsNumeros || '0'}</span>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-900/80 border border-white/5 text-center">
                    <span className="text-[10px] uppercase font-bold text-slate-500 block">Sample</span>
                    <span className="text-lg font-black text-white">{backtestStats?.testSize || '0'}</span>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          
          <button onClick={handleBacktest} disabled={isBacktesting || data.length === 0} className="btn-ghost w-full mt-4 z-10 relative">
            {isBacktesting ? <RefreshCw className="w-4 h-4 animate-spin mr-2" /> : <Play className="w-4 h-4 mr-2" />}
            {isBacktesting ? "Analyse..." : "Lancer Test de Précision"}
          </button>
        </motion.div>


      </div>

      <footer className="mt-auto py-8 text-center border-t border-slate-800/50">
        <p className="text-slate-600 text-xs font-medium tracking-widest uppercase">
          Propulsé par Antigravity Intelligence • © 2026
        </p>
      </footer>
    </main>
  );
}



