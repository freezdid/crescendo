"use client";

import { useState, useRef, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Activity, Database, Play, Sparkles, RefreshCw, ChevronRight, Trophy, 
  Target, ListOrdered, Brain, History, Settings, Calendar, Flame, 
  Snowflake, Cpu, ShieldCheck, Copy, Check, Info, TrendingUp, BarChart3,
  Layers, Zap, HelpCircle, CheckCircle2, AlertTriangle, ArrowUpRight
} from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import * as tf from '@tensorflow/tfjs';
import Link from 'next/link';

import { 
  processData, 
  createDataset, 
  buildAdvancedModel, 
  buildFastModel, 
  runBacktest, 
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
  NUM_TO_LETTER,
  LETTER_TO_NUM
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

export default function Home() {
  const [data, setData] = useState<ProcessedDraw[]>([]);
  const [stats, setStats] = useState<ComprehensiveStats | null>(null);
  const [isScraping, setIsScraping] = useState(false);
  const [isTraining, setIsTraining] = useState(false);
  const [progress, setProgress] = useState(0);
  const [scrapeStatus, setScrapeStatus] = useState("");
  const [syncStatus, setSyncStatus] = useState("Local");
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(true);

  // Strategy & Generation settings
  const [selectedStrategy, setSelectedStrategy] = useState<StrategyType>('HYBRID_AI');
  const [numGrids, setNumGrids] = useState<number>(3);
  const [generatedGrilles, setGeneratedGrilles] = useState<GrilleAnalysis[]>([]);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  // Neural training telemetry
  const [lossHistory, setLossHistory] = useState<{ epoch: number; loss: number }[]>([]);
  const [hasModel, setHasModel] = useState(false);
  const [modelReady, setModelReady] = useState(false);
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

  // References
  const tfModel = useRef<tf.LayersModel | null>(null);
  const scalerRef = useRef<any>(null);
  const lastTwelveRef = useRef<number[][] | null>(null);

  // Simulator evaluation
  const simAnalysis = useMemo(() => {
    if (simSelectedNumbers.length !== 10) return null;
    return analyzeGrille([...simSelectedNumbers, simSelectedLetter], stats || undefined);
  }, [simSelectedNumbers, simSelectedLetter, stats]);

  // Initial Load
  useEffect(() => {
    async function init() {
      // 0. TensorFlow Backend
      await initTensorFlow();
      setBackendName(tf.getBackend().toUpperCase());

      // 1. Load Local Draws
      const savedDraws = await loadDraws();
      if (savedDraws && savedDraws.length > 0) {
        setData(savedDraws);
        const comprehensive = calculateComprehensiveStats(savedDraws);
        setStats(comprehensive);
        updateModelReferences(savedDraws);

        // Pre-generate initial predictions if none exist
        const initial = generateSmartGrilles('HYBRID_AI', comprehensive, 3);
        setGeneratedGrilles(initial);
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
      const lastActive = await loadLastPrediction();
      if (lastActive && lastActive.length > 0) {
        // If we have saved active predictions, restore them
        const analyzed = lastActive.map(g => analyzeGrille(g, stats || undefined));
        setGeneratedGrilles(analyzed);
      }

      // 4. Model Check
      const exists = await hasSavedModel();
      setHasModel(exists);
      if (exists) {
        try {
          const model = await loadModel();
          if (model) {
            tfModel.current = model;
            setModelReady(true);
          }
        } catch (e) {
          console.error("Model load error:", e);
        }
      }

      // 5. Auto scrape latest
      await handleScrape(false);
      setIsInitialLoading(false);
    }

    init();
  }, []);

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
        const processed = processData(json.results);
        const isNew = processed.length > data.length;

        setData(processed);
        const computedStats = calculateComprehensiveStats(processed);
        setStats(computedStats);
        await saveDraws(processed);
        updateModelReferences(processed);

        if (!tfModel.current) {
          tfModel.current = buildAdvancedModel(windowLength, 36, 11);
          setModelReady(true);
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

  const handleTrainModel = async () => {
    if (data.length === 0) return;
    setIsTraining(true);
    setLossHistory([]);
    setProgress(0);

    let shouldBuild = !tfModel.current;
    if (tfModel.current) {
      const modelWindow = tfModel.current.inputs[0].shape[1];
      if (modelWindow !== windowLength) shouldBuild = true;
    }

    if (shouldBuild) {
      tfModel.current = trainingMode === 'precise'
        ? buildAdvancedModel(windowLength, 36, 11)
        : buildFastModel(windowLength, 36, 11);
    }

    const { X, Y } = createDataset(data, windowLength);
    if (X.length === 0 || Y.length === 0) {
      setIsTraining(false);
      return;
    }

    const config = TRAINING_CONFIG[trainingMode];
    const xs = tf.tensor3d(X);
    const ys = tf.tensor2d(Y);
    const epochs = config.epochs;

    try {
      await tfModel.current!.fit(xs, ys, {
        epochs,
        batchSize: config.batchSize,
        shuffle: true,
        callbacks: {
          onEpochEnd: (epoch, logs) => {
            setProgress(Math.round(((epoch + 1) / epochs) * 100));
            if (logs) setLossHistory(prev => [...prev, { epoch: epoch + 1, loss: Number(logs.loss.toFixed(4)) }]);
          }
        }
      });

      await saveModel(tfModel.current!);
      setHasModel(true);
      setModelReady(true);
    } catch (e) {
      console.error("Training error:", e);
    } finally {
      xs.dispose();
      ys.dispose();
      setIsTraining(false);
    }

    // Trigger high-grade generation post training
    await handleGenerateCombinations();
  };

  // Main Generation Handler combining Neural Network & Statistical Engine
  const handleGenerateCombinations = async () => {
    if (!stats) return;
    setIsOptimizing(true);

    let neuralCandidates: number[][] = [];

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

            // Clamp numbers 1-25 and letter 1-6
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

    // Generate through multi-strategy engine
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

  return (
    <main className="min-h-screen text-slate-100 flex flex-col pb-24">
      {/* Top Header & Quantum Telemetry */}
      <header className="sticky top-0 z-50 border-b border-white/[0.08] bg-[#07080c]/90 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between gap-4">
          
          {/* Logo & Brand */}
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-amber-400 via-amber-500 to-amber-700 p-0.5 shadow-lg shadow-amber-500/20 flex items-center justify-center">
              <div className="w-full h-full bg-[#0b0e17] rounded-[0.875rem] flex items-center justify-center">
                <Brain className="w-6 h-6 text-amber-400 animate-pulse" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-xl tracking-tight text-white">CRESCENDO</span>
                <span className="bg-gradient-to-r from-amber-400 to-amber-200 bg-clip-text text-transparent font-black tracking-wider text-xl">QUANTUM</span>
                <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
                  v2.5 Pro
                </span>
              </div>
              <p className="text-xs text-slate-400 hidden sm:block">Laboratoire d&apos;Analyse Probabiliste & Réseaux Neuronaux</p>
            </div>
          </div>

          {/* Center Nav */}
          <nav className="hidden md:flex items-center gap-1 bg-white/[0.03] border border-white/[0.06] rounded-2xl p-1">
            <Link 
              href="/" 
              className="px-4 py-2 rounded-xl text-sm font-semibold bg-white/[0.08] text-white flex items-center gap-2 shadow-sm"
            >
              <Sparkles className="w-4 h-4 text-amber-400" /> Laboratoire
            </Link>
            <Link 
              href="/history" 
              className="px-4 py-2 rounded-xl text-sm font-medium text-slate-400 hover:text-white hover:bg-white/[0.04] transition-all flex items-center gap-2"
            >
              <History className="w-4 h-4" /> Archives ({data.length})
            </Link>
            <Link 
              href="/journal" 
              className="px-4 py-2 rounded-xl text-sm font-medium text-slate-400 hover:text-white hover:bg-white/[0.04] transition-all flex items-center gap-2"
            >
              <Trophy className="w-4 h-4" /> Journal des Gains
            </Link>
          </nav>

          {/* Right Status Badges & Refresh */}
          <div className="flex items-center gap-3">
            <div className="hidden lg:flex items-center gap-2 bg-[#0d121e] border border-white/[0.08] px-3.5 py-1.5 rounded-xl text-xs font-medium">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span className="text-slate-400">Moteur:</span>
              <span className="text-slate-200 font-semibold">{backendName}</span>
            </div>

            <button
              onClick={() => handleScrape(false)}
              disabled={isScraping}
              className="btn-ghost-dark text-xs py-2 px-3 sm:px-4"
              title="Actualiser les tirages"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-amber-400 ${isScraping ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Synchroniser</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 flex flex-col gap-8">
        
        {/* Banner Alert if Status Notification */}
        <AnimatePresence>
          {scrapeStatus && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="luxury-panel p-3.5 flex items-center justify-between border-amber-500/30 bg-amber-500/10 text-amber-200 text-sm font-medium"
            >
              <div className="flex items-center gap-2.5">
                <Sparkles className="w-4 h-4 text-amber-400" />
                <span>{scrapeStatus}</span>
              </div>
              <span className="text-xs text-amber-400/80">{data.length} tirages en base locale</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* HERO GENERATOR COCKPIT */}
        <section className="luxury-panel p-6 sm:p-8 relative overflow-hidden border-glow-gold/40">
          <div className="absolute -right-20 -top-20 w-80 h-80 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -left-20 -bottom-20 w-80 h-80 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

          <div className="relative z-10 flex flex-col gap-6">
            
            {/* Headline */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
              <div className="space-y-1.5">
                <div className="flex items-center gap-2 text-amber-400 text-xs font-bold uppercase tracking-widest">
                  <Zap className="w-3.5 h-3.5" />
                  Générateur Quantique de Suites Gagnantes
                </div>
                <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white">
                  Numéros Optimaux du Jour
                </h1>
                <p className="text-slate-400 text-sm max-w-2xl">
                  Calcul statistique multi-dimensionnel combinant la loi de Poisson, les fréquences d&apos;apparition, les écarts critiques et l&apos;architecture neuronale LSTM.
                </p>
              </div>

              {/* Stats Summary Counter */}
              <div className="flex items-center gap-3 bg-[#0c101a] border border-white/[0.08] px-4 py-2.5 rounded-2xl">
                <div>
                  <div className="text-[11px] uppercase font-bold text-slate-400">Base d&apos;Apprentissage</div>
                  <div className="text-lg font-black text-white">{data.length} Tirages Réels</div>
                </div>
                <div className="h-8 w-px bg-white/10" />
                <div>
                  <div className="text-[11px] uppercase font-bold text-slate-400">Probabilité d&apos;Échantillon</div>
                  <div className="text-lg font-black text-amber-400">40% / Tirage</div>
                </div>
              </div>
            </div>

            {/* Strategy Selection Deck */}
            <div className="space-y-2.5">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Target className="w-3.5 h-3.5 text-amber-400" />
                Sélectionnez la Stratégie Algorithmique
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                {(Object.keys(STRATEGY_CONFIG) as StrategyType[]).map((strat) => {
                  const item = STRATEGY_CONFIG[strat];
                  const isSelected = selectedStrategy === strat;
                  
                  return (
                    <button
                      key={strat}
                      onClick={() => setSelectedStrategy(strat)}
                      className={`p-3.5 rounded-xl border text-left transition-all relative flex flex-col justify-between gap-2 ${
                        isSelected 
                          ? 'bg-amber-500/15 border-amber-500/60 shadow-lg shadow-amber-500/10' 
                          : 'bg-white/[0.02] border-white/[0.07] hover:bg-white/[0.05] hover:border-white/[0.15]'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className={`text-xs font-black uppercase tracking-wider px-2 py-0.5 rounded-md ${
                          isSelected ? 'bg-amber-400 text-slate-950' : 'bg-white/10 text-slate-300'
                        }`}>
                          {item.badge}
                        </span>
                        {isSelected && <CheckCircle2 className="w-4 h-4 text-amber-400 shrink-0" />}
                      </div>

                      <div>
                        <div className={`font-bold text-sm ${isSelected ? 'text-white' : 'text-slate-200'}`}>
                          {item.label}
                        </div>
                        <p className="text-[11px] text-slate-400 leading-snug mt-1 line-clamp-2">
                          {item.desc}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Controls Row: Grid Count + Actions */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 pt-2 border-t border-white/[0.06]">
              
              {/* Number of grids */}
              <div className="flex items-center gap-3">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Nombre de Grilles :
                </span>
                <div className="flex items-center gap-1.5 bg-black/30 p-1 rounded-xl border border-white/[0.08]">
                  {[1, 3, 5, 10].map((n) => (
                    <button
                      key={n}
                      onClick={() => setNumGrids(n)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                        numGrids === n
                          ? 'bg-amber-500 text-slate-950 shadow-md'
                          : 'text-slate-400 hover:text-white hover:bg-white/[0.05]'
                      }`}
                    >
                      {n} {n === 1 ? 'Grille' : 'Grilles'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-3">
                <button
                  onClick={handleTrainModel}
                  disabled={isTraining || isOptimizing || data.length === 0}
                  className="btn-ghost-dark text-xs py-3 px-4 flex-1 sm:flex-none"
                  title="Entraîne le réseau neuronal sur l'historique"
                >
                  <Brain className={`w-4 h-4 text-cyan-400 ${isTraining ? 'animate-bounce' : ''}`} />
                  <span>{isTraining ? `Entraînement ${progress}%...` : 'Ré-entraîner IA'}</span>
                </button>

                <button
                  onClick={handleGenerateCombinations}
                  disabled={isOptimizing || isTraining}
                  className="btn-gold flex-1 sm:flex-none text-sm py-3 px-6 shadow-xl"
                >
                  <Sparkles className={`w-4 h-4 text-slate-950 ${isOptimizing ? 'animate-spin' : ''}`} />
                  <span>{isOptimizing ? 'Calcul Quantique...' : 'Générer les Grilles du Jour'}</span>
                </button>
              </div>
            </div>

            {/* Progress Bar for Neural Training */}
            {isTraining && (
              <div className="w-full bg-slate-900 h-2 rounded-full overflow-hidden border border-white/10 mt-2">
                <motion.div 
                  className="h-full bg-gradient-to-r from-cyan-500 via-amber-400 to-amber-500"
                  initial={{ width: 0 }}
                  animate={{ width: `${progress}%` }}
                  transition={{ ease: "easeOut" }}
                />
              </div>
            )}
          </div>
        </section>

        {/* RESULTS SECTION: GENERATED GRIDS */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-black tracking-tight text-white uppercase">
                Combinaisons Recommandées
              </h2>
              <span className="bg-amber-500/20 text-amber-300 font-bold text-xs px-2.5 py-0.5 rounded-full border border-amber-500/30">
                {generatedGrilles.length} Prêtes à Jouer
              </span>
            </div>

            <div className="text-xs text-slate-400">
              Générées avec <span className="text-amber-400 font-semibold">{STRATEGY_CONFIG[selectedStrategy].label}</span>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4">
            {generatedGrilles.map((analysis, idx) => {
              const isCopied = copiedIndex === idx;

              return (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  className="luxury-panel luxury-panel-interactive p-5 sm:p-6 flex flex-col gap-4 border-white/[0.08]"
                >
                  {/* Grid Header */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-white/[0.06]">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-amber-500/20 to-amber-700/20 border border-amber-500/30 flex items-center justify-center font-black text-amber-400 text-sm">
                        #{idx + 1}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-extrabold text-white text-base">Grille Gagnante Potentielle</span>
                          <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            Score IA : {analysis.overallScore}/100
                          </span>
                        </div>
                        <p className="text-xs text-slate-400">
                          Indice de Confiance Mathématique : <strong className="text-amber-400">{analysis.confidenceRate}%</strong>
                        </p>
                      </div>
                    </div>

                    {/* Quick Copy Button */}
                    <button
                      onClick={() => handleCopyGrille(analysis, idx)}
                      className={`btn-ghost-dark text-xs py-2 px-3 self-start sm:self-auto ${
                        isCopied ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300' : ''
                      }`}
                    >
                      {isCopied ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                          <span>Copié dans le presse-papier</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5 text-slate-400" />
                          <span>Copier la Grille</span>
                        </>
                      )}
                    </button>
                  </div>

                  {/* Balls Display: 10 Main Numbers + 1 Letter */}
                  <div className="flex flex-wrap items-center gap-2 sm:gap-3 py-1">
                    {analysis.mainNumbers.map((num) => {
                      const numStat = stats?.numberStats[num];
                      const isHot = numStat?.temperature === 'hot';
                      const isOverdue = numStat?.temperature === 'overdue';

                      let ballClass = "ball-3d";
                      if (isHot) ballClass = "ball-3d ball-3d-gold";
                      else if (isOverdue) ballClass = "ball-3d ball-3d-emerald";

                      return (
                        <div key={num} className="flex flex-col items-center gap-1 group">
                          <div className={ballClass} title={`Numéro ${num} (${numStat?.temperature || 'normal'})`}>
                            {num}
                          </div>
                          <span className="text-[10px] text-slate-400 font-semibold opacity-0 group-hover:opacity-100 transition-opacity">
                            {numStat ? `${numStat.currentDelay}j ret.` : ''}
                          </span>
                        </div>
                      );
                    })}

                    {/* Separator */}
                    <div className="h-10 w-px bg-white/10 mx-1 hidden sm:block" />

                    {/* Letter Badge */}
                    <div className="flex flex-col items-center gap-1">
                      <div className="letter-badge-3d" title={`Lettre SAMEDI recommandée : ${analysis.letterChar}`}>
                        {analysis.letterChar}
                      </div>
                      <span className="text-[10px] font-bold text-amber-400 uppercase tracking-widest">
                        Bonus
                      </span>
                    </div>
                  </div>

                  {/* Mathematical GTO Breakdown Chips */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 text-xs">
                    <div className="bg-white/[0.02] border border-white/[0.06] p-2.5 rounded-xl">
                      <div className="text-slate-400 text-[11px]">Somme Totale</div>
                      <div className="font-extrabold text-white text-sm flex items-center justify-between">
                        <span>{analysis.sum}</span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${
                          analysis.sumStatus === 'Optimal' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-slate-700 text-slate-300'
                        }`}>
                          {analysis.sumStatus}
                        </span>
                      </div>
                    </div>

                    <div className="bg-white/[0.02] border border-white/[0.06] p-2.5 rounded-xl">
                      <div className="text-slate-400 text-[11px]">Parité (P / I)</div>
                      <div className="font-extrabold text-white text-sm flex items-center justify-between">
                        <span>{analysis.evens}P / {analysis.odds}I</span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${
                          analysis.parityStatus === 'Équilibré' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-amber-500/20 text-amber-300'
                        }`}>
                          {analysis.parityStatus}
                        </span>
                      </div>
                    </div>

                    <div className="bg-white/[0.02] border border-white/[0.06] p-2.5 rounded-xl">
                      <div className="text-slate-400 text-[11px]">Étalement (Bas / Hauts)</div>
                      <div className="font-extrabold text-white text-sm flex items-center justify-between">
                        <span>{analysis.lows}B / {analysis.highs}H</span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${
                          analysis.lowHighStatus === 'Équilibré' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-slate-700 text-slate-300'
                        }`}>
                          {analysis.lowHighStatus}
                        </span>
                      </div>
                    </div>

                    <div className="bg-white/[0.02] border border-white/[0.06] p-2.5 rounded-xl">
                      <div className="text-slate-400 text-[11px]">Affinité Intra-Grille</div>
                      <div className="font-extrabold text-white text-sm flex items-center justify-between">
                        <span>{analysis.affinityScore}%</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded font-bold bg-cyan-500/20 text-cyan-300">
                          Co-occurrence
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* AI Explanation / Reasoning Box */}
                  <div className="bg-[#0b0e17] border border-white/[0.06] p-3 rounded-xl flex flex-col gap-1 text-xs">
                    <div className="font-bold text-slate-300 flex items-center gap-1.5">
                      <Info className="w-3.5 h-3.5 text-amber-400" />
                      Justification Algorithmique :
                    </div>
                    <ul className="list-disc list-inside space-y-0.5 text-slate-400">
                      {analysis.explanations.map((exp, i) => (
                        <li key={i}>{exp}</li>
                      ))}
                    </ul>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </section>

        {/* 25-BALL INTERACTIVE MATRIX & HEATMAP */}
        {stats && (
          <section className="luxury-panel p-6 sm:p-8 flex flex-col gap-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-xl font-black text-white tracking-tight flex items-center gap-2">
                  <Flame className="w-5 h-5 text-amber-500" />
                  Matrice Statistique des 25 Numéros
                </h3>
                <p className="text-xs text-slate-400">
                  Cadence, écarts actuels et indices de rebond de Poisson calculés sur l&apos;ensemble des tirages.
                </p>
              </div>

              {/* Legend */}
              <div className="flex flex-wrap items-center gap-3 text-xs">
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-amber-500" />
                  <span className="text-slate-300">Surchauffe</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-emerald-500" />
                  <span className="text-slate-300">Retard Critique</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-slate-400" />
                  <span className="text-slate-300">Régulier</span>
                </div>
              </div>
            </div>

            {/* 5x5 Board */}
            <div className="grid grid-cols-5 sm:grid-cols-5 md:grid-cols-5 gap-3">
              {Array.from({ length: 25 }, (_, i) => i + 1).map((num) => {
                const s = stats.numberStats[num];
                const isSelected = selectedBallForDetail === num;
                const isHot = s?.temperature === 'hot';
                const isOverdue = s?.temperature === 'overdue';

                return (
                  <button
                    key={num}
                    onClick={() => setSelectedBallForDetail(isSelected ? null : num)}
                    className={`p-3 rounded-2xl border text-center transition-all flex flex-col items-center gap-2 ${
                      isSelected 
                        ? 'bg-amber-500/20 border-amber-400 shadow-lg shadow-amber-500/20' 
                        : isHot 
                          ? 'bg-amber-500/[0.08] border-amber-500/30 hover:border-amber-500/60' 
                          : isOverdue 
                            ? 'bg-emerald-500/[0.08] border-emerald-500/30 hover:border-emerald-500/60' 
                            : 'bg-white/[0.02] border-white/[0.06] hover:bg-white/[0.06]'
                    }`}
                  >
                    <div className={isHot ? "ball-3d ball-3d-gold" : isOverdue ? "ball-3d ball-3d-emerald" : "ball-3d"}>
                      {num}
                    </div>

                    <div className="space-y-0.5">
                      <div className="text-[11px] font-bold text-white">
                        {s?.frequency}% <span className="text-slate-400 font-normal">({s?.count})</span>
                      </div>
                      <div className="text-[10px] text-slate-400">
                        Écart : <strong className={isOverdue ? "text-emerald-400" : "text-slate-300"}>{s?.currentDelay} tir.</strong>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Modal / Detail Drawer for selected ball */}
            <AnimatePresence>
              {selectedBallForDetail !== null && stats.numberStats[selectedBallForDetail] && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="bg-[#0b0e17] border border-amber-500/40 rounded-2xl p-5 flex flex-col sm:flex-row items-center justify-between gap-6"
                >
                  <div className="flex items-center gap-4">
                    <div className="ball-3d ball-3d-gold w-14 h-14 text-xl">
                      {selectedBallForDetail}
                    </div>
                    <div>
                      <div className="text-lg font-black text-white flex items-center gap-2">
                        Fiche Technique Numéro {selectedBallForDetail}
                        <span className="text-xs px-2 py-0.5 rounded font-bold uppercase bg-amber-500/20 text-amber-300 border border-amber-500/30">
                          {stats.numberStats[selectedBallForDetail].temperature}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400">
                        Présent dans {stats.numberStats[selectedBallForDetail].count} tirages sur {stats.totalDraws} ({stats.numberStats[selectedBallForDetail].frequency}%).
                        Écart actuel : {stats.numberStats[selectedBallForDetail].currentDelay} tirages (Écart max historique : {stats.numberStats[selectedBallForDetail].maxDelay}).
                      </p>
                    </div>
                  </div>

                  {/* Top Partners */}
                  <div className="flex flex-col gap-1 text-xs">
                    <span className="font-bold text-slate-300">Meilleurs Partenaires de Co-Occurrence :</span>
                    <div className="flex items-center gap-2">
                      {stats.numberStats[selectedBallForDetail].affinityPartners.map(p => (
                        <div key={p.num} className="bg-white/5 border border-white/10 px-2 py-1 rounded-lg text-center">
                          <span className="font-black text-amber-400">{p.num}</span>
                          <span className="text-[10px] text-slate-400 block">{p.score}%</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </section>
        )}

        {/* LETTER SAMEDI QUANTUM RADAR */}
        {stats && (
          <section className="luxury-panel p-6 sm:p-8 flex flex-col gap-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="text-xl font-black text-white tracking-tight flex items-center gap-2">
                  <Trophy className="w-5 h-5 text-amber-500" />
                  Probabilités des Lettres SAMEDI
                </h3>
                <p className="text-xs text-slate-400">
                  Évaluation probabiliste de chaque lettre bonus basée sur les fréquences historiques et cycles de retour.
                </p>
              </div>

              <div className="text-xs text-amber-400 font-bold">
                Recommandation n°1 : Lettre {stats.topLetters[0]?.letter} ({stats.topLetters[0]?.prob}%)
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              {stats.topLetters.map((l, idx) => (
                <div 
                  key={l.letter} 
                  className={`p-4 rounded-2xl border text-center flex flex-col items-center gap-2 transition-all ${
                    idx === 0 
                      ? 'bg-amber-500/15 border-amber-500/60 shadow-lg shadow-amber-500/10' 
                      : 'bg-white/[0.02] border-white/[0.06]'
                  }`}
                >
                  <div className="letter-badge-3d">
                    {l.letter}
                  </div>

                  <div className="space-y-0.5">
                    <div className="text-base font-black text-white">
                      {l.prob}% <span className="text-xs font-normal text-slate-400">prob.</span>
                    </div>
                    <div className="text-[11px] text-slate-400">
                      Sortie : {l.frequency}% ({l.count})
                    </div>
                    <div className="text-[10px] text-slate-400">
                      Écart : <strong className="text-amber-400">{l.currentDelay} tirages</strong>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* INTERACTIVE GRID SIMULATOR & AUDITOR */}
        <section className="luxury-panel p-6 sm:p-8 flex flex-col gap-6">
          <div className="space-y-1">
            <h3 className="text-xl font-black text-white tracking-tight flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-cyan-400" />
              Simulateur & Diagnostic de Vos Numéros
            </h3>
            <p className="text-xs text-slate-400">
              Composez ou testez une suite de 10 numéros pour obtenir son indice de performance GTO immédiat.
            </p>
          </div>

          {/* Interactive Picker 1-25 */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between text-xs text-slate-300 font-bold">
              <span>Numéros Sélectionnés : {simSelectedNumbers.length} / 10</span>
              <button 
                onClick={() => setSimSelectedNumbers([])}
                className="text-amber-400 hover:underline"
              >
                Réinitialiser la sélection
              </button>
            </div>

            <div className="flex flex-wrap gap-2">
              {Array.from({ length: 25 }, (_, i) => i + 1).map((n) => {
                const isSelected = simSelectedNumbers.includes(n);
                return (
                  <button
                    key={n}
                    onClick={() => toggleSimNumber(n)}
                    className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl font-extrabold text-xs transition-all ${
                      isSelected
                        ? 'bg-amber-400 text-slate-950 font-black shadow-lg shadow-amber-400/30 scale-105'
                        : 'bg-white/[0.04] border border-white/[0.08] text-slate-300 hover:bg-white/[0.1]'
                    }`}
                  >
                    {n}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Letter Picker */}
          <div className="flex items-center gap-3">
            <span className="text-xs font-bold text-slate-400">Lettre SAMEDI :</span>
            <div className="flex items-center gap-2">
              {SAMEDI_LETTERS.map((char, idx) => (
                <button
                  key={char}
                  onClick={() => setSimSelectedLetter(idx + 1)}
                  className={`w-8 h-8 rounded-lg font-black text-xs transition-all ${
                    simSelectedLetter === idx + 1
                      ? 'bg-amber-400 text-slate-950 shadow-md'
                      : 'bg-white/[0.04] text-slate-400 border border-white/[0.08] hover:text-white'
                  }`}
                >
                  {char}
                </button>
              ))}
            </div>
          </div>

          {/* Simulator Diagnostic Card */}
          {simAnalysis && (
            <div className="bg-[#0b0e17] border border-white/[0.08] rounded-2xl p-5 flex flex-col gap-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="text-2xl font-black text-amber-400">
                    {simAnalysis.overallScore}/100
                  </div>
                  <div>
                    <div className="font-extrabold text-white text-sm">Score d&apos;Équilibre Probabiliste</div>
                    <div className="text-xs text-slate-400">
                      Confiance calculée : <strong className="text-emerald-400">{simAnalysis.confidenceRate}%</strong>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 text-xs">
                  <span className={`px-2 py-1 rounded font-bold ${
                    simAnalysis.sumStatus === 'Optimal' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-amber-500/20 text-amber-300'
                  }`}>
                    Somme : {simAnalysis.sum} ({simAnalysis.sumStatus})
                  </span>
                  <span className={`px-2 py-1 rounded font-bold ${
                    simAnalysis.parityStatus === 'Équilibré' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-slate-700 text-slate-300'
                  }`}>
                    {simAnalysis.evens}P / {simAnalysis.odds}I
                  </span>
                </div>
              </div>

              <div className="text-xs text-slate-400">
                <strong className="text-slate-300">Analyse de la combinaison :</strong>
                <ul className="list-disc list-inside mt-1 space-y-0.5">
                  {simAnalysis.explanations.map((exp, i) => (
                    <li key={i}>{exp}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </section>

        {/* NEURAL NETWORK TRAINING & BACKTEST TELEMETRY */}
        <section className="luxury-panel p-6 sm:p-8 flex flex-col gap-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-xl font-black text-white tracking-tight flex items-center gap-2">
                <Activity className="w-5 h-5 text-cyan-400" />
                Télémétrie Neuronale & Backtesting
              </h3>
              <p className="text-xs text-slate-400">
                Supervisez la convergence du réseau de neurones LSTM et validez les taux de réussite sur les tirages récents.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={handleRunBacktest}
                disabled={isBacktesting || data.length < 30}
                className="btn-ghost-dark text-xs py-2 px-4"
              >
                <TrendingUp className="w-3.5 h-3.5 text-cyan-400" />
                <span>{isBacktesting ? "Simulation en cours..." : "Lancer Backtest (35 tirages)"}</span>
              </button>
            </div>
          </div>

          {/* Backtest Results Display */}
          {backtestStats && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-[#0b0e17] border border-cyan-500/30 p-4 rounded-2xl">
              <div>
                <div className="text-[11px] text-slate-400 font-bold uppercase">Moyenne Bons Numéros</div>
                <div className="text-xl font-black text-white">{backtestStats.avgHits} / 10</div>
              </div>
              <div>
                <div className="text-[11px] text-slate-400 font-bold uppercase">Taux de Réussite &ge; 6 Nums</div>
                <div className="text-xl font-black text-emerald-400">{backtestStats.highWinRate}%</div>
              </div>
              <div>
                <div className="text-[11px] text-slate-400 font-bold uppercase">Correspondance Lettre</div>
                <div className="text-xl font-black text-amber-400">{backtestStats.letterMatchRate}%</div>
              </div>
              <div>
                <div className="text-[11px] text-slate-400 font-bold uppercase">Fréquence Gros Gains (&ge;8)</div>
                <div className="text-xl font-black text-cyan-400">{backtestStats.jackpotCloseRate}%</div>
              </div>
            </div>
          )}

          {/* Loss Curve Chart */}
          {lossHistory.length > 0 && (
            <div className="h-56 w-full pt-4">
              <div className="text-xs font-bold text-slate-400 mb-2">Courbe d&apos;Apprentissage (Perte MAE) :</div>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={lossHistory}>
                  <XAxis dataKey="epoch" stroke="#64748b" fontSize={11} />
                  <YAxis stroke="#64748b" fontSize={11} domain={['auto', 'auto']} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '0.75rem', fontSize: '12px' }} 
                  />
                  <Line 
                    type="monotone" 
                    dataKey="loss" 
                    stroke="#f59e0b" 
                    strokeWidth={2.5} 
                    dot={false} 
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </section>

      </div>
    </main>
  );
}
