"use client";

import { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { 
  ChevronLeft, Calendar, Search, Filter, Download, 
  Sparkles, Layers, ArrowUpDown, Clock, Database 
} from 'lucide-react';
import Link from 'next/link';
import { loadDraws } from '@/lib/storage';
import { SAMEDI_LETTERS, extractNumbersAndLetter, NUM_TO_LETTER } from '@/lib/stats';

interface DrawItem {
  id?: number;
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
  letterNum?: number;
}

export default function HistoryPage() {
  const [draws, setDraws] = useState<DrawItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedLetterFilter, setSelectedLetterFilter] = useState<string>("ALL");
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');

  useEffect(() => {
    async function fetchDraws() {
      // 1. Try IndexedDB first
      try {
        const saved = await loadDraws() as any;
        if (saved && saved.length > 0) {
          setDraws([...saved].reverse());
          setLoading(false);
        }
      } catch (e) {
        console.error(e);
      }

      // 2. Fetch from API
      try {
        const res = await fetch('/api/draws');
        const json = await res.json();
        if (json.success && json.results && json.results.length > 0) {
          setDraws([...json.results].reverse());
        }
      } catch (e) {
        console.error(e);
      }
      setLoading(false);
    }
    fetchDraws();
  }, []);

  const filteredDraws = useMemo(() => {
    return draws
      .filter(d => {
        const { letterChar, nums } = extractNumbersAndLetter(d);
        const matchesSearch = 
          d.date.toLowerCase().includes(searchTerm.toLowerCase()) || 
          d.time.toLowerCase().includes(searchTerm.toLowerCase()) ||
          nums.some(n => n.toString() === searchTerm.trim());

        const matchesLetter = 
          selectedLetterFilter === "ALL" || 
          letterChar.toUpperCase() === selectedLetterFilter.toUpperCase();

        return matchesSearch && matchesLetter;
      })
      .sort((a, b) => {
        return sortOrder === 'desc' ? 0 : -1;
      });
  }, [draws, searchTerm, selectedLetterFilter, sortOrder]);

  const handleExportJSON = () => {
    const blob = new Blob([JSON.stringify(draws, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `crescendo_archives_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
  };

  const handleExportCSV = () => {
    const headers = ["Date", "Heure", "N1", "N2", "N3", "N4", "N5", "N6", "N7", "N8", "N9", "N10", "Lettre"];
    const rows = draws.map(d => {
      const { nums, letterChar } = extractNumbersAndLetter(d);
      return [d.date, d.time, ...nums, letterChar].join(',');
    });
    const csvContent = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `crescendo_archives_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  return (
    <main className="min-h-screen text-slate-100 p-4 sm:p-8 lg:p-12 flex flex-col gap-8 max-w-7xl mx-auto">
      
      {/* Top Header */}
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div className="space-y-2">
          <Link 
            href="/" 
            className="inline-flex items-center gap-2 text-slate-400 hover:text-amber-400 transition-colors text-xs font-bold uppercase tracking-widest"
          >
            <ChevronLeft className="w-4 h-4" /> Retour au Laboratoire IA
          </Link>

          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-white">
              ARCHIVES <span className="bg-gradient-to-r from-amber-400 to-amber-200 bg-clip-text text-transparent">CRESCENDO</span>
            </h1>
            <div className="bg-amber-500/15 text-amber-300 border border-amber-500/30 px-3.5 py-1 rounded-full text-xs font-black uppercase tracking-wider">
              {draws.length} Tirages Enregistrés
            </div>
          </div>

          <p className="text-slate-400 text-sm max-w-xl">
            Historique complet des combinaisons officielles, horodatées et synchronisées en haute performance pour l&apos;apprentissage automatique.
          </p>
        </div>

        {/* Export Buttons */}
        <div className="flex items-center gap-3 w-full md:w-auto">
          <button
            onClick={handleExportCSV}
            className="btn-ghost-dark text-xs py-2.5 px-4 flex-1 md:flex-none"
          >
            <Download className="w-3.5 h-3.5 text-amber-400" />
            <span>Exporter CSV</span>
          </button>
          <button
            onClick={handleExportJSON}
            className="btn-ghost-dark text-xs py-2.5 px-4 flex-1 md:flex-none"
          >
            <Download className="w-3.5 h-3.5 text-cyan-400" />
            <span>Exporter JSON</span>
          </button>
        </div>
      </header>

      {/* Filter and Search Bar */}
      <div className="luxury-panel p-4 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        
        {/* Search Input */}
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input 
            type="text" 
            placeholder="Rechercher une date, heure ou numéro (ex: samedi, 14h, 17...)" 
            className="w-full bg-[#090b12] border border-white/[0.08] rounded-xl py-2.5 pl-11 pr-4 focus:outline-none focus:border-amber-500/60 transition-colors font-medium text-sm text-slate-200 placeholder:text-slate-500"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {/* Letter Filters */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
          <span className="text-xs font-bold text-slate-400 mr-2 whitespace-nowrap">Lettre :</span>
          <button
            onClick={() => setSelectedLetterFilter("ALL")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              selectedLetterFilter === "ALL"
                ? 'bg-amber-500 text-slate-950 font-black'
                : 'bg-white/[0.03] text-slate-400 hover:text-white'
            }`}
          >
            Toutes
          </button>
          {SAMEDI_LETTERS.map(char => (
            <button
              key={char}
              onClick={() => setSelectedLetterFilter(char)}
              className={`w-8 h-8 rounded-lg text-xs font-black transition-all ${
                selectedLetterFilter === char
                  ? 'bg-amber-400 text-slate-950 shadow-md'
                  : 'bg-white/[0.03] text-slate-400 hover:text-white border border-white/[0.06]'
              }`}
            >
              {char}
            </button>
          ))}
        </div>
      </div>

      {/* Loading State */}
      {loading ? (
        <div className="flex-1 flex flex-col items-center justify-center py-28 gap-3 opacity-60">
          <Calendar className="w-10 h-10 text-amber-400 animate-spin" />
          <span className="text-sm text-slate-400 font-medium">Chargement des tirages officiels...</span>
        </div>
      ) : filteredDraws.length === 0 ? (
        <div className="luxury-panel p-12 text-center text-slate-400 flex flex-col items-center gap-3">
          <Database className="w-10 h-10 text-slate-600" />
          <div className="font-bold text-white text-base">Aucun tirage ne correspond à vos critères</div>
          <p className="text-xs max-w-sm">Vérifiez l&apos;orthographe de votre recherche ou réinitialisez les filtres.</p>
        </div>
      ) : (
        /* Draws Grid */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredDraws.map((draw, idx) => {
            const { nums, letterChar } = extractNumbersAndLetter(draw);
            const sum = nums.reduce((a, b) => a + b, 0);
            const evens = nums.filter(n => n % 2 === 0).length;

            return (
              <motion.div
                key={draw.id || `${draw.date}-${draw.time}-${idx}`}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(0.2, idx * 0.02) }}
                className="luxury-panel luxury-panel-interactive p-4 sm:p-5 flex flex-col justify-between gap-4 border-white/[0.06]"
              >
                {/* Header Date & Hour */}
                <div className="flex items-center justify-between pb-2.5 border-b border-white/[0.06]">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-3.5 h-3.5 text-amber-400" />
                    <span className="text-xs font-bold text-white capitalize">{draw.date}</span>
                  </div>
                  <div className="flex items-center gap-1 text-[11px] font-semibold text-slate-400 bg-white/[0.04] px-2 py-0.5 rounded-md">
                    <Clock className="w-3 h-3 text-cyan-400" />
                    <span>{draw.time}</span>
                  </div>
                </div>

                {/* Numbers and Letter Balls */}
                <div className="flex flex-wrap items-center gap-2">
                  {nums.map((n, i) => (
                    <div key={i} className="ball-3d w-9 h-9 text-xs font-black">
                      {n}
                    </div>
                  ))}
                  
                  {/* Letter */}
                  <div className="letter-badge-3d w-9 h-9 text-sm font-black ml-auto">
                    {letterChar}
                  </div>
                </div>

                {/* Mathematical Telemetry Footer */}
                <div className="flex items-center justify-between pt-2 border-t border-white/[0.06] text-[11px] text-slate-400">
                  <div>
                    Somme : <strong className="text-white font-bold">{sum}</strong>
                  </div>
                  <div>
                    Parité : <strong className="text-white font-bold">{evens}P / {10 - evens}I</strong>
                  </div>
                  <div className="text-amber-400/90 font-bold">
                    Lettre &apos;{letterChar}&apos;
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </main>
  );
}
