'use client';

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useSSE } from '@/contexts/SSEContext';
import { motion, AnimatePresence } from 'framer-motion';
import { Radio, ShieldAlert, Flame, TrendingUp, Volume2, VolumeX } from 'lucide-react';
import { LiveHistoryCard } from '@/components/LiveHistoryCard';

// ─── Design tokens (Red Alert Theme) ──────────────────────────────────
const CARD = 'bg-[#0f141e]/80 backdrop-blur-xl border border-[#f12c4c]/25 rounded-xl overflow-hidden shadow-[0_8px_32px_rgba(0,0,0,0.5)] flex flex-col relative transition-all duration-300';
const CARD_ACTIVE = 'bg-[#0f141e]/80 backdrop-blur-xl border border-[#f12c4c]/60 rounded-xl overflow-hidden shadow-[0_8px_32px_rgba(241,44,76,0.15)] flex flex-col relative transition-all duration-300';
const HEAD = 'px-5 py-3 bg-gradient-to-b from-[#f12c4c]/10 to-transparent border-b border-[#f12c4c]/20 flex justify-between items-center border-t-[3px] border-t-[#f12c4c] shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]';

// ─── Types ─────────────────────────────────────────────────────────────
interface RecStrategy {
  id: string;
  type: 'color' | 'number' | 'mixed';
  patternArray: string[];
  winInRec: number;
  lossInRec: number;
  txRec: string;
}

interface ConfluenceRecord {
  count: number;
  win: number;
  loss: number;
  tx: string;
}

export default function RadarRecPage() {
  // ─── Data State ────────────────────────────────────────────────────
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // ─── Config State ──────────────────────────────────────────────────
  const [recThreshold, setRecThreshold] = useState(40);
  const [periodHours, setPeriodHours] = useState(168);
  const [maxFetchedHours, setMaxFetchedHours] = useState(168);

  // Dual-thumb range for entries
  const [entryMin, setEntryMin] = useState(1);
  const [entryMax, setEntryMax] = useState(7);

  // Audio alert config
  const [audioMinConf, setAudioMinConf] = useState(3);
  const [audioEnabled, setAudioEnabled] = useState(false);

  // ─── SSE ───────────────────────────────────────────────────────────
  const { subscribe } = useSSE();
  const isInitialFetch = useRef(true);

  const fetchData = async (targetHours = 168) => {
    try {
      setLoading(true);
      let url = `/api/results/period?hours=${targetHours}`;
      if (!isInitialFetch.current && targetHours <= maxFetchedHours) {
        url = `/api/results?limit=20`;
      }
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      if (json.data && json.data.length > 0) {
        const formatted = json.data.map((r: any) => ({
          ...r,
          color: r.color?.toString().charAt(0).toUpperCase() + r.color?.toString().slice(1).toLowerCase(),
          roll: r.roll?.toString()
        }));
        setData(prev => {
          if (isInitialFetch.current || prev.length === 0) {
            isInitialFetch.current = false;
            return formatted.sort((a: any, b: any) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
          }
          const newItems = formatted.filter((f: any) => !prev.some((p: any) => p.id === f.id));
          if (newItems.length === 0) return prev;
          const merged = [...prev, ...newItems].sort((a: any, b: any) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
          return merged.slice(-60000);
        });
      }
    } catch (err) {
      console.warn("Falha ao buscar dados (Radar REC):", err);
    } finally { setLoading(false); }
  };

  useEffect(() => { fetchData(maxFetchedHours); }, []);

  useEffect(() => {
    if (periodHours > maxFetchedHours) {
      setMaxFetchedHours(periodHours);
      fetchData(periodHours);
    }
  }, [periodHours]);

  useEffect(() => {
    const unsub = subscribe((mappedRoll: any) => {
      setData(prevData => {
        if (prevData.some((r: any) => r.id === mappedRoll.id)) return prevData;
        const next = [...prevData, mappedRoll];
        if (next.length > 60000) return next.slice(-60000);
        return next;
      });
    });
    return unsub;
  }, [subscribe]);

  // ─── Helpers ───────────────────────────────────────────────────────
  const isBranco = (r: any) => r?.roll === '0' || r?.color?.includes('Branco');
  const getColor = (r: any) => {
    const n = parseInt(r.roll);
    if (r.color?.includes('Vermelho') || (n >= 1 && n <= 7)) return 'V';
    if (r.color?.includes('Preto') || (n >= 8 && n <= 14)) return 'P';
    return 'B';
  };

  // ─── Atraso Atual (SA Global) ──────────────────────────────────────
  const currentDelay = useMemo(() => {
    if (data.length === 0) return 0;
    let count = 0;
    for (let i = data.length - 1; i >= 0; i--) {
      if (isBranco(data[i])) break;
      count++;
    }
    return count;
  }, [data]);

  const isInRec = currentDelay >= recThreshold;

  // ─── Audio Alert ───────────────────────────────────────────────────
  const playAlert = useCallback(() => {
    if (!audioEnabled) return;
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const playTone = (time: number, freq: number, dur: number) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(freq, time);
        gain.gain.setValueAtTime(0, time);
        gain.gain.linearRampToValueAtTime(0.4, time + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, time + dur);
        osc.connect(gain); gain.connect(ctx.destination);
        osc.start(time); osc.stop(time + dur);
      };
      const now = ctx.currentTime;
      playTone(now, 523.25, 0.15);
      playTone(now + 0.12, 659.25, 0.15);
      playTone(now + 0.24, 783.99, 0.15);
      playTone(now + 0.36, 1046.50, 0.3);
    } catch(e) {}
  }, [audioEnabled]);

  // ─── REC Calculation Engine ──────────────────────────────────────────
  const recStats = useMemo(() => {
    if (data.length === 0 || !isInRec) return { activePatterns: [], allPatterns: [], numConfluences: 0, recPhasesCount: 0 };

    // 1. Identify all historical REC phases
    const recPhases: { startIdx: number; endIdx: number; }[] = [];
    let currentPhaseStart = -1;
    let delay = 0;

    for (let i = 0; i < data.length; i++) {
      if (isBranco(data[i])) {
        if (currentPhaseStart !== -1) {
          recPhases.push({ startIdx: currentPhaseStart, endIdx: i });
          currentPhaseStart = -1;
        }
        delay = 0;
      } else {
        delay++;
        if (delay === recThreshold && currentPhaseStart === -1) {
          currentPhaseStart = i;
        }
      }
    }

    // 2. Generate Live Patterns (from the last 10 stones)
    const last10 = data.slice(-10);
    const livePatterns: { id: string; type: 'color' | 'number' | 'mixed'; patternArray: string[] }[] = [];
    
    for (let len = 3; len <= 9; len++) {
      if (last10.length >= len) {
        const slice = last10.slice(-len);
        livePatterns.push({ type: 'color', patternArray: slice.map(getColor), id: slice.map(getColor).join(',') });
      }
    }
    for (let len = 1; len <= 4; len++) {
      if (last10.length >= len) {
        const slice = last10.slice(-len);
        const valArray = slice.map(r => r.roll as string);
        if (!valArray.includes('0')) livePatterns.push({ type: 'number', patternArray: valArray, id: valArray.join(',') });
      }
    }
    for (let len = 2; len <= 6; len++) {
      if (last10.length >= len) {
        const slice = last10.slice(-len);
        const totalCombos = Math.pow(2, len);
        for (let mask = 1; mask < totalCombos - 1; mask++) {
          let hasZero = false;
          const valArray = slice.map((r, idx) => {
            const isNumber = (mask & (1 << idx)) !== 0;
            if (isNumber) { if (r.roll === '0') hasZero = true; return r.roll as string; }
            return getColor(r);
          });
          if (!hasZero) livePatterns.push({ type: 'mixed', patternArray: valArray, id: valArray.join(',') });
        }
      }
    }

    const uniqueLivePatternsMap = new Map<string, any>();
    livePatterns.forEach(p => uniqueLivePatternsMap.set(p.id, p));
    const uniqueLivePatterns = Array.from(uniqueLivePatternsMap.values());

    // 3. Backtest each live pattern against historical REC phases
    const evaluatedPatterns = uniqueLivePatterns.map(pattern => {
      const hitsByDistance: Record<number, number> = {};
      const triggerDistances: number[] = [];
      let triggers = 0;
      
      for (const phase of recPhases) {
        for (let i = phase.startIdx; i < phase.endIdx; i++) {
          let isMatch = true;
          for (let p = 0; p < pattern.patternArray.length; p++) {
            const histIdx = i - (pattern.patternArray.length - 1) + p;
            if (histIdx < 0) { isMatch = false; break; }
            const r = data[histIdx];
            const valP = pattern.patternArray[p];
            if (pattern.type === 'color' || valP === 'V' || valP === 'P' || valP === 'B') {
              if (getColor(r) !== valP) { isMatch = false; break; }
            } else { if (r.roll !== valP) { isMatch = false; break; } }
          }
          if (isMatch) {
            triggers++;
            const distance = phase.endIdx - i;
            triggerDistances.push(distance);
            hitsByDistance[distance] = (hitsByDistance[distance] || 0) + 1;
          }
        }
      }
      
      let bestTx = 0;
      let optimalEntries = entryMax;
      let bestWins = 0;
      let bestLosses = triggers;
      
      let cumulativeWins = 0;
      for (let w = 1; w <= entryMax; w++) {
         cumulativeWins += (hitsByDistance[w] || 0);
         if (w >= entryMin && w <= entryMax) {
            const wins = cumulativeWins;
            const losses = triggers - wins;
            const tx = triggers > 0 ? (wins / triggers) * 100 : 0;
            if (tx >= bestTx) { // Use >= so it updates to a valid one if multiple are 0
               bestTx = tx;
               optimalEntries = w;
               bestWins = wins;
               bestLosses = losses;
            }
         }
      }

      // Calculate SM and SA chronologically based on optimalEntries
      let sm = 0;
      let sa = 0;
      let currentLossStreak = 0;
      for (const dist of triggerDistances) {
         if (dist <= optimalEntries) {
            currentLossStreak = 0;
         } else {
            currentLossStreak++;
            if (currentLossStreak > sm) sm = currentLossStreak;
         }
      }
      sa = currentLossStreak;

      return { 
         ...pattern, 
         wins: bestWins, 
         losses: bestLosses, 
         totalTriggers: triggers, 
         tx: bestTx.toFixed(1),
         optimalEntries,
         sm,
         sa
      };
    });

    const allPatterns = evaluatedPatterns.sort((a, b) => parseFloat(b.tx) - parseFloat(a.tx));
    const activePatterns = allPatterns.filter(p => p.wins > 0 && parseFloat(p.tx) >= 50);

    return { activePatterns, allPatterns, numConfluences: activePatterns.length, recPhasesCount: recPhases.length };
  }, [data, isInRec, recThreshold, entryMin, entryMax]);

  // ─── Live Tracker for Confluences ──────────────────────────────────
  const [confluenceStats, setConfluenceStats] = useState<Record<number, { w: number; l: number }>>({});
  const confluenceStatsRef = useRef<Record<number, { w: number; l: number }>>({});
  const lastProcessedId = useRef<string | null>(null);
  const activeTrackersRef = useRef<{ size: number; startIdx: number; entriesLeft: number; }[]>([]);
  const lastDataLength = useRef<number>(0);

  useEffect(() => {
    if (data.length === 0) return;
    const currentLatest = data[data.length - 1];
    
    if (currentLatest.id !== lastProcessedId.current) {
      lastProcessedId.current = currentLatest.id ?? null;
      
      const isLatestWhite = isBranco(currentLatest);
      const nextTrackers: { size: number; startIdx: number; entriesLeft: number; }[] = [];
      const resolved: Record<number, { w: number; l: number }> = {};
      
      // Update existing trackers
      activeTrackersRef.current.forEach(t => {
        if (isLatestWhite) {
          resolved[t.size] = { w: (resolved[t.size]?.w || 0) + 1, l: (resolved[t.size]?.l || 0) };
        } else {
          t.entriesLeft--;
          if (t.entriesLeft <= 0) {
            resolved[t.size] = { w: (resolved[t.size]?.w || 0), l: (resolved[t.size]?.l || 0) + 1 };
          } else {
            nextTrackers.push(t);
          }
        }
      });
      
      // Register new trackers if in REC
      if (isInRec && recStats.numConfluences > 0) {
        // Prevent duplicate registration on the same stone
        if (data.length > lastDataLength.current) {
            nextTrackers.push({ size: recStats.numConfluences, startIdx: data.length - 1, entriesLeft: entryMax });
            if (audioEnabled && recStats.numConfluences >= audioMinConf) {
                playAlert();
            }
        }
      }
      
      activeTrackersRef.current = nextTrackers;
      lastDataLength.current = data.length;
      
      if (Object.keys(resolved).length > 0) {
        const nextStats = { ...confluenceStatsRef.current };
        Object.entries(resolved).forEach(([size, s]) => {
          const sz = parseInt(size);
          if (!nextStats[sz]) nextStats[sz] = { w: 0, l: 0 };
          nextStats[sz].w += s.w;
          nextStats[sz].l += s.l;
        });
        confluenceStatsRef.current = nextStats;
        setConfluenceStats(nextStats);
      }
    }
  }, [data, isInRec, recStats.numConfluences, entryMax, audioEnabled, audioMinConf, playAlert]);

  // ─── Heatmap Calculation ───────────────────────────────────────────
  const recHeatmap = useMemo(() => {
    if (data.length === 0) return { distribution: {}, totalBreaks: 0 };
    let delay = 0;
    const distribution: Record<number, number> = {};
    let totalBreaks = 0;
    
    for (let i = 0; i < data.length; i++) {
      if (isBranco(data[i])) {
        if (delay >= recThreshold) {
            const bucketSize = 5;
            const bucketStart = Math.floor(delay / bucketSize) * bucketSize;
            distribution[bucketStart] = (distribution[bucketStart] || 0) + 1;
            totalBreaks++;
        }
        delay = 0;
      } else {
        delay++;
      }
    }
    return { distribution, totalBreaks };
  }, [data, recThreshold]);

  // ─── PLACEHOLDER UI (será expandido nas próximas partes) ───────────
  return (
    <main className="min-h-screen bg-[#050507] text-gray-200 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="bg-[#0a0a0f] border-b border-white/5 h-[72px] px-6 flex items-center justify-between shadow-2xl shrink-0 z-50">
        <h1 className="text-xl font-black uppercase tracking-tighter text-white flex items-center gap-2">
          <ShieldAlert size={24} className="text-[#f12c4c]" />
          RADAR NA REC
        </h1>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setAudioEnabled(!audioEnabled)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all font-black text-[10px] uppercase tracking-widest ${audioEnabled ? 'bg-[#eab308]/20 border border-[#eab308]/40 text-[#eab308]' : 'bg-white/5 border border-white/10 text-gray-500'}`}
          >
            {audioEnabled ? <Volume2 size={14} /> : <VolumeX size={14} />}
            {audioEnabled ? 'SOM ATIVO' : 'SOM MUDO'}
          </button>
        </div>
      </div>

      <div className="flex-1 flex flex-col overflow-y-auto custom-scrollbar p-6 gap-6 bg-gradient-to-br from-[#050507] via-[#08080c] to-[#050507]">
        {/* Live History */}
        <LiveHistoryCard data={data} maxItems={35} />

        {/* Status Bar: SA Atual + REC Indicator */}
        <div className={`${isInRec ? CARD_ACTIVE : CARD} p-5`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className={`w-14 h-14 rounded-xl flex items-center justify-center text-xl font-black border ${isInRec ? 'bg-[#f12c4c]/20 border-[#f12c4c]/50 text-[#f12c4c] animate-pulse shadow-[0_0_30px_rgba(241,44,76,0.3)]' : 'bg-white/5 border-white/10 text-gray-400'}`}>
                {currentDelay}
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] uppercase font-black tracking-widest text-gray-500">Atraso Atual (SA Global)</span>
                <span className={`text-lg font-black ${isInRec ? 'text-[#f12c4c]' : 'text-white'}`}>
                  {isInRec ? '⚠️ MESA EM REC' : 'Mesa Normal'}
                </span>
              </div>
            </div>
            <div className="flex flex-col items-end gap-1">
              <span className="text-[9px] uppercase font-black tracking-widest text-gray-500">Limiar REC</span>
              <div className="flex gap-2">
                {[30, 40, 50, 60].map(v => (
                  <button
                    key={v}
                    onClick={() => setRecThreshold(v)}
                    className={`px-3 py-1.5 rounded-lg text-[10px] font-black transition-all border ${recThreshold === v ? 'bg-[#f12c4c]/20 border-[#f12c4c] text-[#f12c4c]' : 'bg-white/5 border-white/10 text-gray-500 hover:text-white'}`}
                  >
                    {v}+
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Filtros */}
        <div className={`${CARD} p-5`}>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Período */}
            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-gray-400 uppercase font-bold tracking-wider">Período de Análise</label>
              <select className="bg-[#12141c] border border-white/10 text-white px-3 py-1.5 rounded-md outline-none focus:border-[#f12c4c]" value={periodHours} onChange={e => setPeriodHours(+e.target.value)}>
                {[24, 48, 72, 120, 168, 336, 720].map(h => <option key={h} value={h}>{h < 24 ? `${h} Horas` : `${h/24} Dias`}</option>)}
              </select>
            </div>

            <div className="flex flex-col gap-1 lg:col-span-2">
              <label className="text-[10px] text-gray-400 uppercase font-bold tracking-wider">Mapeamento de Entradas (Min - Max)</label>
              <div className="flex items-center gap-4 bg-[#12141c] border border-white/10 rounded-md px-4 py-2">
                 <span className="text-xs font-black text-white">{entryMin}</span>
                 <input type="range" min={1} max={20} value={entryMin} onChange={e => { const v = +e.target.value; setEntryMin(Math.min(v, entryMax)); }} className="flex-1 accent-[#f12c4c]" />
                 <input type="range" min={1} max={20} value={entryMax} onChange={e => { const v = +e.target.value; setEntryMax(Math.max(v, entryMin)); }} className="flex-1 accent-[#f12c4c]" />
                 <span className="text-xs font-black text-white">{entryMax}</span>
              </div>
              <span className="text-[9px] text-gray-500 mt-1">A IA buscará a melhor taxa de acerto variando a quantidade de entradas dentro desse limite.</span>
            </div>
          </div>

          {/* Audio alert threshold */}
          <div className="flex items-center gap-4 mt-4 pt-4 border-t border-white/5">
            <span className="text-[10px] text-gray-400 uppercase font-bold tracking-wider">Alerta Sonoro a partir de</span>
            <select
              className="bg-[#12141c] border border-white/10 text-white px-3 py-1.5 rounded-md outline-none focus:border-[#eab308] text-xs"
              value={audioMinConf}
              onChange={e => setAudioMinConf(+e.target.value)}
            >
              {[3, 4, 5, 6, 7, 8, 9, 10].map(v => <option key={v} value={v}>{v}+ confluências</option>)}
            </select>
          </div>
        </div>

        {/* Main Dashboard - Only shows content when loaded */}
        {!loading && (
          <div className="flex flex-col gap-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              {/* CARD 1: APOSTE AGORA */}
              <div className={`${isInRec && recStats.numConfluences > 0 ? CARD_ACTIVE : CARD} p-6 lg:col-span-1 flex flex-col items-center justify-center min-h-[300px]`}>
                 {!isInRec ? (
                    <div className="flex flex-col items-center text-center opacity-50">
                      <ShieldAlert size={48} className="mb-4 text-gray-500" />
                      <h3 className="text-lg font-black uppercase text-gray-400">Aguardando REC</h3>
                      <p className="text-xs text-gray-500 mt-2">O sistema está monitorando os padrões de forma oculta. Quando a mesa atingir {recThreshold}+ de atraso, este radar acenderá.</p>
                    </div>
                 ) : (
                    <div className="flex flex-col items-center text-center w-full">
                      <Flame size={48} className="mb-4 text-[#f12c4c] animate-pulse" />
                      <h3 className="text-2xl font-black uppercase text-white tracking-tighter">APOSTE AGORA</h3>
                      <div className="my-4 px-6 py-2 bg-[#f12c4c]/20 border border-[#f12c4c]/50 rounded-full">
                         <span className="text-[#f12c4c] font-black text-lg">{recStats.numConfluences} CONFLUÊNCIAS</span>
                      </div>
                      {recStats.numConfluences > 0 ? (
                         <div className="w-full mt-2 max-h-[150px] overflow-y-auto custom-scrollbar flex flex-col gap-2 pr-2">
                           {recStats.activePatterns.slice(0, 5).map((p, idx) => (
                              <div key={idx} className="flex justify-between items-center bg-black/20 p-2 rounded border border-white/5">
                                 <div className="flex gap-1">
                                   {p.patternArray.map((v, vIdx) => {
                                     const n = parseInt(v); let bg = 'bg-[#262831]'; let text = 'text-white';
                                     const isColor = v === 'V' || v === 'P' || v === 'B';
                                     if (isColor) { if (v === 'V') bg = 'bg-[#f12c4c]'; if (v === 'B') { bg = 'bg-white'; text = 'text-black'; } }
                                     else { if (n === 0) { bg = 'bg-white'; text = 'text-black'; } else if (n >= 1 && n <= 7) bg = 'bg-[#f12c4c]'; }
                                     return <div key={vIdx} className={`w-4 h-4 rounded-sm flex items-center justify-center text-[8px] font-black ${bg} ${text}`}>{isColor ? '' : v}</div>;
                                   })}
                                 </div>
                                 <div className="flex flex-col items-end">
                                    <span className="text-xs font-bold text-[#4ade80]">{p.tx}%</span>
                                    <span className="text-[8px] text-gray-400">Ideal: {p.optimalEntries} entradas</span>
                                 </div>
                              </div>
                           ))}
                         </div>
                      ) : (
                         <p className="text-xs text-gray-400 mt-2">Nenhum padrão validado atuando neste momento.</p>
                      )}
                    </div>
                 )}
              </div>

              {/* CARD 2: RANKING DE CONFLUÊNCIAS */}
              <div className={`${CARD} p-0 lg:col-span-1 min-h-[300px]`}>
                 <div className={HEAD}>
                    <h3 className="text-xs font-black uppercase text-white tracking-widest">Desempenho (Ao Vivo)</h3>
                 </div>
                 <div className="p-4 flex-1 overflow-y-auto custom-scrollbar max-h-[300px]">
                    <table className="w-full text-left border-collapse">
                       <thead>
                          <tr className="border-b border-white/10 text-[10px] uppercase text-gray-500">
                             <th className="pb-2 font-black">Confluências</th>
                             <th className="pb-2 font-black text-center">WIN</th>
                             <th className="pb-2 font-black text-center">LOSS</th>
                             <th className="pb-2 font-black text-right">TX%</th>
                          </tr>
                       </thead>
                       <tbody>
                          {Object.entries(confluenceStats)
                             .sort((a, b) => parseInt(b[0]) - parseInt(a[0]))
                             .map(([size, stats]) => {
                                const total = stats.w + stats.l;
                                const tx = total > 0 ? ((stats.w / total) * 100).toFixed(0) : '0';
                                return (
                                   <tr key={size} className="border-b border-white/5 hover:bg-white/5">
                                      <td className="py-3 font-bold text-white">{size} Estratégias</td>
                                      <td className="py-3 font-bold text-[#4ade80] text-center">{stats.w}</td>
                                      <td className="py-3 font-bold text-[#f12c4c] text-center">{stats.l}</td>
                                      <td className="py-3 font-bold text-white text-right">{tx}%</td>
                                   </tr>
                                );
                             })}
                          {Object.keys(confluenceStats).length === 0 && (
                             <tr>
                                <td colSpan={4} className="py-8 text-center text-xs text-gray-500">
                                   Nenhuma entrada registrada nesta sessão ainda.
                                </td>
                             </tr>
                          )}
                       </tbody>
                    </table>
                 </div>
              </div>

              {/* CARD 3: MAPA DE CALOR (DENSIDADE) */}
              <div className={`${CARD} p-0 lg:col-span-1 min-h-[300px]`}>
                 <div className={HEAD}>
                    <h3 className="text-xs font-black uppercase text-white tracking-widest">Mapa de Densidade (Ruptura)</h3>
                    <span className="text-[10px] bg-black/30 px-2 py-1 rounded text-gray-400">{recHeatmap.totalBreaks} Quebras</span>
                 </div>
                 <div className="p-5 flex-1 flex flex-col gap-3 overflow-y-auto custom-scrollbar max-h-[300px]">
                    {Object.entries(recHeatmap.distribution)
                       .sort((a, b) => parseInt(a[0]) - parseInt(b[0]))
                       .map(([bucketStart, count]) => {
                          const start = parseInt(bucketStart);
                          const end = start + 4;
                          const pct = recHeatmap.totalBreaks > 0 ? ((count / recHeatmap.totalBreaks) * 100).toFixed(1) : '0';
                          return (
                             <div key={start} className="flex flex-col gap-1">
                                <div className="flex justify-between text-[10px] font-bold uppercase">
                                   <span className="text-gray-400">Casa {start} a {end}</span>
                                   <span className="text-white">{pct}% ({count})</span>
                                </div>
                                <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden">
                                   <motion.div 
                                      initial={{ width: 0 }} 
                                      animate={{ width: `${pct}%` }} 
                                      className={`h-full ${start >= recThreshold + 10 ? 'bg-[#eab308]' : 'bg-[#f12c4c]'}`}
                                   />
                                </div>
                             </div>
                          );
                       })}
                    {Object.keys(recHeatmap.distribution).length === 0 && (
                       <div className="flex-1 flex items-center justify-center text-xs text-gray-500">
                          Histórico insuficiente para mapa de calor.
                       </div>
                    )}
                 </div>
              </div>
            </div>

            {/* BIG TABLE: TODAS AS ESTRATÉGIAS */}
            <div className={`${CARD} p-0 w-full`}>
               <div className={HEAD}>
                  <h3 className="text-sm font-black uppercase text-white tracking-widest">Análise de Todas as Estratégias na REC (Ao Vivo)</h3>
                  <span className="text-[10px] bg-black/30 px-2 py-1 rounded text-gray-400">{recStats.allPatterns.length} Encontradas</span>
               </div>
               <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                     <thead>
                        <tr className="border-b border-white/10 text-[10px] uppercase text-gray-500 bg-black/20">
                           <th className="p-4 font-black">Padrão Identificado</th>
                           <th className="p-4 font-black">Tipo</th>
                           <th className="p-4 font-black text-center">Gale Ideal</th>
                           <th className="p-4 font-black text-center">Total (Em REC)</th>
                           <th className="p-4 font-black text-center">Wins</th>
                           <th className="p-4 font-black text-center">Losses</th>
                           <th className="p-4 font-black text-center" title="Streak Atual (Perdas Seguidas)">SA</th>
                           <th className="p-4 font-black text-center" title="Streak Máxima de Perdas">SM</th>
                           <th className="p-4 font-black text-right text-white">Assertividade</th>
                        </tr>
                     </thead>
                     <tbody className="divide-y divide-white/5">
                        {recStats.allPatterns.map((p, idx) => (
                           <tr key={idx} className={`hover:bg-white/5 transition-colors ${idx < recStats.numConfluences && isInRec ? 'bg-[#f12c4c]/10' : ''}`}>
                              <td className="p-4">
                                 <div className="flex gap-1">
                                    {p.patternArray.map((v, vIdx) => {
                                       const n = parseInt(v); let bg = 'bg-[#262831]'; let text = 'text-white';
                                       const isColor = v === 'V' || v === 'P' || v === 'B';
                                       if (isColor) { if (v === 'V') bg = 'bg-[#f12c4c]'; if (v === 'B') { bg = 'bg-white'; text = 'text-black'; } }
                                       else { if (n === 0) { bg = 'bg-white'; text = 'text-black'; } else if (n >= 1 && n <= 7) bg = 'bg-[#f12c4c]'; }
                                       return <div key={vIdx} className={`w-5 h-5 rounded flex items-center justify-center text-[10px] font-black shadow-sm ${bg} ${text}`}>{isColor ? '' : v}</div>;
                                    })}
                                 </div>
                              </td>
                              <td className="p-4">
                                 <span className={`text-[10px] font-black uppercase px-2 py-1 rounded ${p.type === 'color' ? 'bg-[#3b82f6]/20 text-[#3b82f6]' : p.type === 'number' ? 'bg-[#a855f7]/20 text-[#a855f7]' : 'bg-[#f59e0b]/20 text-[#f59e0b]'}`}>
                                    {p.type === 'color' ? 'Cor' : p.type === 'number' ? 'Número' : 'Misto'}
                                 </span>
                              </td>
                              <td className="p-4 text-center font-bold text-gray-300">{p.optimalEntries}x</td>
                              <td className="p-4 text-center text-gray-400 font-bold">{p.totalTriggers}</td>
                              <td className="p-4 text-center text-[#4ade80] font-black">{p.wins}</td>
                              <td className="p-4 text-center text-[#f12c4c] font-black">{p.losses}</td>
                              <td className="p-4 text-center">
                                 <span className={`font-black ${p.sa > 0 ? 'text-[#eab308]' : 'text-gray-500'}`}>{p.sa}</span>
                              </td>
                              <td className="p-4 text-center">
                                 <span className={`font-black ${p.sm > 3 ? 'text-[#f12c4c]' : 'text-gray-400'}`}>{p.sm}</span>
                              </td>
                              <td className="p-4 text-right">
                                 <span className={`text-sm font-black ${parseFloat(p.tx) >= 80 ? 'text-[#4ade80]' : parseFloat(p.tx) >= 60 ? 'text-gray-300' : 'text-[#f12c4c]'}`}>
                                    {p.tx}%
                                 </span>
                              </td>
                           </tr>
                        ))}
                        {recStats.allPatterns.length === 0 && (
                           <tr>
                              <td colSpan={9} className="p-8 text-center text-gray-500 text-sm">Nenhum padrão encontrado nos últimos 10 giros.</td>
                           </tr>
                        )}
                     </tbody>
                  </table>
               </div>
            </div>

          </div>
        )}
      </div>
    </main>
  );
}
