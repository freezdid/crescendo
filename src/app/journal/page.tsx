"use client";

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Trophy, Calendar, Target, ChevronLeft, ArrowRight, Brain, AlertCircle, Sparkles, RefreshCw } from 'lucide-react';
import Link from 'next/link';
import { loadDraws, loadPredictions, SavedPrediction } from '@/lib/storage';
import { ProcessedDraw } from '@/lib/model';

export default function Journal() {
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
        // Sync Draws first (needed for matching)
        if (!draws || draws.length === 0) {
          const resDraws = await fetch(`/api/sync?type=draws&t=${timestamp}`, { cache: 'no-store' });
          const jsonDraws = await resDraws.json();
          if (jsonDraws.success && jsonDraws.data) {
            setData(jsonDraws.data);
          }
        }

        // Sync Predictions
        const res = await fetch(`/api/sync?type=predictions&t=${timestamp}`, { cache: 'no-store' });
        const json = await res.json();
        
        if (json.success && json.data && Array.isArray(json.data) && json.data.length > 0) {
          // Merge logic: combine local and cloud, removing duplicates by timestamp
          setPredictions(prevLocal => {
            const cloudPreds = json.data as SavedPrediction[];
            const combined = [...cloudPreds];
            
            // Add local ones that aren't in cloud yet
            prevLocal.forEach(p => {
              if (!combined.find(c => c.timestamp === p.timestamp)) {
                combined.push(p);
              }
            });
            
            const sorted = combined.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).slice(0, 50);
            
            // Sync back to local
            import('@/lib/storage').then(m => m.savePredictions(sorted));
            return sorted;
          });
        }
      } catch (e) { console.error("Cloud sync failed:", e); }

      setLoading(false);
    }
    init();
  }, []);

  const checkMatch = (pred: number[], draw: ProcessedDraw) => {
    const predNums = pred.slice(0, 10);
    const predLetter = pred[10];
    
    const drawNums = [draw.num0, draw.num1, draw.num2, draw.num3, draw.num4, draw.num5, draw.num6, draw.num7, draw.num8, draw.num9];
    const drawLetter = draw.letterNum;

    const matchedNums = predNums.filter(n => drawNums.includes(n));
    const matchedLetter = predLetter === drawLetter;

    return {
      nums: matchedNums.length,
      letter: matchedLetter,
      matchedList: matchedNums
    };
  };

  const getResultsForPrediction = (pred: SavedPrediction) => {
    // Find draws that happened AFTER this prediction
    const predTime = new Date(pred.timestamp).getTime();
    const laterDraws = data.filter(d => d.fullDate > predTime).sort((a, b) => a.fullDate - b.fullDate);
    
    if (laterDraws.length === 0) return null;

    // Compare each grille with the very next draw
    const nextDraw = laterDraws[0];
    
    const scores = pred.grilles.map(g => checkMatch(g, nextDraw));
    const bestScore = scores.reduce((prev, current) => (current.nums > prev.nums ? current : prev), scores[0]);

    return {
      draw: nextDraw,
      bestScore,
      allScores: scores
    };
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-accent animate-pulse font-black uppercase">Analyse des performances...</div>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-200 p-4 md:p-8">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors order-2 md:order-1">
            <ChevronLeft className="w-5 h-5" />
            <span>Retour Dashboard</span>
          </Link>
          <div className="flex items-center gap-4 order-1 md:order-2">
            <button 
              onClick={() => window.location.reload()}
              className="p-2 rounded-full bg-slate-900 border border-white/5 text-slate-400 hover:text-accent transition-colors"
              title="Rafraîchir les données"
            >
              <RefreshCw className="w-5 h-5" />
            </button>
            <div className="text-right">
              <h1 className="text-2xl font-black italic tracking-tighter text-white flex items-center gap-2">
                 <Brain className="w-6 h-6 text-accent" /> CRESCENDO JOURNAL
              </h1>
              <p className="text-[10px] text-slate-500 font-bold uppercase">Suivi des performances prédictives</p>
            </div>
          </div>
        </div>

        {predictions.length === 0 ? (
          <div className="glass-panel p-12 text-center space-y-4">
             <AlertCircle className="w-12 h-12 text-slate-700 mx-auto" />
             <p className="text-slate-500 uppercase font-black">Aucun pronostic enregistré pour le moment.</p>
             <Link href="/" className="btn-primary inline-flex">Lancer un calcul</Link>
          </div>
        ) : (
          <div className="grid gap-6">
            {predictions.map((pred, idx) => {
              const result = getResultsForPrediction(pred);
              return (
                <motion.div 
                   key={idx}
                   initial={{ opacity: 0, y: 20 }}
                   animate={{ opacity: 1, y: 0 }}
                   transition={{ delay: idx * 0.1 }}
                   className="glass-panel overflow-hidden border-l-4 border-l-accent"
                >
                  <div className="p-4 md:p-6 flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 text-slate-400">
                        <Calendar className="w-4 h-4" />
                        <span className="text-xs font-bold">{new Date(pred.timestamp).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</span>
                      </div>
                      <h3 className="text-xl font-black italic text-white tracking-tighter uppercase">Pronostic #{predictions.length - idx}</h3>
                      <div className="flex flex-wrap gap-2 mt-4">
                        {pred.grilles[0].map((num, i) => (
                          <div key={i} className="flex flex-col items-center gap-1">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-[10px] shadow-lg ${
                              i === 10 
                                ? 'bg-loto-red text-white border-2 border-white/20' 
                                : 'bg-primary/10 border border-primary/30 text-primary shadow-primary/5'
                            }`}>
                              {i === 10 ? String.fromCharCode(num + 64) : (num < 10 ? `0${num}` : num)}
                            </div>
                            <span className="text-[6px] font-black text-slate-600 uppercase">{i === 10 ? 'Lettre' : `N°${i+1}`}</span>
                          </div>
                        ))}
                      </div>
                      {pred.grilles.length > 1 && (
                        <div className="flex items-center gap-2 mt-4 px-3 py-1 bg-slate-900/50 rounded-full border border-white/5 w-fit">
                           <Sparkles className="w-3 h-3 text-loto-yellow" />
                           <p className="text-[9px] text-slate-400 font-bold uppercase italic">+ {pred.grilles.length - 1} combinaisons optimisées</p>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-6 bg-slate-900/80 p-5 rounded-3xl border border-white/5 shadow-2xl relative overflow-hidden group">
                      <div className="absolute inset-0 bg-gradient-to-br from-accent/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                      
                      <div className="hidden md:block">
                        <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center">
                           <ArrowRight className="w-5 h-5 text-slate-500" />
                        </div>
                      </div>

                      {result ? (
                        <div className="space-y-4 relative z-10">
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-loto-yellow animate-pulse" />
                            <span className="text-[10px] font-black uppercase tracking-widest text-loto-yellow/80">Tirage du {new Date(result.draw.fullDate).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}</span>
                          </div>
                          
                          <div className="flex items-center gap-6">
                            <div className="flex flex-col items-center">
                              <span className="text-4xl font-black text-white leading-none">{result.bestScore.nums}</span>
                              <span className="text-[9px] font-black text-slate-500 uppercase tracking-tighter mt-1">Numéros</span>
                            </div>
                            
                            <div className="flex flex-col items-center">
                              <div className={`text-4xl font-black leading-none ${result.bestScore.letter ? 'text-loto-red' : 'text-slate-800'}`}>
                                {result.bestScore.letter ? 'OK' : '-'}
                              </div>
                              <span className="text-[9px] font-black text-slate-500 uppercase tracking-tighter mt-1">Lettre</span>
                            </div>

                            <div className="ml-2">
                               {result.bestScore.nums >= 6 || result.bestScore.letter ? (
                                 <div className="bg-gradient-to-r from-loto-yellow to-yellow-500 text-slate-950 px-4 py-1.5 rounded-full text-[10px] font-black shadow-lg shadow-loto-yellow/20 animate-bounce uppercase">
                                    Gagnant
                                 </div>
                               ) : (
                                 <div className="px-4 py-1.5 rounded-full border border-slate-800 text-slate-600 text-[10px] font-black uppercase tracking-widest">
                                    Perdu
                                 </div>
                               )}
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center gap-4 py-2 relative z-10">
                           <div className="w-12 h-12 rounded-full border-2 border-slate-800 border-t-accent animate-spin flex items-center justify-center">
                              <Target className="w-5 h-5 text-slate-700" />
                           </div>
                           <div>
                             <p className="text-xs font-black text-white uppercase tracking-tighter">Analyse en attente</p>
                             <p className="text-[9px] text-slate-500 uppercase font-bold">Prochain tirage requis</p>
                           </div>
                        </div>
                      )}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </main>

  );
}
