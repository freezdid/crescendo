"use client";

import { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { ChevronLeft, Brain, AlertCircle, Sparkles, RefreshCw, Award, Coins } from 'lucide-react';
import Link from 'next/link';
import { loadDraws, loadPredictions, savePredictions, SavedPrediction } from '@/lib/storage';
import { ProcessedDraw } from '@/lib/pipeline';
import { NUM_TO_LETTER, extractNumbersAndLetter } from '@/lib/stats';

export default function JournalPage() {
  const [data, setData] = useState<ProcessedDraw[]>([]);
  const [predictions, setPredictions] = useState<SavedPrediction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function init() {
      // 1. Load Local
      const draws = await loadDraws();
      const preds = await loadPredictions();
      if (draws) setData(draws);
      if (preds) setPredictions(preds);

      // 2. Load Cloud
      try {
        const timestamp = Date.now();
        const controller = new AbortController();
        const id = setTimeout(() => controller.abort(), 8000);

        if (!draws || draws.length === 0) {
          const resDraws = await fetch(`/api/sync?type=draws&t=${timestamp}`, { cache: 'no-store', signal: controller.signal });
          const jsonDraws = await resDraws.json();
          if (jsonDraws.success && jsonDraws.data) {
            setData(jsonDraws.data);
          }
        }

        const res = await fetch(`/api/sync?type=predictions&t=${timestamp}`, { cache: 'no-store', signal: controller.signal });
        const json = await res.json();
        clearTimeout(id);

        if (json.success && json.data && Array.isArray(json.data) && json.data.length > 0) {
          const cloudPreds = json.data as SavedPrediction[];
          setPredictions(prevLocal => {
            const combined = [...cloudPreds];
            prevLocal.forEach(p => {
              if (!combined.find(c => c.timestamp === p.timestamp)) {
                combined.push(p);
              }
            });
            const sorted = combined.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).slice(0, 50);
            savePredictions(sorted);
            return sorted;
          });
        }
      } catch (e) {
        console.warn("Sync journal notice:", e);
      }

      setLoading(false);
    }
    init();
  }, []);

  const checkMatch = (pred: number[], draw: ProcessedDraw) => {
    const predNums = pred.slice(0, 10);
    const predLetter = pred[10];

    const { nums: drawNums, letterNum: drawLetter } = extractNumbersAndLetter(draw);

    const matchedNums = predNums.filter(n => drawNums.includes(n));
    const matchedLetter = predLetter === drawLetter;

    return {
      nums: matchedNums.length,
      letter: matchedLetter,
      matchedList: matchedNums
    };
  };

  const getResultsForPrediction = (pred: SavedPrediction) => {
    const predTime = new Date(pred.timestamp).getTime();
    const laterDraws = data.filter(d => d.fullDate > predTime).sort((a, b) => a.fullDate - b.fullDate);

    if (laterDraws.length === 0) return null;

    const nextDraw = laterDraws[0];
    const scores = pred.grilles.map(g => checkMatch(g, nextDraw));
    const bestScore = scores.reduce((prev, current) => (current.nums > prev.nums ? current : prev), scores[0]);

    return {
      draw: nextDraw,
      bestScore,
      allScores: scores
    };
  };

  const calculateGain = (nums: number, letter: boolean): { amount: string; isJackpot: boolean; val: number } | null => {
    if (nums === 10 && letter) return { amount: "JACKPOT MAJEUR", isJackpot: true, val: 50000 };
    if (nums === 10) return { amount: "JACKPOT 10/10", isJackpot: true, val: 10000 };
    if (nums === 9 && letter) return { amount: "1 000 €", isJackpot: false, val: 1000 };
    if (nums === 9) return { amount: "500 €", isJackpot: false, val: 500 };
    if (nums === 8 && letter) return { amount: "100 €", isJackpot: false, val: 100 };
    if (nums === 8) return { amount: "50 €", isJackpot: false, val: 50 };
    if (nums === 7 && letter) return { amount: "14 €", isJackpot: false, val: 14 };
    if (nums === 7) return { amount: "7 €", isJackpot: false, val: 7 };
    if (nums === 6 && letter) return { amount: "2 €", isJackpot: false, val: 2 };
    if (nums === 6) return { amount: "1 €", isJackpot: false, val: 1 };
    if (letter) return { amount: "1 €", isJackpot: false, val: 1 };
    return null;
  };

  // Cumulative metrics
  const cumulativeStats = useMemo(() => {
    let testedCount = 0;
    let totalWinsVal = 0;
    let winningGrids = 0;
    let highestHits = 0;

    predictions.forEach(pred => {
      const res = getResultsForPrediction(pred);
      if (res) {
        testedCount++;
        if (res.bestScore.nums > highestHits) highestHits = res.bestScore.nums;
        const gain = calculateGain(res.bestScore.nums, res.bestScore.letter);
        if (gain) {
          winningGrids++;
          totalWinsVal += gain.val;
        }
      }
    });

    return {
      testedCount,
      totalWinsVal,
      winningRate: testedCount > 0 ? ((winningGrids / testedCount) * 100).toFixed(1) : "0.0",
      highestHits
    };
  }, [predictions, data]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#07080c] text-white flex flex-col items-center justify-center gap-3">
        <Sparkles className="w-8 h-8 text-amber-400 animate-spin" />
        <span className="text-sm font-bold uppercase tracking-wider text-slate-400">
          Calcul des performances et gains réels...
        </span>
      </div>
    );
  }

  return (
    <main className="min-h-screen text-slate-100 p-4 sm:p-8 lg:p-12 flex flex-col gap-8 max-w-6xl mx-auto">
      
      {/* Top Nav */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <Link 
          href="/" 
          className="inline-flex items-center gap-2 text-slate-400 hover:text-amber-400 transition-colors text-xs font-bold uppercase tracking-widest"
        >
          <ChevronLeft className="w-4 h-4" /> Retour au Laboratoire IA
        </Link>

        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="btn-gold text-xs py-2 px-4 shadow-lg"
          >
            <Brain className="w-4 h-4 text-slate-950" />
            <span>Nouveau Calcul IA</span>
          </Link>
          <button
            onClick={() => window.location.reload()}
            className="btn-ghost-dark text-xs py-2 px-3"
            title="Rafraîchir"
          >
            <RefreshCw className="w-3.5 h-3.5 text-slate-400" />
          </button>
        </div>
      </header>

      {/* Main Title & Overview */}
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-amber-400 text-xs font-bold uppercase tracking-widest">
          <Award className="w-4 h-4" />
          Audit de Rentabilité & Suivi des Prédictions
        </div>
        <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-white">
          JOURNAL DES <span className="text-amber-400">RÉSULTATS</span>
        </h1>
        <p className="text-slate-400 text-sm max-w-2xl">
          Confrontation automatisée de chaque grille générée face aux tirages réels suivants, avec calcul des combinaisons gagnantes et des paliers de gains officiels.
        </p>
      </div>

      {/* Cumulative Performance Bento */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="luxury-panel p-4 flex flex-col gap-1">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Sessions Auditées</span>
          <div className="text-2xl font-black text-white">{cumulativeStats.testedCount} / {predictions.length}</div>
        </div>
        <div className="luxury-panel p-4 flex flex-col gap-1">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Taux de Grilles Gagnantes</span>
          <div className="text-2xl font-black text-emerald-400">{cumulativeStats.winningRate}%</div>
        </div>
        <div className="luxury-panel p-4 flex flex-col gap-1">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Meilleure Touche</span>
          <div className="text-2xl font-black text-amber-400">{cumulativeStats.highestHits} / 10 Bons Nums</div>
        </div>
        <div className="luxury-panel p-4 flex flex-col gap-1">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Gains Simulés Détectés</span>
          <div className="text-2xl font-black text-cyan-400">{cumulativeStats.totalWinsVal} €</div>
        </div>
      </div>

      {/* Predictions Audit List */}
      {predictions.length === 0 ? (
        <div className="luxury-panel p-12 text-center flex flex-col items-center gap-4">
          <AlertCircle className="w-12 h-12 text-slate-600" />
          <div className="font-bold text-white text-lg">Aucun pronostic enregistré dans le journal</div>
          <p className="text-xs text-slate-400 max-w-sm">
            Rendez-vous dans le laboratoire pour générer et enregistrer vos premières grilles avec le moteur quantique.
          </p>
          <Link href="/" className="btn-gold text-xs py-2.5 px-6">
            Générer une Grille Maintenant
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {predictions.map((pred, idx) => {
            const result = getResultsForPrediction(pred);
            const gain = result ? calculateGain(result.bestScore.nums, result.bestScore.letter) : null;
            const predDate = new Date(pred.timestamp);

            return (
              <motion.div
                key={pred.timestamp || idx}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(0.2, idx * 0.03) }}
                className="luxury-panel p-5 sm:p-6 flex flex-col gap-4 border-white/[0.08]"
              >
                {/* Header Date & Prediction Number */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-white/[0.06]">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center font-black text-amber-400 text-xs">
                      #{predictions.length - idx}
                    </div>
                    <div>
                      <div className="text-sm font-bold text-white">
                        Session Prédictive du {predDate.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                      </div>
                      <div className="text-xs text-slate-400">
                        {predDate.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })} • {pred.grilles.length} combinaison(s) générée(s)
                      </div>
                    </div>
                  </div>

                  {/* Outcome Tag */}
                  <div>
                    {result ? (
                      gain ? (
                        <span className="px-3 py-1 rounded-full text-xs font-black bg-gradient-to-r from-amber-400 to-amber-500 text-slate-950 shadow-md uppercase tracking-wider flex items-center gap-1.5">
                          <Coins className="w-3.5 h-3.5" />
                          Gain Estimé : {gain.amount}
                        </span>
                      ) : (
                        <span className="px-3 py-1 rounded-full text-xs font-bold bg-white/[0.04] text-slate-400 border border-white/[0.08]">
                          Non Primé (Prochain Tirage)
                        </span>
                      )
                    ) : (
                      <span className="px-3 py-1 rounded-full text-xs font-bold bg-cyan-500/10 text-cyan-300 border border-cyan-500/30 flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 animate-spin text-cyan-400" />
                        En Attente du Tirage Officiel
                      </span>
                    )}
                  </div>
                </div>

                {/* Main Prediction Balls */}
                <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-6">
                  
                  {/* Left: Your Numbers */}
                  <div className="space-y-2 flex-1">
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                      Combinaison Principale Recommandée par l&apos;IA :
                    </span>
                    <div className="flex flex-wrap items-center gap-2">
                      {pred.grilles?.[0]?.map((num, i) => {
                        const isLetter = i === 10;
                        const isHit = result?.bestScore.matchedList.includes(num);

                        if (isLetter) {
                          const letterChar = NUM_TO_LETTER[num] || 'S';
                          const letterHit = result?.bestScore.letter;
                          return (
                            <div 
                              key={i} 
                              className={`letter-badge-3d w-9 h-9 text-xs font-black ${
                                letterHit ? 'ring-2 ring-emerald-400 shadow-emerald-500/50' : ''
                              }`}
                              title={`Lettre ${letterChar}`}
                            >
                              {letterChar}
                            </div>
                          );
                        }

                        return (
                          <div
                            key={i}
                            className={`ball-3d w-9 h-9 text-xs font-black ${
                              isHit 
                                ? 'ball-3d-gold ring-2 ring-amber-400 scale-105' 
                                : ''
                            }`}
                            title={`Numéro ${num} ${isHit ? '(Gagnant !)' : ''}`}
                          >
                            {num}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Right: Verification Against Reality */}
                  {result && (
                    <div className="bg-[#090b12] border border-white/[0.08] p-4 rounded-2xl flex items-center justify-between gap-6 min-w-[280px]">
                      <div>
                        <div className="text-[10px] uppercase font-bold text-slate-400">
                          Tirage Confronté du {result.draw.date} ({result.draw.time})
                        </div>
                        <div className="text-lg font-black text-white mt-0.5">
                          {result.bestScore.nums} <span className="text-xs font-normal text-slate-400">/ 10 Numéros trouvés</span>
                        </div>
                      </div>

                      <div className="text-right">
                        <div className="text-[10px] uppercase font-bold text-slate-400">Lettre</div>
                        <div className={`text-base font-black ${result.bestScore.letter ? 'text-amber-400' : 'text-slate-600'}`}>
                          {result.bestScore.letter ? 'CORRESPONDANCE' : 'Divergence'}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </main>
  );
}
