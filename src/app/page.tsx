"use client";

import { useState, useRef, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Activity, Sparkles, RefreshCw, Trophy, 
  Target, Brain, History, Flame, 
  Copy, Check, Info, TrendingUp, CheckCircle2,
  Cpu, Eye, Layers,
  Timer, Clock, Calendar
} from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import * as tf from '@tensorflow/tfjs';
import Link from 'next/link';

import { 
  processData, 
  createDataset, 
  buildAdvancedModel, 
  buildFastModel, 
  ProcessedDraw, 
  initTensorFlow, 
  TRAINING_CONFIG 
} from '@/lib/model';

import { 
  calculateComprehensiveStats, 
  generateSmartGrilles, 
  analyzeGrille, 
  ComprehensiveStats, 
  GrilleAnalysis, 
  StrategyType, 
  STRATEGY_CONFIG, 
  SAMEDI_LETTERS, 
  runStrategyBacktest,
  extractNumbersAndLetter
} from '@/lib/stats';

import { 
  loadDraws, 
  saveDraws, 
  saveModel, 
  loadModel, 
  hasSavedModel, 
  loadPredictions, 
  savePredictions, 
  SavedPrediction, 
  saveLastPrediction, 
  loadLastPrediction 
} from '@/lib/storage';

// Pure helper: next Saturday draw countdowns (module-level so it is stable for hooks)
function computeSaturdayCountdowns(now: Date) {
  const drawHours = [13, 14, 15, 16, 17, 18, 19];
  const drawLabels = ['13h00', '14h00', '15h00', '16h00', '17h00', '18h00', '19h00'];

  // Find next Saturday (or today if Saturday)
  const dayOfWeek = now.getDay(); // 0=Sun, 6=Sat
  let daysUntilSat = (6 - dayOfWeek + 7) % 7;
  if (daysUntilSat === 0) {
    // It's Saturday - check if all draws have passed
    const lastDrawTime = new Date(now);
    lastDrawTime.setHours(19, 5, 0, 0);
    if (now > lastDrawTime) {
      daysUntilSat = 7; // Next Saturday
    }
  }

  const nextSaturday = new Date(now);
  nextSaturday.setDate(now.getDate() + daysUntilSat);

  return drawHours.map((hour, idx) => {
    const drawTime = new Date(nextSaturday);
    drawTime.setHours(hour, 0, 0, 0);
    const diff = drawTime.getTime() - now.getTime();
    return {
      hour,
      label: drawLabels[idx],
      diff: Math.max(0, diff),
      passed: diff <= 0
    };
  });
}

export default function Home() {
  const [data, setData] = useState<ProcessedDraw[]>([]);
  const [stats, setStats] = useState<ComprehensiveStats | null>(null);
  const [isScraping, setIsScraping] = useState(false);
  const [isTraining, setIsTraining] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentEpoch, setCurrentEpoch] = useState(0);
  const [totalEpochs, setTotalEpochs] = useState(50);
  const [currentLoss, setCurrentLoss] = useState<number | null>(null);
  const [initialLoss, setInitialLoss] = useState<number | null>(null);
  const [activeNeurons, setActiveNeurons] = useState<number[]>([]);
  const [scrapeStatus, setScrapeStatus] = useState("");
  const [syncStatus, setSyncStatus] = useState("Local");
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [showTrainingMonitor, setShowTrainingMonitor] = useState(false);

  // Strategy & Generation settings
  const [selectedStrategy, setSelectedStrategy] = useState<StrategyType>('HYBRID_AI');
  const [numGrids, setNumGrids] = useState<number>(4);
  const [generatedGrilles, setGeneratedGrilles] = useState<GrilleAnalysis[]>([]);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  // Neural training telemetry
  const [lossHistory, setLossHistory] = useState<{ epoch: number; loss: number }[]>([]);
  const [trainingMode, setTrainingMode] = useState<'fast' | 'precise'>('precise');
  const [windowLength, setWindowLength] = useState(12);
  const [backendName, setBackendName] = useState("Initialisation...");

  // Backtest state
  const [isBacktesting, setIsBacktesting] = useState(false);
  const [backtestStats, setBacktestStats] = useState<any>(null);

  // Interactive 25-ball inspector
  const [selectedBallForDetail, setSelectedBallForDetail] = useState<number | null>(null);

  // Interactive Simulator
  const [simSelectedNumbers, setSimSelectedNumbers] = useState<number[]>([3, 7, 10, 12, 14, 18, 19, 21, 22, 25]);
  const [simSelectedLetter, setSimSelectedLetter] = useState<number>(3); // M

  // Saturday Countdown Timer
  const [saturdayCountdowns, setSaturdayCountdowns] = useState<{hour: number; label: string; diff: number; passed: boolean}[]>(() => computeSaturdayCountdowns(new Date()));
  const [currentTime, setCurrentTime] = useState(() => new Date());

  // References
  const tfModel = useRef<tf.LayersModel | null>(null);
  const scalerRef = useRef<any>(null);
  const lastTwelveRef = useRef<number[][] | null>(null);

  // Latest real draw in database
  const latestRealDraw = useMemo(() => {
    if (data.length === 0) return null;
    return data[data.length - 1];
  }, [data]);

  const latestRealInfo = useMemo(() => {
    if (!latestRealDraw) return null;
    return extractNumbersAndLetter(latestRealDraw);
  }, [latestRealDraw]);

  // Simulator evaluation
  const simAnalysis = useMemo(() => {
    if (simSelectedNumbers.length !== 10) return null;
    return analyzeGrille([...simSelectedNumbers, simSelectedLetter], stats || undefined);
  }, [simSelectedNumbers, simSelectedLetter, stats]);

  const updateModelReferences = (currentData: ProcessedDraw[], length: number = windowLength) => {
    if (currentData.length < length + 2) return;
    const { scaler, lastTwelve } = createDataset(currentData, length);
    scalerRef.current = scaler;
    lastTwelveRef.current = lastTwelve;
  };

  const handleScrape = async (deep: boolean = false) => {
    setIsScraping(true);
    setScrapeStatus(deep ? "Scraping approfondi (2025-2026)..." : "Vérification des derniers tirages...");
    try {
      const res = await fetch(`/api/crescendo${deep ? '?deep=true' : ''}`);
      const json = await res.json();
      if (json.success && json.results.length > 0) {
        // Merge server results with local data (dedupe by date+time) to avoid any data loss
        const merged = new Map<string, any>();
        for (const d of data) merged.set(`${d.date}|${d.time}`, d);
        for (const d of json.results) merged.set(`${d.date}|${d.time}`, d);

        const processed = processData(Array.from(merged.values()));
        const isNew = processed.length > data.length;

        setData(processed);
        const computedStats = calculateComprehensiveStats(processed);
        setStats(computedStats);
        await saveDraws(processed);
        updateModelReferences(processed);

        if (!tfModel.current) {
          tfModel.current = buildAdvancedModel(windowLength, 36, 11);
        }

        setScrapeStatus(isNew ? `${processed.length - data.length} nouveau(x) tirage(s) synchronisé(s) !` : "Tirages à jour");

        // Background Cloud Push
        fetch('/api/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ data: processed, type: 'draws' })
        }).catch(err => console.error("Sync push failed:", err));
      }
    } catch (e) {
      console.error("Scrape error:", e);
      setScrapeStatus("Données locales conservées");
    }
    setIsScraping(false);
    setTimeout(() => setScrapeStatus(""), 4500);
  };

  // Update countdown every second
  useEffect(() => {
    const tick = () => {
      const now = new Date();
      setCurrentTime(now);
      setSaturdayCountdowns(computeSaturdayCountdowns(now));
    };
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, []);

  // Initial Load
  useEffect(() => {
    async function init() {
      // 0. TensorFlow Backend
      try {
        await initTensorFlow();
        setBackendName(tf.getBackend()?.toUpperCase() || 'CPU');
      } catch (e) {
        console.warn('TF init fallback:', e);
        setBackendName('CPU');
      }

      // 1. Load Local Draws
      let savedDraws: ProcessedDraw[] | null = null;
      try {
        savedDraws = await loadDraws();
        if (savedDraws && savedDraws.length > 0) {
          // Heal legacy ordering: processData always returns chronological (oldest first)
          savedDraws = processData(savedDraws);
          setData(savedDraws);
          await saveDraws(savedDraws);
          const comprehensive = calculateComprehensiveStats(savedDraws);
          setStats(comprehensive);
          updateModelReferences(savedDraws);

          // Pre-generate initial predictions if none exist
          const initial = generateSmartGrilles('HYBRID_AI', comprehensive, 4);
          setGeneratedGrilles(initial);
        }
      } catch (e) {
        console.warn('Local data load error:', e);
      }

      // 2. Cloud Sync
      setSyncStatus("Synchronisation...");
      try {
        const syncRes = await fetch('/api/sync', { cache: 'no-store' });
        const syncJson = await syncRes.json();
        if (syncJson.success && syncJson.data && syncJson.data.length > (savedDraws?.length || 0)) {
          const processed = processData(syncJson.data);
          setData(processed);
          await saveDraws(processed);
          const computedStats = calculateComprehensiveStats(processed);
          setStats(computedStats);
          updateModelReferences(processed);
          setSyncStatus("Cloud Actif");
        } else {
          setSyncStatus("Cloud Synchronisé");
        }
      } catch (e) {
        console.warn("Cloud sync error, using local data:", e);
        setSyncStatus("Mode Local");
      }

      // 3. Load Saved Predictions
      try {
        const lastActive = await loadLastPrediction();
        if (lastActive && lastActive.length > 0) {
          const analyzed = lastActive.map(g => analyzeGrille(g, stats || undefined));
          setGeneratedGrilles(analyzed);
        }
      } catch (e) {
        console.warn('Prediction load error:', e);
      }

      // 4. Model Check
      try {
        const exists = await hasSavedModel();
        if (exists) {
          const model = await loadModel();
          if (model) {
            tfModel.current = model;
          }
        }
      } catch (e) {
        console.error("Model load error:", e);
      }

      // 5. Auto scrape latest
      try {
        await handleScrape(false);
      } catch (e) {
        console.warn('Auto scrape failed:', e);
      }
    }

    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleTrainModel = async () => {
    if (data.length === 0) {
      console.warn('No data available for training');
      return;
    }
    
    setIsTraining(true);
    setShowTrainingMonitor(true);
    setLossHistory([]);
    setProgress(0);
    setCurrentEpoch(0);
    setCurrentLoss(null);
    setInitialLoss(null);

    let xs: tf.Tensor | null = null;
    let ys: tf.Tensor | null = null;

    try {
      // Ensure TF is ready
      await tf.ready();

      let shouldBuild = !tfModel.current;
      if (tfModel.current) {
        try {
          const modelWindow = tfModel.current.inputs[0].shape[1];
          if (modelWindow !== windowLength) shouldBuild = true;
        } catch {
          shouldBuild = true;
        }
      }

      if (shouldBuild) {
        // Dispose previous model if exists
        if (tfModel.current) {
          try { tfModel.current.dispose(); } catch { /* ignore */ }
        }
        tfModel.current = trainingMode === 'precise'
          ? buildAdvancedModel(windowLength, 36, 11)
          : buildFastModel(windowLength, 36, 11);
      }

      const dataset = createDataset(data, windowLength);
      const { X, Y } = dataset;
      
      if (X.length === 0 || Y.length === 0) {
        console.warn('Insufficient data for training window:', data.length, 'draws, window:', windowLength);
        setIsTraining(false);
        return;
      }

      // Update scaler and lastTwelve references from dataset
      scalerRef.current = dataset.scaler;
      lastTwelveRef.current = dataset.lastTwelve;

      const config = TRAINING_CONFIG[trainingMode];
      setTotalEpochs(config.epochs);
      xs = tf.tensor3d(X);
      ys = tf.tensor2d(Y);
      const epochs = config.epochs;

      await tfModel.current!.fit(xs, ys, {
        epochs,
        batchSize: config.batchSize,
        shuffle: true,
        callbacks: {
          onEpochEnd: async (epoch, logs) => {
            const ep = epoch + 1;
            const pct = Math.round((ep / epochs) * 100);
            setProgress(pct);
            setCurrentEpoch(ep);

            if (logs && typeof logs.loss === 'number') {
              const lossVal = Number(logs.loss.toFixed(4));
              setCurrentLoss(lossVal);
              if (epoch === 0) setInitialLoss(lossVal);
              setLossHistory(prev => [...prev, { epoch: ep, loss: lossVal }]);
            }

            // Animate random active neurons in the visualization grid
            const randomActive = Array.from({ length: 12 }, () => Math.floor(Math.random() * 36));
            setActiveNeurons(randomActive);

            // Yield to browser UI for smooth animation render
            await tf.nextFrame();
          }
        }
      });

      // Save model after successful training
      try {
        await saveModel(tfModel.current!);
      } catch (e) {
        console.warn('Model save failed:', e);
      }

      // Trigger high-grade generation post training
      await handleGenerateCombinations();
    } catch (e) {
      console.error("Training error:", e);
    } finally {
      if (xs) xs.dispose();
      if (ys) ys.dispose();
      setIsTraining(false);
    }
  };

  // Main Generation Handler combining Neural Network & Statistical Engine
  const handleGenerateCombinations = async () => {
    if (!stats) return;
    setIsOptimizing(true);

    const neuralCandidates: number[][] = [];

    // If Neural Model is ready, sample candidate sequences
    if (tfModel.current && lastTwelveRef.current && scalerRef.current) {
      const scaler = scalerRef.current;
      const means = scaler.means.slice(0, 11);
      const stds = scaler.stds.slice(0, 11);
      const inputData = lastTwelveRef.current;
      const currentWindow = inputData.length;

      for (let p = 0; p < 80; p++) {
        tf.tidy(() => {
          const noise = tf.randomNormal([1, currentWindow, 36], 0, 0.012 + (p * 0.001));
          const input = tf.add(tf.tensor3d([inputData]), noise);
          const output = tfModel.current!.predict(input) as tf.Tensor;
          const scaledPred = output.arraySync() as number[][];

          if (scaledPred && scaledPred[0]) {
            const rawNums = scaledPred[0].map((val, i) => {
              const u1 = Math.max(1e-10, Math.random());
              const u2 = Math.random();
              const z = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
              const valWithNoise = val + (z * 0.7);
              return Math.round((valWithNoise * stds[i]) + means[i]);
            });

            for (let i = 0; i < 10; i++) rawNums[i] = Math.max(1, Math.min(25, rawNums[i]));
            rawNums[10] = Math.max(1, Math.min(6, rawNums[10]));

            const unique = Array.from(new Set(rawNums.slice(0, 10))).sort((a, b) => a - b);
            while (unique.length < 10) {
              const r = Math.floor(Math.random() * 25) + 1;
              if (!unique.includes(r)) unique.push(r);
            }
            neuralCandidates.push([...unique.sort((a, b) => a - b), rawNums[10]]);
          }
        });
      }
    }

    const results = generateSmartGrilles(selectedStrategy, stats, numGrids, neuralCandidates);
    setGeneratedGrilles(results);
    setIsOptimizing(false);

    // Save to persistence
    const rawGrilles = results.map(r => r.grille);
    await saveLastPrediction(rawGrilles);

    const savedPredObj: SavedPrediction = {
      timestamp: new Date().toISOString(),
      grilles: rawGrilles
    };

    const existingHistory = await loadPredictions() || [];
    const updatedHistory = [savedPredObj, ...existingHistory].slice(0, 50);
    await savePredictions(updatedHistory);

    // Background push to Cloud
    fetch('/api/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: updatedHistory, type: 'predictions' })
    }).catch(err => console.error("Cloud push failed:", err));
  };

  const handleCopyGrille = (analysis: GrilleAnalysis, index: number) => {
    const text = `Grille Crescendo IA :\nNuméros : ${analysis.mainNumbers.join(' - ')}\nLettre : ${analysis.letterChar}\nScore IA : ${analysis.overallScore}/100 (Confiance ${analysis.confidenceRate}%)`;
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2500);
  };

  const handleRunBacktest = () => {
    if (data.length < 40) return;
    setIsBacktesting(true);
    setTimeout(() => {
      const res = runStrategyBacktest(selectedStrategy, data, 35);
      setBacktestStats(res);
      setIsBacktesting(false);
    }, 400);
  };

  const toggleSimNumber = (num: number) => {
    if (simSelectedNumbers.includes(num)) {
      setSimSelectedNumbers(prev => prev.filter(n => n !== num));
    } else {
      if (simSelectedNumbers.length < 10) {
        setSimSelectedNumbers(prev => [...prev, num].sort((a, b) => a - b));
      }
    }
  };

  // Overlap between latest real draw and top predicted grid
  const primaryGridOverlap = useMemo(() => {
    if (!latestRealInfo || generatedGrilles.length === 0) return [];
    return generatedGrilles[0].mainNumbers.filter(n => latestRealInfo.nums.includes(n));
  }, [latestRealInfo, generatedGrilles]);

  const lossReductionPct = useMemo(() => {
    if (!initialLoss || !currentLoss || initialLoss === 0) return 0;
    const diff = ((initialLoss - currentLoss) / initialLoss) * 100;
    return Math.max(0, Math.round(diff));
  }, [initialLoss, currentLoss]);

  return (
    <main className="min-h-screen text-slate-100 flex flex-col pb-24">
      {/* Top Header & Quantum Telemetry */}
      <header className="sticky top-0 z-50 border-b border-white/[0.08] bg-[#07080c]/90 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-18 flex items-center justify-between gap-4">
          
          {/* Logo & Brand */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 via-amber-500 to-amber-700 p-0.5 shadow-lg shadow-amber-500/20 flex items-center justify-center">
              <div className="w-full h-full bg-[#0b0e17] rounded-[0.625rem] flex items-center justify-center">
                <Brain className="w-5 h-5 text-amber-400 animate-pulse" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-black text-lg tracking-tight text-white">CRESCENDO</span>
                <span className="font-black tracking-wider text-lg text-amber-400">QUANTUM</span>
                <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
                  v2.5 Pro
                </span>
              </div>
            </div>
          </div>

          {/* Center Navigation Links */}
          <nav className="hidden md:flex items-center gap-1 bg-white/[0.03] border border-white/[0.06] rounded-xl p-1 text-xs">
            <Link 
              href="/" 
              className="px-3.5 py-1.5 rounded-lg font-bold bg-white/[0.08] text-white flex items-center gap-1.5 shadow-sm"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-400" /> Laboratoire
            </Link>
            <Link 
              href="/history" 
              className="px-3.5 py-1.5 rounded-lg font-medium text-slate-400 hover:text-white hover:bg-white/[0.04] transition-all flex items-center gap-1.5"
            >
              <History className="w-3.5 h-3.5" /> Archives ({data.length})
            </Link>
            <Link 
              href="/journal" 
              className="px-3.5 py-1.5 rounded-lg font-medium text-slate-400 hover:text-white hover:bg-white/[0.04] transition-all flex items-center gap-1.5"
            >
              <Trophy className="w-3.5 h-3.5" /> Journal des Gains
            </Link>
          </nav>

          {/* Right Status Badges & Refresh */}
          <div className="flex items-center gap-2.5">
            <div className="hidden lg:flex items-center gap-2 bg-[#0d121e] border border-white/[0.08] px-3 py-1.5 rounded-xl text-xs font-medium">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span className="text-slate-400">GPU:</span>
              <span className="text-slate-200 font-semibold">{backendName}</span>
              <span className="text-white/20">•</span>
              <span className="text-slate-400">Sync:</span>
              <span className="text-amber-400 font-semibold">{syncStatus}</span>
            </div>

            <button
              onClick={() => handleScrape(false)}
              disabled={isScraping}
              className="btn-ghost-dark text-xs py-1.5 px-3"
              title="Actualiser les tirages"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-amber-400 ${isScraping ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Sync</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 flex flex-col gap-6">
        
        {/* Banner Alert Notification */}
        <AnimatePresence>
          {scrapeStatus && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="luxury-panel p-3 flex items-center justify-between border-amber-500/30 bg-amber-500/10 text-amber-200 text-xs font-medium"
            >
              <div className="flex items-center gap-2">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                <span>{scrapeStatus}</span>
              </div>
              <span className="text-amber-400/80 font-bold">{data.length} tirages en BDD</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ============================================================== */}
        {/* FEATURE 1: SIDE-BY-SIDE DUAL COMPARISON HERO (CÔTE À CÔTE)     */}
        {/* ============================================================== */}
        <section className="luxury-panel p-5 sm:p-6 border-glow-gold/30 relative overflow-hidden">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 pb-3 border-b border-white/[0.08]">
            <div className="space-y-0.5">
              <span className="text-[11px] font-black uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                <Eye className="w-3.5 h-3.5" />
                Face-à-Face en Temps Réel • Visualisation Côte à Côte
              </span>
              <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                Dernier Tirage Réel vs Prédiction IA Suivante
              </h2>
            </div>

            {/* Overlap badge */}
            {primaryGridOverlap.length > 0 && (
              <div className="self-start sm:self-auto px-3 py-1 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs font-black flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-amber-400" />
                <span>{primaryGridOverlap.length} numéros communs détectés : {primaryGridOverlap.join(', ')}</span>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            
            {/* LEFT SIDE: LATEST REAL DRAW */}
            <div className="bg-[#090c14] border border-white/[0.08] rounded-2xl p-4 sm:p-5 flex flex-col justify-between gap-3">
              <div className="flex items-center justify-between pb-2 border-b border-white/[0.06]">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse" />
                  <span className="text-xs font-extrabold uppercase tracking-wider text-slate-300">
                    Dernier Tirage Réel Confirmé
                  </span>
                </div>
                <span className="text-[11px] text-slate-400 font-bold bg-white/[0.04] px-2 py-0.5 rounded-md capitalize">
                  {latestRealDraw ? `${latestRealDraw.date} (${latestRealDraw.time})` : "En attente"}
                </span>
              </div>

              {/* Numbers Balls */}
              {latestRealInfo ? (
                <div className="flex flex-wrap items-center gap-2">
                  {latestRealInfo.nums.map((n, i) => (
                    <div 
                      key={i} 
                      className="ball-3d w-9 h-9 text-xs font-black"
                      title={`Numéro réel sorti : ${n}`}
                    >
                      {n}
                    </div>
                  ))}
                  <div className="h-8 w-px bg-white/10 mx-1 hidden sm:block" />
                  <div className="letter-badge-3d w-9 h-9 text-xs font-black ml-auto" title="Lettre officielle">
                    {latestRealInfo.letterChar}
                  </div>
                </div>
              ) : (
                <div className="text-xs text-slate-500 py-3">Aucun tirage disponible</div>
              )}

              {/* Real Draw Telemetry */}
              {latestRealInfo && (
                <div className="flex items-center justify-between text-[11px] text-slate-400 pt-2 border-t border-white/[0.06]">
                  <span>Somme : <strong className="text-white">{latestRealInfo.nums.reduce((a, b) => a + b, 0)}</strong></span>
                  <span>Parité : <strong className="text-white">{latestRealInfo.nums.filter(n => n % 2 === 0).length}P / {10 - latestRealInfo.nums.filter(n => n % 2 === 0).length}I</strong></span>
                  <span className="text-amber-400 font-bold">Lettre &apos;{latestRealInfo.letterChar}&apos;</span>
                </div>
              )}
            </div>

            {/* RIGHT SIDE: TOP PREDICTED NEXT DRAW */}
            <div className="bg-[#0b101c] border border-amber-500/40 rounded-2xl p-4 sm:p-5 flex flex-col justify-between gap-3 shadow-lg shadow-amber-500/5">
              <div className="flex items-center justify-between pb-2 border-b border-amber-500/20">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-ping" />
                  <span className="text-xs font-extrabold uppercase tracking-wider text-amber-300">
                    Prédiction IA pour le Prochain Tirage
                  </span>
                </div>
                {generatedGrilles[0] && (
                  <span className="text-[11px] font-black text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/20">
                    Score : {generatedGrilles[0].overallScore}/100 (Confiance {generatedGrilles[0].confidenceRate}%)
                  </span>
                )}
              </div>

              {/* Numbers Balls */}
              {generatedGrilles[0] ? (
                <div className="flex flex-wrap items-center gap-2">
                  {generatedGrilles[0].mainNumbers.map((n, i) => {
                    const isCommon = latestRealInfo?.nums.includes(n);
                    return (
                      <div 
                        key={i} 
                        className={`ball-3d w-9 h-9 text-xs font-black ${isCommon ? 'ball-3d-gold ring-2 ring-amber-400 scale-105' : ''}`}
                        title={`Numéro prédit : ${n} ${isCommon ? '(Présent aussi dans le dernier tirage)' : ''}`}
                      >
                        {n}
                      </div>
                    );
                  })}
                  <div className="h-8 w-px bg-white/10 mx-1 hidden sm:block" />
                  <div className="letter-badge-3d w-9 h-9 text-xs font-black ml-auto" title="Lettre recommandée">
                    {generatedGrilles[0].letterChar}
                  </div>
                </div>
              ) : (
                <div className="text-xs text-slate-500 py-3">Cliquez sur Générer pour calculer</div>
              )}

              {/* Predicted Telemetry */}
              {generatedGrilles[0] && (
                <div className="flex items-center justify-between text-[11px] text-slate-400 pt-2 border-t border-amber-500/20">
                  <span>Somme : <strong className="text-white">{generatedGrilles[0].sum} ({generatedGrilles[0].sumStatus})</strong></span>
                  <span>Parité : <strong className="text-white">{generatedGrilles[0].evens}P / {generatedGrilles[0].odds}I</strong></span>
                  <span className="text-emerald-400 font-bold">Affinité : {generatedGrilles[0].affinityScore}%</span>
                </div>
              )}
            </div>

          </div>
        </section>

        {/* ============================================================== */}
        {/* FEATURE 2: VISUAL NEURAL TRAINING MONITOR (MONITEUR EN DIRECT) */}
        {/* ============================================================== */}
        <section className="luxury-panel p-5 sm:p-6 flex flex-col gap-4 border-cyan-500/30">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-pulse" />
                <h3 className="text-lg font-black text-white tracking-tight flex items-center gap-2">
                  <Cpu className="w-4 h-4 text-cyan-400" />
                  Moniteur d&apos;Entraînement Neuronal Local (Deep Learning)
                </h3>
              </div>
              <p className="text-xs text-slate-400">
                Visualisation temps réel de l&apos;architecture LSTM bidirectionnelle et descente du gradient sur votre GPU.
              </p>
            </div>

            {/* Training Controls */}
            <div className="flex flex-wrap items-center gap-2.5">
              {/* Training Mode Switcher */}
              <div className="flex items-center gap-1 bg-black/40 p-1 rounded-xl border border-white/[0.08] text-xs">
                <button
                  onClick={() => setTrainingMode('fast')}
                  disabled={isTraining}
                  className={`px-2.5 py-1 rounded-lg font-bold transition-all ${
                    trainingMode === 'fast' ? 'bg-cyan-500 text-slate-950 shadow-md' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Turbo (25 ép.)
                </button>
                <button
                  onClick={() => setTrainingMode('precise')}
                  disabled={isTraining}
                  className={`px-2.5 py-1 rounded-lg font-bold transition-all ${
                    trainingMode === 'precise' ? 'bg-amber-400 text-slate-950 shadow-md' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Elite (50 ép.)
                </button>
              </div>

              {/* Start Training Button */}
              <button
                onClick={handleTrainModel}
                disabled={isTraining || data.length === 0}
                className="btn-cyan text-xs py-2 px-4 shadow-lg"
              >
                <Brain className={`w-3.5 h-3.5 ${isTraining ? 'animate-pulse' : ''}`} />
                <span>{isTraining ? `Entraînement en cours...` : `Lancer Entraînement Local`}</span>
              </button>

              <button
                onClick={handleRunBacktest}
                disabled={isBacktesting || data.length < 35}
                className="btn-ghost-dark text-xs py-2 px-3"
                title="Lancer un backtest sur 35 tirages récents"
              >
                <TrendingUp className="w-3.5 h-3.5 text-cyan-400" />
                <span>{isBacktesting ? "Simulation..." : "Backtest (35)"}</span>
              </button>

              <button
                onClick={() => setShowTrainingMonitor(!showTrainingMonitor)}
                className="btn-ghost-dark text-xs py-2 px-3"
                title="Afficher/Masquer les synapses"
              >
                <Layers className="w-3.5 h-3.5 text-slate-400" />
                <span className="hidden sm:inline">{showTrainingMonitor ? 'Réduire' : 'Détails Synapses'}</span>
              </button>
            </div>
          </div>

          {/* Backtest Results if available */}
          {backtestStats && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-[#080b13] border border-cyan-500/30 p-3 rounded-xl text-xs">
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-bold">Moyenne Bons Nums</span>
                <div className="text-base font-black text-white">{backtestStats.avgHits} / 10</div>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-bold">Réussite &ge; 6 Nums</span>
                <div className="text-base font-black text-emerald-400">{backtestStats.highWinRate}%</div>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-bold">Lettre SAMEDI</span>
                <div className="text-base font-black text-amber-400">{backtestStats.letterMatchRate}%</div>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-bold">Gros Gains (&ge;8)</span>
                <div className="text-base font-black text-cyan-400">{backtestStats.jackpotCloseRate}%</div>
              </div>
            </div>
          )}

          {/* Active Training Status HUD */}
          {(isTraining || showTrainingMonitor || lossHistory.length > 0) && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-[#080b13] border border-white/[0.08] p-4 rounded-2xl">
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Époque & Progression</span>
                <div className="text-xl font-black text-white">
                  {currentEpoch} <span className="text-xs text-slate-400 font-normal">/ {totalEpochs} ({progress}%)</span>
                </div>
              </div>

              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Perte MAE Actuelle</span>
                <div className="text-xl font-black text-cyan-400">
                  {currentLoss !== null ? currentLoss : "--"}
                </div>
              </div>

              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Réduction de l&apos;Erreur</span>
                <div className="text-xl font-black text-emerald-400">
                  {lossReductionPct > 0 ? `-${lossReductionPct}%` : "Convergence..."}
                </div>
              </div>

              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Accélération Matérielle</span>
                <div className="text-xl font-black text-amber-400">
                  {backendName} <span className="text-[10px] text-slate-400 font-normal">Active</span>
                </div>
              </div>
            </div>
          )}

          {/* Progress bar */}
          {isTraining && (
            <div className="w-full bg-slate-900 h-2 rounded-full overflow-hidden border border-white/10">
              <motion.div 
                className="h-full bg-gradient-to-r from-cyan-500 via-amber-400 to-amber-500"
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                transition={{ ease: "easeOut" }}
              />
            </div>
          )}

          {/* Real-time Synaptic Matrix Grid & Loss Chart */}
          {(isTraining || showTrainingMonitor || lossHistory.length > 0) && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 pt-1">
              
              {/* Synapses matrix */}
              <div className="bg-[#090c14] border border-white/[0.06] p-4 rounded-xl flex flex-col justify-between gap-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-300 flex items-center gap-1.5">
                    <Activity className="w-3.5 h-3.5 text-cyan-400" />
                    Activité des 36 Neurones d&apos;Entrée & Poids LSTM
                  </span>
                  <span className="text-[10px] text-slate-400">Couches Bidirectionnelles</span>
                </div>

                <div className="grid grid-cols-9 gap-1.5 p-2 bg-black/40 rounded-xl border border-white/[0.04]">
                  {Array.from({ length: 36 }).map((_, i) => {
                    const isFired = activeNeurons.includes(i) || isTraining;
                    return (
                      <motion.div
                        key={i}
                        animate={{
                          backgroundColor: isFired ? (i % 2 === 0 ? 'rgba(6, 182, 212, 0.8)' : 'rgba(245, 158, 11, 0.8)') : 'rgba(255, 255, 255, 0.05)',
                          scale: isFired ? 1.08 : 1
                        }}
                        transition={{ duration: 0.15 }}
                        className="h-6 rounded-md flex items-center justify-center text-[9px] font-black text-slate-900"
                        title={`Neurone ${i + 1}`}
                      >
                        {i + 1}
                      </motion.div>
                    );
                  })}
                </div>
                <div className="text-[10px] text-slate-400 flex items-center justify-between">
                  <span>Pondération d&apos;attention automatique</span>
                  <span className="text-cyan-400 font-bold">Fenêtre : {windowLength} tirages</span>
                </div>
              </div>

              {/* Loss Curve */}
              <div className="bg-[#090c14] border border-white/[0.06] p-4 rounded-xl flex flex-col justify-between gap-2 h-44">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-300 flex items-center gap-1.5">
                    <TrendingUp className="w-3.5 h-3.5 text-amber-400" />
                    Courbe de Convergence (Loss en direct)
                  </span>
                  <span className="text-[10px] text-slate-400">Évolution par Époque</span>
                </div>

                {lossHistory.length > 0 ? (
                  <div className="h-32 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={lossHistory}>
                        <XAxis dataKey="epoch" stroke="#475569" fontSize={10} />
                        <YAxis stroke="#475569" fontSize={10} domain={['auto', 'auto']} />
                        <Tooltip 
                          contentStyle={{ backgroundColor: '#0b0f19', borderColor: '#334155', borderRadius: '0.5rem', fontSize: '11px' }} 
                        />
                        <Line 
                          type="monotone" 
                          dataKey="loss" 
                          stroke="#06b6d4" 
                          strokeWidth={2} 
                          dot={false} 
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="h-32 flex items-center justify-center text-xs text-slate-500">
                    Lancez l&apos;entraînement pour observer la courbe de perte
                  </div>
                )}
              </div>

            </div>
          )}
        </section>

        {/* ============================================================== */}
        {/* FEATURE 3: COMPACT STRATEGY SELECTOR & GENERATION CONTROLS     */}
        {/* ============================================================== */}
        <section className="luxury-panel p-5 sm:p-6 flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <span className="text-[11px] font-black uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                <Target className="w-3.5 h-3.5" />
                Configuration du Générateur
              </span>
              <h3 className="text-xl font-black text-white tracking-tight">
                Génération Multi-Grilles des Numéros du Jour
              </h3>
            </div>

            {/* Grids count & Generate Button */}
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1 bg-black/40 p-1 rounded-xl border border-white/[0.08] text-xs">
                {[1, 2, 4, 6].map((n) => (
                  <button
                    key={n}
                    onClick={() => setNumGrids(n)}
                    className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
                      numGrids === n
                        ? 'bg-amber-500 text-slate-950 shadow-md font-black'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {n} {n === 1 ? 'Grille' : 'Grilles'}
                  </button>
                ))}
              </div>

              <button
                onClick={handleGenerateCombinations}
                disabled={isOptimizing || isTraining}
                className="btn-gold text-xs py-2.5 px-5 shadow-xl"
              >
                <Sparkles className={`w-3.5 h-3.5 text-slate-950 ${isOptimizing ? 'animate-spin' : ''}`} />
                <span>{isOptimizing ? 'Calcul...' : 'Générer Maintenant'}</span>
              </button>
            </div>
          </div>

          {/* Compact Strategy Selector Pills */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5 pt-1">
            {(Object.keys(STRATEGY_CONFIG) as StrategyType[]).map((strat) => {
              const item = STRATEGY_CONFIG[strat];
              const isSelected = selectedStrategy === strat;
              
              return (
                <button
                  key={strat}
                  onClick={() => setSelectedStrategy(strat)}
                  className={`p-3 rounded-xl border text-left transition-all flex flex-col justify-between gap-1.5 ${
                    isSelected 
                      ? 'bg-amber-500/15 border-amber-500/60 shadow-md shadow-amber-500/10' 
                      : 'bg-white/[0.02] border-white/[0.06] hover:bg-white/[0.04]'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded ${
                      isSelected ? 'bg-amber-400 text-slate-950' : 'bg-white/10 text-slate-400'
                    }`}>
                      {item.badge}
                    </span>
                    {isSelected && <CheckCircle2 className="w-3.5 h-3.5 text-amber-400" />}
                  </div>
                  <div>
                    <div className={`font-bold text-xs ${isSelected ? 'text-white' : 'text-slate-300'}`}>
                      {item.label}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        {/* ============================================================== */}
        {/* FEATURE 4: SIDE-BY-SIDE 2-COLUMN GRIDS DISPLAY (COMPACT)       */}
        {/* ============================================================== */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-black tracking-tight text-white uppercase flex items-center gap-2">
              <Trophy className="w-4 h-4 text-amber-400" />
              Grilles Prêtes pour Aujourd&apos;hui ({generatedGrilles.length})
            </h3>
            <span className="text-xs text-slate-400">
              Affichage compact côte à côte
            </span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {generatedGrilles.map((analysis, idx) => {
              const isCopied = copiedIndex === idx;

              return (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.04 }}
                  className="luxury-panel p-4 sm:p-5 flex flex-col justify-between gap-3 border-white/[0.08]"
                >
                  {/* Card Header */}
                  <div className="flex items-center justify-between pb-2.5 border-b border-white/[0.06]">
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-lg bg-amber-500/20 border border-amber-500/30 flex items-center justify-center font-black text-amber-400 text-xs">
                        #{idx + 1}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-extrabold text-white text-sm">Combinaison {idx + 1}</span>
                          <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            Score : {analysis.overallScore}/100
                          </span>
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={() => handleCopyGrille(analysis, idx)}
                      className={`btn-ghost-dark text-xs py-1.5 px-2.5 ${
                        isCopied ? 'bg-emerald-500/20 text-emerald-300' : ''
                      }`}
                    >
                      {isCopied ? (
                        <>
                          <Check className="w-3 h-3 text-emerald-400" />
                          <span>Copié</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3 text-slate-400" />
                          <span>Copier</span>
                        </>
                      )}
                    </button>
                  </div>

                  {/* 10 Balls Row + Letter */}
                  <div className="flex flex-wrap items-center gap-1.5 py-1">
                    {analysis.mainNumbers.map((num) => {
                      const numStat = stats?.numberStats[num];
                      const isHot = numStat?.temperature === 'hot';
                      const isOverdue = numStat?.temperature === 'overdue';

                      let ballClass = "ball-3d w-8 h-8 text-xs font-black";
                      if (isHot) ballClass = "ball-3d ball-3d-gold w-8 h-8 text-xs font-black";
                      else if (isOverdue) ballClass = "ball-3d ball-3d-emerald w-8 h-8 text-xs font-black";

                      return (
                        <div key={num} className={ballClass} title={`Numéro ${num}`}>
                          {num}
                        </div>
                      );
                    })}

                    <div className="h-6 w-px bg-white/10 mx-1" />

                    <div className="letter-badge-3d w-8 h-8 text-xs font-black" title="Lettre SAMEDI">
                      {analysis.letterChar}
                    </div>
                  </div>

                  {/* Compact Metrics Bar */}
                  <div className="grid grid-cols-4 gap-1.5 text-[11px] pt-1">
                    <div className="bg-white/[0.02] border border-white/[0.04] p-1.5 rounded-lg text-center">
                      <span className="text-slate-400 text-[10px] block">Somme</span>
                      <strong className="text-white font-bold">{analysis.sum}</strong>
                    </div>

                    <div className="bg-white/[0.02] border border-white/[0.04] p-1.5 rounded-lg text-center">
                      <span className="text-slate-400 text-[10px] block">Parité</span>
                      <strong className="text-white font-bold">{analysis.evens}P / {analysis.odds}I</strong>
                    </div>

                    <div className="bg-white/[0.02] border border-white/[0.04] p-1.5 rounded-lg text-center">
                      <span className="text-slate-400 text-[10px] block">Étalement</span>
                      <strong className="text-white font-bold">{analysis.lows}B / {analysis.highs}H</strong>
                    </div>

                    <div className="bg-white/[0.02] border border-white/[0.04] p-1.5 rounded-lg text-center">
                      <span className="text-slate-400 text-[10px] block">Affinité</span>
                      <strong className="text-cyan-400 font-bold">{analysis.affinityScore}%</strong>
                    </div>
                  </div>

                  {/* Concise Justification */}
                  <div className="text-[11px] text-slate-400 bg-[#090b12] p-2 rounded-lg border border-white/[0.04]">
                    <span className="font-bold text-slate-300">Justification : </span>
                    {analysis.explanations[0] || "Respect optimal des contraintes probabilistes et de la moyenne historique"}
                  </div>
                </motion.div>
              );
            })}
          </div>
        </section>

        {/* ============================================================== */}
        {/* FEATURE 5: COMPACT MATRIX & SAMEDI RADAR (2 COLONNES)          */}
        {/* ============================================================== */}
        {stats && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* 25-Ball Matrix (Spans 2 columns) */}
            <div className="luxury-panel p-5 flex flex-col justify-between gap-4 lg:col-span-2">
              <div className="flex items-center justify-between pb-2 border-b border-white/[0.06]">
                <h4 className="font-black text-white text-sm flex items-center gap-2">
                  <Flame className="w-4 h-4 text-amber-500" />
                  Matrice Compacte des 25 Numéros
                </h4>
                <div className="flex items-center gap-2 text-[10px]">
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500" /> Chaud</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500" /> Retard</span>
                </div>
              </div>

              <div className="grid grid-cols-5 gap-2">
                {Array.from({ length: 25 }, (_, i) => i + 1).map((num) => {
                  const s = stats.numberStats[num];
                  const isSelected = selectedBallForDetail === num;
                  const isHot = s?.temperature === 'hot';
                  const isOverdue = s?.temperature === 'overdue';

                  return (
                    <button
                      key={num}
                      onClick={() => setSelectedBallForDetail(isSelected ? null : num)}
                      className={`p-2 rounded-xl border text-center transition-all flex flex-col items-center gap-1 ${
                        isSelected 
                          ? 'bg-amber-500/20 border-amber-400 shadow-md' 
                          : isHot 
                            ? 'bg-amber-500/[0.08] border-amber-500/30' 
                            : isOverdue 
                              ? 'bg-emerald-500/[0.08] border-emerald-500/30' 
                              : 'bg-white/[0.02] border-white/[0.06] hover:bg-white/[0.05]'
                      }`}
                    >
                      <div className={isHot ? "ball-3d ball-3d-gold w-7 h-7 text-[11px]" : isOverdue ? "ball-3d ball-3d-emerald w-7 h-7 text-[11px]" : "ball-3d w-7 h-7 text-[11px]"}>
                        {num}
                      </div>
                      <div className="text-[10px] font-bold text-white leading-none">
                        {s?.frequency}%
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Detail drawer if clicked */}
              {selectedBallForDetail !== null && stats.numberStats[selectedBallForDetail] && (
                <div className="bg-[#0b0e17] border border-amber-500/30 p-3 rounded-xl flex items-center justify-between text-xs">
                  <div>
                    <strong className="text-white">Numéro {selectedBallForDetail} :</strong> {stats.numberStats[selectedBallForDetail].count} sorties • Écart : {stats.numberStats[selectedBallForDetail].currentDelay} tirages
                  </div>
                  <div className="text-[11px] text-amber-400 font-bold">
                    Partenaire n°1 : {stats.numberStats[selectedBallForDetail].affinityPartners[0]?.num} ({stats.numberStats[selectedBallForDetail].affinityPartners[0]?.score}%)
                  </div>
                </div>
              )}
            </div>

            {/* SAMEDI Letters Radar (1 column) */}
            <div className="luxury-panel p-5 flex flex-col justify-between gap-3">
              <div className="pb-2 border-b border-white/[0.06]">
                <h4 className="font-black text-white text-sm flex items-center gap-2">
                  <Trophy className="w-4 h-4 text-amber-500" />
                  Probabilités SAMEDI
                </h4>
              </div>

              <div className="space-y-2">
                {stats.topLetters.map((l, idx) => (
                  <div key={l.letter} className="flex items-center justify-between gap-3 bg-white/[0.02] p-2 rounded-xl border border-white/[0.04]">
                    <div className="flex items-center gap-2">
                      <div className="letter-badge-3d w-7 h-7 text-xs font-black">
                        {l.letter}
                      </div>
                      <span className="text-xs font-bold text-white">Lettre {l.letter}</span>
                    </div>

                    <div className="text-right">
                      <div className="text-xs font-black text-amber-400">{l.prob}%</div>
                      <div className="text-[10px] text-slate-400">Écart : {l.currentDelay} tir.</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </div>
        )}

        {/* ============================================================== */}
        {/* FEATURE 6: SATURDAY COUNTDOWN TIMER                            */}
        {/* ============================================================== */}
        <section className="luxury-panel p-5 sm:p-6 flex flex-col gap-4 border-emerald-500/20">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-white/[0.06]">
            <div className="space-y-0.5">
              <span className="text-[11px] font-black uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                <Timer className="w-3.5 h-3.5" />
                Compte à Rebours • Prochains Tirages SAMEDI
              </span>
              <h3 className="text-xl font-black text-white tracking-tight">
                Horaires des Tirages Crescendo du Samedi
              </h3>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <Calendar className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-slate-300 font-bold">
                {currentTime.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
              </span>
              <span className="text-white/20">•</span>
              <Clock className="w-3 h-3 text-amber-400" />
              <span className="text-amber-300 font-bold tabular-nums">
                {currentTime.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3">
            {saturdayCountdowns.map((draw) => {
              const hours = Math.floor(draw.diff / (1000 * 60 * 60));
              const minutes = Math.floor((draw.diff % (1000 * 60 * 60)) / (1000 * 60));
              const seconds = Math.floor((draw.diff % (1000 * 60)) / 1000);
              const days = Math.floor(hours / 24);
              const remainingHours = hours % 24;
              
              const isNext = !draw.passed && saturdayCountdowns.filter(d => !d.passed).indexOf(draw) === 0;
              const isUrgent = !draw.passed && draw.diff < 3600000; // < 1h
              
              return (
                <motion.div
                  key={draw.hour}
                  animate={isNext ? { scale: [1, 1.02, 1] } : {}}
                  transition={isNext ? { repeat: Infinity, duration: 2, ease: 'easeInOut' } : {}}
                  className={`relative p-3 rounded-xl border text-center transition-all flex flex-col items-center gap-2 ${
                    draw.passed
                      ? 'bg-white/[0.02] border-white/[0.06] opacity-40'
                      : isNext
                        ? 'bg-emerald-500/15 border-emerald-400/50 shadow-lg shadow-emerald-500/10'
                        : isUrgent
                          ? 'bg-rose-500/10 border-rose-400/30'
                          : 'bg-white/[0.03] border-white/[0.08] hover:bg-white/[0.05]'
                  }`}
                >
                  {isNext && (
                    <span className="absolute -top-2 left-1/2 -translate-x-1/2 text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-500 text-slate-950">
                      Prochain
                    </span>
                  )}
                  <div className={`text-sm font-black ${
                    draw.passed ? 'text-slate-500 line-through' : isNext ? 'text-emerald-300' : 'text-white'
                  }`}>
                    {draw.label}
                  </div>
                  {draw.passed ? (
                    <div className="text-[10px] text-slate-500 font-bold uppercase">Terminé</div>
                  ) : (
                    <div className="font-mono text-sm font-black tabular-nums">
                      {days > 0 ? (
                        <span className={isNext ? 'text-emerald-400' : isUrgent ? 'text-rose-400' : 'text-amber-300'}>
                          {days}j {String(remainingHours).padStart(2, '0')}h{String(minutes).padStart(2, '0')}
                        </span>
                      ) : (
                        <span className={isNext ? 'text-emerald-400' : isUrgent ? 'text-rose-400 animate-pulse' : 'text-amber-300'}>
                          {String(remainingHours).padStart(2, '0')}:{String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
                        </span>
                      )}
                    </div>
                  )}
                </motion.div>
              );
            })}
          </div>

          {/* Quick info bar */}
          <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1">
            <span>7 tirages chaque samedi de 13h à 19h • Résultats synchronisés automatiquement</span>
            <span className="text-emerald-400 font-bold">
              {saturdayCountdowns.filter(d => !d.passed).length} tirage(s) restant(s)
            </span>
          </div>
        </section>

        {/* ============================================================== */}
        {/* FEATURE 7: COMPACT SIMULATOR & GAIN CHECKER                    */}
        {/* ============================================================== */}
        <section className="luxury-panel p-5 sm:p-6 flex flex-col gap-4">
          <div className="flex items-center justify-between pb-2 border-b border-white/[0.06]">
            <div>
              <h4 className="font-black text-white text-base flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-cyan-400" />
                Simulateur Express de Grille
              </h4>
              <p className="text-xs text-slate-400">Cliquez pour tester n&apos;importe quelle grille de 10 numéros + lettre</p>
            </div>
            <span className="text-xs font-bold text-amber-400">
              {simSelectedNumbers.length} / 10 Numéros
            </span>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {Array.from({ length: 25 }, (_, i) => i + 1).map((n) => {
              const isSelected = simSelectedNumbers.includes(n);
              return (
                <button
                  key={n}
                  onClick={() => toggleSimNumber(n)}
                  className={`w-8 h-8 rounded-lg font-black text-xs transition-all ${
                    isSelected
                      ? 'bg-amber-400 text-slate-950 shadow-md scale-105'
                      : 'bg-white/[0.04] text-slate-300 border border-white/[0.06] hover:bg-white/[0.08]'
                  }`}
                >
                  {n}
                </button>
              );
            })}
          </div>

          {/* Letter Pick */}
          <div className="flex items-center gap-2 text-xs">
            <span className="text-slate-400 font-bold">Lettre :</span>
            {SAMEDI_LETTERS.map((char, idx) => (
              <button
                key={char}
                onClick={() => setSimSelectedLetter(idx + 1)}
                className={`w-7 h-7 rounded-md font-black text-xs transition-all ${
                  simSelectedLetter === idx + 1
                    ? 'bg-amber-400 text-slate-950 shadow-sm'
                    : 'bg-white/[0.04] text-slate-400 border border-white/[0.06]'
                }`}
              >
                {char}
              </button>
            ))}
          </div>

          {/* Simulator diagnostic */}
          {simAnalysis && (
            <div className="bg-[#0b0e17] border border-white/[0.08] p-3.5 rounded-xl flex items-center justify-between gap-4 text-xs">
              <div className="flex items-center gap-3">
                <div className="text-xl font-black text-amber-400">{simAnalysis.overallScore}/100</div>
                <div>
                  <div className="font-bold text-white">Score Probabiliste</div>
                  <div className="text-slate-400 text-[11px]">{simAnalysis.sumStatus} (Somme {simAnalysis.sum}) • {simAnalysis.evens}P/{simAnalysis.odds}I</div>
                </div>
              </div>
              <div className="text-right text-[11px] text-emerald-400 font-bold">
                Confiance IA : {simAnalysis.confidenceRate}%
              </div>
            </div>
          )}
        </section>

      </div>
    </main>
  );
}
