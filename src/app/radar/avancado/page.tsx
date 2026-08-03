'use client';

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useSSE } from '@/contexts/SSEContext';
import { motion } from 'framer-motion';
import { LiveHistoryCard } from '@/components/LiveHistoryCard';
import { Radio } from 'lucide-react';

// ─── Design tokens (Apex Green) ──────────────────────────────────────
const CARD = 'bg-[#0f141e]/80 backdrop-blur-xl border border-[#00c83a]/25 rounded-xl overflow-hidden shadow-[0_8px_32px_rgba(0,0,0,0.5)] flex flex-col relative transition-all duration-300';

// --- Types ---
interface PatternStat {
  id: string;
  type: 'color' | 'number' | 'mixed';
  patternArray: string[];
  winRate: string;
  cycleWinRate: string;
  currentCycleText: string;
  win: number;
  loss: number;
  sm: number;
  sa: number;
  pnl: number;
  pnlGuerra: number;
  casas: number[];
}

interface ActiveCycle {
  id: string;
  patternArray: string[];
  type: 'color' | 'number' | 'mixed';
  size: number;
  entriesLeft: number;
  maxEntries: number;
  currentStep: number;
  winRate: string;
  cycleWinRate: string;
  occurrences: number;
  sm: number;
  sa: number;
  currentValue: number;
  totalInvested: number;
}

export default function RadarAvancadoPage() {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [casasLimit, setCasasLimit] = useState(7);
  const [minWin, setMinWin] = useState(0);
  const [minLen, setMinLen] = useState<number>(1);
  const [maxLen, setMaxLen] = useState<number>(9);

  const [autoBetEnabled, setAutoBetEnabled] = useState<boolean>(false);
  const [minOcorrencias, setMinOcorrencias] = useState<number>(5);
  const [minWinRateGeral, setMinWinRateGeral] = useState<number>(50);
  const [minWinRateCiclo, setMinWinRateCiclo] = useState<number>(50);
  const [initialStake, setInitialStake] = useState<number>(1.00);

  const [periodHoursGeral, setPeriodHoursGeral] = useState(24);
  const [periodHoursCiclo, setPeriodHoursCiclo] = useState(168);
  const [maxFetchedHours, setMaxFetchedHours] = useState(168);
  
  const [warRoomPeriodHours, setWarRoomPeriodHours] = useState(2);
  const [sortColumn, setSortColumn] = useState<'TX' | 'TX_CICLO' | 'SA' | 'PNL' | 'SM'>('PNL');
  const [sortDirection, setSortDirection] = useState<'desc' | 'asc'>('desc');

  const [liveOpportunities, setLiveOpportunities] = useState<PatternStat[]>([]);

  const [activeCycles, setActiveCycles] = useState<ActiveCycle[]>([]);
  const activeCyclesRef = useRef<ActiveCycle[]>([]);

  const initialGlobalStats = {
    wins: 0,
    losses: 0,
    consecutiveLosses: 0,
    maxConsecutiveLosses: 0,
    totalPnl: 0,
  };
  const [globalStats, setGlobalStats] = useState(initialGlobalStats);
  const globalStatsRef = useRef(initialGlobalStats);

  const lastProcessedId = useRef<string | null>(null);

  const resetMonitor = () => {
    setActiveCycles([]);
    activeCyclesRef.current = [];
    const freshGlobal = { wins: 0, losses: 0, consecutiveLosses: 0, maxConsecutiveLosses: 0, totalPnl: 0 };
    setGlobalStats(freshGlobal);
    globalStatsRef.current = freshGlobal;
    lastProcessedId.current = null;
  };

  const isInitialFetch = useRef(true);

  const fetchData = async (targetHours = 60) => {
    try {
      setLoading(true);
      
      let url = `/api/results/period?hours=${targetHours}`;
      if (!isInitialFetch.current && targetHours <= maxFetchedHours) {
        url = `/api/results?limit=20`;
      }

      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
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

          const newItems = formatted.filter((f: any) => !prev.some(p => p.id === f.id));
          if (newItems.length === 0) return prev; 

          const merged = [...prev, ...newItems].sort((a: any, b: any) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
          const maxElements = Math.max(60, targetHours) * 120 + 2000;
          return merged.slice(-maxElements);
        });
      }
    } catch (err) { 
      console.warn("Falha ao buscar dados (Radar Avançado):", err); 
    } finally { 
      setLoading(false); 
    }
  };

  const { subscribe } = useSSE();

  useEffect(() => { fetchData(maxFetchedHours); }, []);

  useEffect(() => {
    const requiredHours = Math.max(periodHoursGeral, periodHoursCiclo, warRoomPeriodHours);
    if (requiredHours > maxFetchedHours) {
      setMaxFetchedHours(requiredHours);
      fetchData(requiredHours);
    }
  }, [periodHoursGeral, periodHoursCiclo, warRoomPeriodHours]);

  useEffect(() => {
    const unsub = subscribe((mappedRoll) => {
      setData(prevData => {
        if (prevData.some(r => r.id === mappedRoll.id)) return prevData;
        const next = [...prevData, mappedRoll];
        if (next.length > 50000) return next.slice(-50000);
        return next;
      });
    });
    return unsub;
  }, [subscribe]);

  const calculatePnl = (fullHistory: any[], type: 'color' | 'number' | 'mixed', valArray: string[], hours: number, limit: number) => {
    const hist = fullHistory.slice(-(hours * 120));
    let pnlVal = 0; let act: any[] = [];
    for (let i = 0; i < hist.length - 1; i++) {
      const cur = hist[i]; const isW = cur.roll === '0' || cur.color.includes('Branco');
      if (act.length > 0) {
        if (isW) { act.forEach(t => { pnlVal += (t.currentBet * 14) - t.invested; }); act = []; }
        else {
          for (let t = act.length - 1; t >= 0; t--) {
            act[t].entriesLeft--;
            if (act[t].entriesLeft === 0) { pnlVal -= act[t].invested; act.splice(t, 1); }
            else { const next = act[t].currentBet * 1.078; act[t].currentBet = next; act[t].invested += next; }
          }
        }
      }
      if (i >= valArray.length - 1) {
        let m = true;
        for (let p = 0; p < valArray.length; p++) {
          const h = hist[i - (valArray.length - 1) + p]; if (!h) { m = false; break; }
          const hN = parseInt(h.roll as string);
          const valP = valArray[p];
          if (type === 'color' || valP === 'V' || valP === 'P' || valP === 'B') {
            let hC = 'B'; if (h.color.includes('Vermelho') || (hN >= 1 && hN <= 7)) hC = 'V';
            if (h.color.includes('Preto') || (hN >= 8 && hN <= 14)) hC = 'P';
            if (hC !== valP) { m = false; break; }
          } else { if (h.roll !== valP) { m = false; break; } }
        }
        if (m) act.push({ entriesLeft: limit, currentBet: 1.0, invested: 1.0 });
      }
    }
    return pnlVal;
  };

  useEffect(() => {
    if (!data || data.length === 0) return;
    const currentLatest = data[data.length - 1];
    const maxPeriod = Math.max(periodHoursGeral, periodHoursCiclo, warRoomPeriodHours, 60);
    const history = data.slice(-maxPeriod * 120);
    const last10 = history.slice(-10);
    const isLatestWhite = last10[last10.length-1].roll === '0' || last10[last10.length-1].color.includes('Branco');

    // Process Patterns (Estratégias)
    const discovered: any[] = [];
    for (let len = 3; len <= 9; len++) {
      const slice = last10.slice(-len);
      discovered.push({ type: 'color', valArray: slice.map(r => {
        const n = parseInt(r.roll as string);
        if (r.color.includes('Vermelho') || (n >= 1 && n <= 7)) return 'V';
        if (r.color.includes('Preto') || (n >= 8 && n <= 14)) return 'P';
        return 'B';
      }) });
    }
    for (let len = 1; len <= 4; len++) {
      const slice = last10.slice(-len);
      const valArray = slice.map(r => r.roll);
      if (valArray.includes('0')) continue;
      discovered.push({ type: 'number', valArray });
    }
    for (let len = 2; len <= 6; len++) {
      const slice = last10.slice(-len);
      const totalCombos = Math.pow(2, len);
      for (let mask = 1; mask < totalCombos - 1; mask++) {
         let hasZero = false;
         const valArray = slice.map((r, idx) => {
            const isNumber = (mask & (1 << idx)) !== 0;
            if (isNumber) {
               if (r.roll === '0') hasZero = true;
               return r.roll;
            }
            const n = parseInt(r.roll as string);
            if (r.color.includes('Vermelho') || (n >= 1 && n <= 7)) return 'V';
            if (r.color.includes('Preto') || (n >= 8 && n <= 14)) return 'P';
            return 'B';
         });
         if (!hasZero) {
            discovered.push({ type: 'mixed', valArray });
         }
      }
    }

    const stats: PatternStat[] = Array.from(new Map(discovered.map(trigger => {
      // 1. Estatísticas Gerais (baseado em periodHoursGeral)
      let win = 0; let loss = 0; let curL = 0; let maxL = 0; let casasW = Array(casasLimit).fill(0);
      let pnlV = 0; let active: any[] = [];
      const subGeral = history.slice(-(periodHoursGeral * 120));

      for (let i = 0; i < subGeral.length - 1; i++) {
        const hR = subGeral[i]; const isW = hR.color.includes('Branco') || hR.roll === '0';
        if (active.length > 0) {
          if (isW) { 
            active.forEach(t => { win++; pnlV += (t.currentBet * 14) - t.invested; casasW[t.step]++; }); 
            active = []; curL = 0; 
          } else {
            for (let t = active.length - 1; t >= 0; t--) {
              active[t].entriesLeft--; active[t].step++;
              if (active[t].entriesLeft === 0) { 
                pnlV -= active[t].invested; loss++; curL++; if (curL > maxL) maxL = curL; 
                active.splice(t, 1); 
              } else { 
                const nxt = active[t].currentBet * 1.078; active[t].currentBet = nxt; active[t].invested += nxt; 
              }
            }
          }
        }
        if (i >= trigger.valArray.length - 1) {
          let m = true;
          for (let p = 0; p < trigger.valArray.length; p++) {
            const r = subGeral[i - (trigger.valArray.length - 1) + p]; if (!r) { m = false; break; }
            const rN = parseInt(r.roll as string);
            const valP = trigger.valArray[p];
            if (trigger.type === 'color' || valP === 'V' || valP === 'P' || valP === 'B') {
              let rC = 'B'; if (r.color.includes('Vermelho') || (rN >= 1 && rN <= 7)) rC = 'V';
              if (r.color.includes('Preto') || (rN >= 8 && rN <= 14)) rC = 'P';
              if (rC !== valP) { m = false; break; }
            } else { if (r.roll !== valP) { m = false; break; } }
          }
          if (m) active.push({ entriesLeft: casasLimit, step: 0, currentBet: 1.0, invested: 1.0 });
        }
      }

      // 2. Estatísticas de Ciclo (baseado em periodHoursCiclo)
      const outcomesCiclo: ('W' | 'L')[] = [];
      let activeCiclo: any[] = [];
      const subCiclo = history.slice(-(periodHoursCiclo * 120));

      for (let i = 0; i < subCiclo.length - 1; i++) {
        const hR = subCiclo[i]; const isW = hR.color.includes('Branco') || hR.roll === '0';
        if (activeCiclo.length > 0) {
          if (isW) { 
            activeCiclo.forEach(() => { outcomesCiclo.push('W'); }); 
            activeCiclo = []; 
          } else {
            for (let t = activeCiclo.length - 1; t >= 0; t--) {
              activeCiclo[t].entriesLeft--;
              if (activeCiclo[t].entriesLeft === 0) { 
                outcomesCiclo.push('L'); 
                activeCiclo.splice(t, 1); 
              } else { 
                activeCiclo[t].currentBet *= 1.078; 
              }
            }
          }
        }
        if (i >= trigger.valArray.length - 1) {
          let m = true;
          for (let p = 0; p < trigger.valArray.length; p++) {
            const r = subCiclo[i - (trigger.valArray.length - 1) + p]; if (!r) { m = false; break; }
            const rN = parseInt(r.roll as string);
            const valP = trigger.valArray[p];
            if (trigger.type === 'color' || valP === 'V' || valP === 'P' || valP === 'B') {
              let rC = 'B'; if (r.color.includes('Vermelho') || (rN >= 1 && rN <= 7)) rC = 'V';
              if (r.color.includes('Preto') || (rN >= 8 && rN <= 14)) rC = 'P';
              if (rC !== valP) { m = false; break; }
            } else { if (r.roll !== valP) { m = false; break; } }
          }
          if (m) activeCiclo.push({ entriesLeft: casasLimit, step: 0, currentBet: 1.0, invested: 1.0 });
        }
      }

      // Compute cycle stats
      const cycleStats: { W: Record<number, {win: number, loss: number}>, L: Record<number, {win: number, loss: number}> } = { W: {}, L: {} };
      let runningType: 'W' | 'L' | null = null;
      let runningCount = 0;

      for (let i = 0; i < outcomesCiclo.length; i++) {
        const out = outcomesCiclo[i];
        if (runningType && runningCount > 0) {
          if (!cycleStats[runningType][runningCount]) {
            cycleStats[runningType][runningCount] = { win: 0, loss: 0 };
          }
          if (out === 'W') {
            cycleStats[runningType][runningCount].win++;
          } else {
            cycleStats[runningType][runningCount].loss++;
          }
        }
        if (runningType === out) {
          runningCount++;
        } else {
          runningType = out;
          runningCount = 1;
        }
      }

      let currentCycleText = 'N/A';
      let cycleWinRate = '0.0';
      if (runningType && runningCount > 0) {
        currentCycleText = `${runningType}${runningCount}`;
        if (cycleStats[runningType][runningCount]) {
          const st = cycleStats[runningType][runningCount];
          const tot = st.win + st.loss;
          cycleWinRate = tot > 0 ? ((st.win / tot) * 100).toFixed(1) : '0.0';
        }
      }

      const patternId = trigger.valArray.join(',');
      return [patternId, {
        id: patternId, type: trigger.type, patternArray: trigger.valArray,
        winRate: ((win / (win + loss || 1)) * 100).toFixed(1),
        cycleWinRate,
        currentCycleText,
        win, loss, sm: maxL, sa: curL, pnl: pnlV,
        pnlGuerra: calculatePnl(history, trigger.type, trigger.valArray, warRoomPeriodHours, casasLimit),
        casas: casasW
      }];
    })).values());

    setLiveOpportunities(stats.filter(s => {
      const len = s.patternArray.length;
      const passLen = maxLen >= minLen ? (len >= minLen && len <= maxLen) : true;
      return s.win >= minWin && passLen;
    }).sort((a, b) => {
      if (sortColumn === 'PNL') return sortDirection === 'desc' ? b.pnl - a.pnl : a.pnl - b.pnl;
      if (sortColumn === 'SA') return sortDirection === 'desc' ? b.sa - a.sa : a.sa - b.sa;
      if (sortColumn === 'SM') return sortDirection === 'desc' ? b.sm - a.sm : a.sm - b.sm;
      if (sortColumn === 'TX_CICLO') return sortDirection === 'desc' ? parseFloat(b.cycleWinRate) - parseFloat(a.cycleWinRate) : parseFloat(a.cycleWinRate) - parseFloat(b.cycleWinRate);
      return sortDirection === 'desc' ? parseFloat(b.winRate) - parseFloat(a.winRate) : parseFloat(a.winRate) - parseFloat(b.winRate);
    }));

    const latestKey = currentLatest.id || (currentLatest.timestamp + '_' + currentLatest.roll + '_' + currentLatest.color);
    if (latestKey !== lastProcessedId.current) {
      lastProcessedId.current = latestKey;

      const prevCycles = activeCyclesRef.current;
      const nextCycles: ActiveCycle[] = [];
      
      let stonePnl = 0;
      let stoneW = 0;
      let stoneL = 0;

      // 1. Process active cycles for current stone
      prevCycles.forEach(cycle => {
        if (isLatestWhite) {
          const pnl = (cycle.currentValue * 14) - cycle.totalInvested;
          stonePnl += pnl;
          stoneW++;
        } else {
          const left = cycle.entriesLeft - 1;
          if (left === 0) {
            const pnl = -cycle.totalInvested;
            stonePnl += pnl;
            stoneL++;
          } else {
            const nextVal = cycle.currentValue * 1.078;
            nextCycles.push({ 
              ...cycle, 
              entriesLeft: left, 
              currentStep: (cycle.currentStep || 1) + 1,
              currentValue: nextVal, 
              totalInvested: cycle.totalInvested + nextVal 
            });
          }
        }
      });

      // 2. Check for new auto-bet triggers from qualified patterns if enabled
      if (autoBetEnabled) {
        stats.forEach(pattern => {
          const totalTriggers = pattern.win + pattern.loss;
          const wrGeral = parseFloat(pattern.winRate);
          const wrCiclo = parseFloat(pattern.cycleWinRate);

          if (
            totalTriggers >= minOcorrencias &&
            wrGeral >= minWinRateGeral &&
            wrCiclo >= minWinRateCiclo
          ) {
            let match = true;
            for (let p = 0; p < pattern.patternArray.length; p++) {
              const r = last10[last10.length - pattern.patternArray.length + p];
              if (!r) { match = false; break; }
              const rN = parseInt(r.roll as string);
              const valP = pattern.patternArray[p];
              if (pattern.type === 'color' || valP === 'V' || valP === 'P' || valP === 'B') {
                let rC = 'B'; 
                if (r.color.includes('Vermelho') || (rN >= 1 && rN <= 7)) rC = 'V';
                if (r.color.includes('Preto') || (rN >= 8 && rN <= 14)) rC = 'P';
                if (rC !== valP) { match = false; break; }
              } else { 
                if (r.roll !== valP) { match = false; break; } 
              }
            }

            if (match) {
              const alreadyActive = nextCycles.some(c => c.id === pattern.id);
              if (!alreadyActive) {
                nextCycles.push({
                  id: pattern.id,
                  patternArray: pattern.patternArray,
                  type: pattern.type,
                  size: pattern.patternArray.length,
                  entriesLeft: casasLimit,
                  maxEntries: casasLimit,
                  currentStep: 1,
                  winRate: pattern.winRate,
                  cycleWinRate: pattern.cycleWinRate,
                  occurrences: pattern.win + pattern.loss,
                  sm: pattern.sm,
                  sa: pattern.sa,
                  currentValue: initialStake,
                  totalInvested: initialStake,
                });
              }
            }
          }
        });
      }

      activeCyclesRef.current = nextCycles;
      setActiveCycles(nextCycles);

      if (stoneW > 0 || stoneL > 0) {
         const nxt = { ...globalStatsRef.current };
         nxt.wins += stoneW;
         nxt.losses += stoneL;
         nxt.totalPnl += stonePnl;
         if (stoneW > 0) {
            nxt.consecutiveLosses = 0;
         } else if (stoneL > 0) {
            nxt.consecutiveLosses += stoneL;
            if (nxt.consecutiveLosses > nxt.maxConsecutiveLosses) nxt.maxConsecutiveLosses = nxt.consecutiveLosses;
         }
         globalStatsRef.current = nxt;
         setGlobalStats(nxt);
      }
    }
  }, [data.length, casasLimit, minWin, minLen, maxLen, autoBetEnabled, minOcorrencias, minWinRateGeral, minWinRateCiclo, initialStake, periodHoursGeral, periodHoursCiclo, warRoomPeriodHours, sortColumn, sortDirection]);

  const handleSort = (col: 'TX' | 'TX_CICLO' | 'SA' | 'PNL' | 'SM') => {
    if (sortColumn === col) setSortDirection(d => d === 'desc' ? 'asc' : 'desc');
    else { setSortColumn(col); setSortDirection('desc'); }
  };

  return (
    <main className="min-h-screen bg-[#050507] text-gray-200 flex flex-col overflow-hidden">
      <div className="bg-[#0a0a0f] border-b border-white/5 h-[72px] px-6 flex items-center justify-between shadow-2xl shrink-0 z-50">
        <h1 className="text-xl font-black uppercase tracking-tighter text-white flex items-center gap-2">
          <Radio size={24} className="text-[#00c83a]" />
          RADAR AVANÇADO
        </h1>
        <div className="flex items-center gap-3">
          <button onClick={resetMonitor} className="flex items-center gap-2 bg-[#f12c4c]/10 hover:bg-[#f12c4c]/20 border border-[#f12c4c]/20 px-4 py-2 rounded-lg transition-all text-[#f12c4c] font-black text-[10px] uppercase tracking-widest shadow-[0_0_15px_rgba(241,44,76,0.1)]">
            REINICIAR MONITOR
          </button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        <section className="flex-1 flex flex-col overflow-y-auto custom-scrollbar p-6 gap-6 bg-gradient-to-br from-[#050507] via-[#08080c] to-[#050507]">
          
          <LiveHistoryCard data={data} maxItems={35} />

          {/* PAINEL DE CONTROLES: 2 CARDS LADO A LADO NO DESKTOP, EMPILHADOS NO MOBILE */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* CARD 1: FILTROS DA ESTRATÉGIA */}
            <div className={`${CARD} p-4 gap-3`}>
              <div className="flex items-center justify-between border-b border-white/5 pb-2">
                <h3 className="text-xs font-black uppercase text-white tracking-widest flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-[#00c83a]"></span>
                  Filtros da Estratégia
                </h3>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] text-gray-400 uppercase font-bold tracking-wider">Entradas</label>
                  <select className="bg-[#12141c] border border-white/10 text-white px-2 py-1.5 rounded-md outline-none focus:border-[#00c83a] text-xs font-bold" value={casasLimit} onChange={(e) => setCasasLimit(Number(e.target.value))}>
                    {[1,2,3,4,5,6,7,8,9,10,11,12].map(num => <option key={num} value={num}>{num} {num === 1 ? 'Entrada' : 'Entradas'}</option>)}
                  </select>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-[10px] text-gray-400 uppercase font-bold tracking-wider">Período Geral</label>
                  <select className="bg-[#12141c] border border-white/10 text-white px-2 py-1.5 rounded-md outline-none focus:border-[#00c83a] text-xs font-bold" value={periodHoursGeral} onChange={(e) => setPeriodHoursGeral(Number(e.target.value))}>
                    {[1,2,3,4,6,12,24,48,72,120,168,240,360].map(h => <option key={h} value={h}>{h < 24 ? `${h} Horas` : `${h/24} ${h/24 === 1 ? 'Dia' : 'Dias'}`}</option>)}
                  </select>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-[10px] text-amber-400 uppercase font-bold tracking-wider">Período Ciclo</label>
                  <select className="bg-[#12141c] border border-amber-500/30 text-amber-400 px-2 py-1.5 rounded-md outline-none focus:border-amber-400 text-xs font-bold" value={periodHoursCiclo} onChange={(e) => setPeriodHoursCiclo(Number(e.target.value))}>
                    {[1,2,3,4,6,12,24,48,72,120,168,240,360].map(h => <option key={h} value={h}>{h < 24 ? `${h} Horas` : `${h/24} ${h/24 === 1 ? 'Dia' : 'Dias'}`}</option>)}
                  </select>
                </div>

                <div className="flex flex-col gap-1">
                  <div className="flex justify-between items-center">
                    <label className="text-[10px] text-gray-400 uppercase font-bold tracking-wider">Tamanho Padrão</label>
                    {maxLen < minLen && (
                      <span className="text-[9px] text-red-400 font-bold tracking-wider animate-pulse">⚠️ Inválido</span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className={`flex-1 flex items-center gap-1 bg-[#12141c] border px-2 py-1.5 rounded-md transition-colors ${
                      maxLen < minLen ? 'border-red-500/80 bg-red-500/10 text-red-400' : 'border-white/10 text-white'
                    }`}>
                      <span className={`text-[8px] font-black uppercase ${maxLen < minLen ? 'text-red-400' : 'text-gray-400'}`}>De</span>
                      <select 
                        value={minLen} 
                        onChange={e => setMinLen(Number(e.target.value))}
                        className={`w-full bg-transparent text-xs outline-none cursor-pointer font-bold ${maxLen < minLen ? 'text-red-400' : 'text-white'}`}
                      >
                        {[1,2,3,4,5,6,7,8,9].map(n => <option key={n} value={n} className="bg-[#12141c] text-white">{n}</option>)}
                      </select>
                    </div>
                    <span className={`text-[10px] font-black ${maxLen < minLen ? 'text-red-400' : 'text-gray-500'}`}>à</span>
                    <div className={`flex-1 flex items-center gap-1 bg-[#12141c] border px-2 py-1.5 rounded-md transition-colors ${
                      maxLen < minLen ? 'border-red-500/80 bg-red-500/10 text-red-400' : 'border-white/10 text-white'
                    }`}>
                      <span className={`text-[8px] font-black uppercase ${maxLen < minLen ? 'text-red-400' : 'text-gray-400'}`}>Até</span>
                      <select 
                        value={maxLen} 
                        onChange={e => setMaxLen(Number(e.target.value))}
                        className={`w-full bg-transparent text-xs outline-none cursor-pointer font-bold ${maxLen < minLen ? 'text-red-400' : 'text-white'}`}
                      >
                        {[1,2,3,4,5,6,7,8,9].map(n => <option key={n} value={n} className="bg-[#12141c] text-white">{n}</option>)}
                      </select>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* CARD 2: CONFIGURAÇÕES DO ROBÔ */}
            <div className={`${CARD} p-4 gap-3`}>
              <div className="flex items-center justify-between border-b border-white/5 pb-2">
                <h3 className="text-xs font-black uppercase text-white tracking-widest flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${autoBetEnabled ? 'bg-[#4ade80] animate-ping' : 'bg-gray-500'}`}></span>
                  Configurações do Robô
                </h3>
                <button
                  onClick={() => setAutoBetEnabled(!autoBetEnabled)}
                  className={`py-1 px-3 rounded-md font-black text-[10px] uppercase tracking-widest transition-all flex items-center gap-1.5 border ${
                    autoBetEnabled 
                      ? 'bg-[#00c83a]/20 border-[#00c83a] text-[#4ade80] shadow-[0_0_12px_rgba(0,200,58,0.2)]' 
                      : 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  {autoBetEnabled ? 'LIGADO' : 'DESLIGADO'}
                </button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] text-gray-400 uppercase font-bold tracking-wider">Min. Ocorrências</label>
                  <select 
                    value={minOcorrencias} 
                    onChange={e => setMinOcorrencias(Number(e.target.value))}
                    className="bg-[#12141c] border border-white/10 text-white px-2 py-1.5 rounded-md outline-none focus:border-[#00c83a] text-xs font-bold"
                  >
                    {[1, 2, 3, 5, 10, 15, 20, 25, 30, 50].map(n => (
                      <option key={n} value={n} className="bg-[#12141c] text-white">{n}</option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-[10px] text-gray-400 uppercase font-bold tracking-wider">Min. TX % (Geral)</label>
                  <select 
                    value={minWinRateGeral} 
                    onChange={e => setMinWinRateGeral(Number(e.target.value))}
                    className="bg-[#12141c] border border-white/10 text-white px-2 py-1.5 rounded-md outline-none focus:border-[#00c83a] text-xs font-bold"
                  >
                    {[0, 20, 30, 40, 50, 60, 65, 70, 80, 90].map(p => (
                      <option key={p} value={p} className="bg-[#12141c] text-white">{p}%</option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-[10px] text-gray-400 uppercase font-bold tracking-wider">Min. TX Ciclo %</label>
                  <select 
                    value={minWinRateCiclo} 
                    onChange={e => setMinWinRateCiclo(Number(e.target.value))}
                    className="bg-[#12141c] border border-white/10 text-white px-2 py-1.5 rounded-md outline-none focus:border-[#00c83a] text-xs font-bold"
                  >
                    {[0, 30, 40, 50, 60, 65, 70, 80, 90].map(p => (
                      <option key={p} value={p} className="bg-[#12141c] text-white">{p}%</option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-[10px] text-gray-400 uppercase font-bold tracking-wider">Stake Inicial</label>
                  <input 
                    type="number" min="0.1" step="0.1"
                    value={initialStake} 
                    onChange={(e) => setInitialStake(Number(e.target.value) || 1)}
                    className="bg-[#12141c] border border-white/10 text-white text-xs px-2 py-1.5 rounded-md outline-none focus:border-[#00c83a] font-bold text-right"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* SOMATÓRIO DAS APOSTAS & PLACAR GERAL & ESTRATÉGIAS ATIVAS */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-stretch">
            {/* COLUNA DA ESQUERDA: Placar Geral (topo) + Exposição (baixo) */}
            <div className="flex flex-col gap-4">
              {/* Placar Geral */}
              <div className={`${CARD} p-4 justify-center`}>
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-blue-500 to-transparent"></div>
                <div className="flex justify-between items-start mb-2">
                   <div className="flex flex-col gap-0">
                     <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest">Placar Geral Sessão</h3>
                     <span className="text-[9px] text-gray-500">Resultados consolidados</span>
                   </div>
                   <div className="flex gap-4">
                     <div className="flex flex-col items-end"><span className="text-[9px] font-black text-gray-500 uppercase tracking-widest">Wins</span><span className="text-lg font-black text-[#4ade80]">{globalStats.wins}</span></div>
                     <div className="flex flex-col items-end"><span className="text-[9px] font-black text-gray-500 uppercase tracking-widest">Losses</span><span className="text-lg font-black text-[#f12c4c]">{globalStats.losses}</span></div>
                   </div>
                </div>
                <div className="flex items-center justify-between border-t border-white/5 pt-3 mt-1">
                   <div className="flex gap-4">
                     <div className="flex flex-col"><span className="text-[9px] font-black text-gray-500 uppercase tracking-widest">Loss Seguido</span><span className="text-base font-black text-white">{globalStats.consecutiveLosses}</span></div>
                     <div className="flex flex-col"><span className="text-[9px] font-black text-gray-500 uppercase tracking-widest">Max Loss Seg</span><span className="text-base font-black text-[#f12c4c]">{globalStats.maxConsecutiveLosses}</span></div>
                   </div>
                   <div className="flex flex-col items-end">
                     <span className="text-[9px] font-black text-gray-500 uppercase tracking-widest">Resultado (PNL)</span>
                     <span className={`text-xl font-black tracking-tighter ${globalStats.totalPnl >= 0 ? 'text-[#4ade80]' : 'text-[#f12c4c]'}`}>
                       {globalStats.totalPnl >= 0 ? '+' : ''}R$ {globalStats.totalPnl.toFixed(2)}
                     </span>
                   </div>
                </div>
              </div>

              {/* Exposição Financeira */}
              <div className={`${CARD} p-4 justify-center`}>
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-[#4ade80] to-transparent"></div>
                <div className="flex justify-between items-start mb-2">
                  <div className="flex flex-col gap-0">
                    <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest">Exposição Financeira Ao Vivo</h3>
                    <span className="text-[9px] text-gray-500">Apostas em execução</span>
                  </div>
                  <div className="flex flex-col items-end">
                    <span className="text-[9px] font-black text-gray-500 uppercase tracking-widest">Ativas</span>
                    <span className="text-lg font-black text-white">{activeCycles.length}</span>
                  </div>
                </div>
                <div className="flex items-center justify-between border-t border-white/5 pt-3 mt-1">
                  <div className="flex flex-col">
                    <span className="text-[9px] font-black text-[#f12c4c] uppercase tracking-widest">Perca Atual (Na Mesa)</span>
                    <span className="text-base font-black text-[#f12c4c]">R$ {activeCycles.reduce((sum, c) => sum + (c.totalInvested || 0), 0).toFixed(2)}</span>
                  </div>
                  <div className="flex flex-col items-end">
                    <span className="text-[9px] font-black text-[#eab308] uppercase tracking-widest drop-shadow-[0_0_5px_rgba(234,179,8,0.8)] mb-0.5">Aposta na Rodada</span>
                    <div className="flex items-center gap-2">
                      <button 
                        onClick={(e) => {
                          const val = activeCycles.reduce((sum, c) => sum + (c.currentValue || 0), 0).toFixed(2);
                          navigator.clipboard.writeText(val);
                          const btn = e.currentTarget;
                          const oldIcon = btn.innerHTML;
                          btn.innerHTML = '<span class="text-[9px] text-green-400 font-bold uppercase tracking-widest">Copiado!</span>';
                          setTimeout(() => { btn.innerHTML = oldIcon; }, 1500);
                        }}
                        className="bg-[#eab308]/10 hover:bg-[#eab308]/20 text-[#eab308] px-2 py-1.5 rounded transition-all border border-[#eab308]/30 flex items-center justify-center min-w-[50px] shadow-[0_0_10px_rgba(234,179,8,0.1)]"
                        title="Copiar valor para a Blaze"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                      </button>
                      <span className="text-2xl font-black text-[#eab308] tracking-tighter drop-shadow-[0_0_15px_rgba(234,179,8,0.3)]">
                        R$ {activeCycles.reduce((sum, c) => sum + (c.currentValue || 0), 0).toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* COLUNA DA DIREITA: Card de Estratégias Ativas (Em Execução) */}
            <div className={`${CARD} p-4 flex flex-col justify-between`}>
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-[#eab308] to-transparent"></div>
              <div className="flex justify-between items-center mb-3">
                <div className="flex flex-col gap-0">
                  <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest">Estratégias Ativas (Em Execução)</h3>
                  <span className="text-[9px] text-gray-500">Padrões apostando nesta rodada</span>
                </div>
                <span className="text-xs font-black bg-[#eab308]/10 text-[#eab308] px-2.5 py-1 rounded-full border border-[#eab308]/30">
                  {activeCycles.length} {activeCycles.length === 1 ? 'Estratégia' : 'Estratégias'}
                </span>
              </div>

              <div className="flex-1 overflow-auto max-h-[220px] custom-scrollbar pr-1">
                {activeCycles.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center py-8 text-center text-gray-500 text-xs">
                    <span>Nenhuma aposta ativa no momento.</span>
                    <span className="text-[10px] text-gray-600 mt-1">Aguardando gatilhos de padrões qualificados...</span>
                  </div>
                ) : (
                  <div className="flex flex-col gap-2">
                    {activeCycles.map((cycle) => (
                      <div key={cycle.id} className="bg-[#12141c] border border-white/10 p-2.5 rounded-xl flex items-center justify-between gap-2 shadow-md hover:border-white/20 transition-all">
                        {/* Padrão (lado esquerdo flexível com scroll se o padrão for grande) */}
                        <div className="flex gap-1 items-center overflow-x-auto custom-scrollbar flex-1 min-w-0 pr-2">
                          {cycle.patternArray?.map((v, i) => {
                            const n = parseInt(v); let bg = 'bg-[#262831]'; let text = 'text-white';
                            const isColor = v === 'V' || v === 'P' || v === 'B';
                            if (isColor) { if (v === 'V') bg = 'bg-[#f12c4c]'; if (v === 'B') { bg = 'bg-white'; text = 'text-black'; } }
                            else { if (n === 0) { bg = 'bg-white'; text = 'text-black'; } else if (n >= 1 && n <= 7) bg = 'bg-[#f12c4c]'; }
                            return <div key={i} className={`w-5 h-5 rounded-sm border border-black/30 flex items-center justify-center text-[9px] font-black shrink-0 ${bg} ${text}`}>{isColor ? '' : v}</div>;
                          })}
                        </div>

                        {/* Colunas de Informações Fixas na Direita */}
                        <div className="flex items-center gap-3 shrink-0 text-xs font-bold">
                          {/* Ocorrências (Wins + Losses) */}
                          <div className="flex flex-col items-center min-w-[42px]">
                            <span className="text-[8px] text-gray-500 uppercase font-black">OCORR.</span>
                            <span className="text-gray-300 font-mono text-[11px]">{cycle.occurrences ?? 0}</span>
                          </div>

                          {/* TX % */}
                          <div className="flex flex-col items-center min-w-[45px]">
                            <span className="text-[8px] text-gray-500 uppercase font-black">TX %</span>
                            <span className="text-[#4ade80] font-mono text-[11px]">{cycle.winRate}%</span>
                          </div>

                          {/* TX CICLO % */}
                          <div className="flex flex-col items-center min-w-[55px]">
                            <span className="text-[8px] text-gray-500 uppercase font-black">TX CICLO</span>
                            <span className="text-amber-400 font-mono text-[11px]">{cycle.cycleWinRate || '0.0'}%</span>
                          </div>

                          {/* Entrada (X/Y) */}
                          <div className="flex flex-col items-center min-w-[45px]">
                            <span className="text-[8px] text-gray-500 uppercase font-black">ENTRADA</span>
                            <span className="bg-white/10 border border-white/15 px-1.5 py-0.5 rounded text-[10px] font-black text-white font-mono">
                              {cycle.currentStep || 1}/{cycle.maxEntries || casasLimit}
                            </span>
                          </div>

                          {/* Valor Rodada */}
                          <div className="flex flex-col items-end min-w-[55px]">
                            <span className="text-[8px] text-gray-500 uppercase font-black">APOSTA</span>
                            <span className="text-xs font-black text-[#eab308] font-mono">
                              R$ {(cycle.currentValue || 0).toFixed(2)}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <h2 className="text-sm font-black uppercase text-white tracking-widest">ESTRATÉGIAS AO VIVO</h2>
            <div className={`${CARD}`}>
              <div className="overflow-auto max-h-[500px] custom-scrollbar w-full">
                <table className="w-full text-left border-collapse min-w-max">
                  <thead className="sticky top-0 z-20 shadow-xl">
                    <tr className="bg-[#0f141e] border-b border-[#00c83a]/30 text-white">
                      <th className="p-3 border-r border-white/20 text-center font-medium">PADRÃO</th>
                      <th className="p-3 border-r border-white/20 text-center font-medium cursor-pointer" onClick={() => handleSort('TX')}>TX % {sortColumn === 'TX' ? (sortDirection === 'desc' ? '↓' : '↑') : ''}</th>
                      <th className="p-3 border-r border-white/20 text-center font-medium cursor-pointer text-amber-400" onClick={() => handleSort('TX_CICLO')}>TX CICLO % {sortColumn === 'TX_CICLO' ? (sortDirection === 'desc' ? '↓' : '↑') : ''}</th>
                      <th className="p-3 border-r border-white/20 text-center font-medium">WIN</th>
                      <th className="p-3 border-r border-white/20 text-center font-medium">LOSS</th>
                      <th className="p-3 border-r border-white/20 text-center font-medium cursor-pointer" onClick={() => handleSort('PNL')}>PNL {sortColumn === 'PNL' ? (sortDirection === 'desc' ? '↓' : '↑') : ''}</th>
                      <th className="p-3 border-r border-white/20 text-center font-medium cursor-pointer" onClick={() => handleSort('SM')}>SM {sortColumn === 'SM' ? (sortDirection === 'desc' ? '↓' : '↑') : ''}</th>
                      <th className="p-3 border-r border-white/20 text-center font-medium cursor-pointer" onClick={() => handleSort('SA')}>SA {sortColumn === 'SA' ? (sortDirection === 'desc' ? '↓' : '↑') : ''}</th>
                      <th className="p-3 border-r border-white/20 text-center font-medium">CICLO ATUAL</th>
                    </tr>
                  </thead>
                  <tbody>
                    {liveOpportunities.map((stat) => (
                      <motion.tr key={stat.id} className="border-b border-white/5 hover:bg-white/[0.02]">
                        <td className="p-2 border-r border-white/5 flex gap-1 justify-center">
                          {stat.patternArray.map((v, i) => {
                            const n = parseInt(v); let bg = 'bg-[#262831]'; let text = 'text-white';
                            const isColor = v === 'V' || v === 'P' || v === 'B';
                            if (isColor) { if (v === 'V') bg = 'bg-[#f12c4c]'; if (v === 'B') { bg = 'bg-white'; text = 'text-black'; } }
                            else { if (n === 0) { bg = 'bg-white'; text = 'text-black'; } else if (n >= 1 && n <= 7) bg = 'bg-[#f12c4c]'; }
                            return <div key={i} className={`w-8 h-8 rounded-sm border border-black/30 flex items-center justify-center text-[10px] font-black ${bg} ${text}`}>{isColor ? '' : v}</div>;
                          })}
                        </td>
                        <td className="p-3 border-r border-white/5 text-center text-[#4ade80] font-bold">{stat.winRate || '0.0'}%</td>
                        <td className="p-3 border-r border-white/5 text-center text-amber-400 font-bold">{stat.cycleWinRate || '0.0'}%</td>
                        <td className="p-3 border-r border-white/5 text-center text-gray-300 font-semibold">{stat.win ?? 0}</td>
                        <td className="p-3 border-r border-white/5 text-center text-gray-300 font-semibold">{stat.loss ?? 0}</td>
                        <td className={`p-3 border-r border-white/5 text-center font-bold ${(stat.pnl || 0) >= 0 ? 'text-[#4ade80]' : 'text-[#f12c4c]'}`}>R$ {(stat.pnl || 0).toFixed(0)}</td>
                        <td className={`p-3 border-r border-white/5 text-center text-white font-bold ${(stat.sa || 0) >= (stat.sm || 0) - 1 && (stat.sa || 0) > 0 ? 'bg-[#8b008b]' : ''}`}>{stat.sm ?? 0}</td>
                        <td className={`p-3 border-r border-white/5 text-center text-white font-bold ${(stat.sa || 0) >= (stat.sm || 0) - 1 && (stat.sa || 0) > 0 ? 'bg-[#8b008b]' : ''}`}>{stat.sa ?? 0}</td>
                        <td className="p-3 border-r border-white/5 text-center font-bold">
                          <span className={`px-2.5 py-1 rounded text-[10px] font-black uppercase tracking-wider border shadow-sm ${
                            (stat.currentCycleText || '').startsWith('L') 
                              ? 'bg-purple-950/70 border-purple-500/50 text-purple-300 shadow-[0_0_8px_rgba(168,85,247,0.3)]' 
                              : (stat.currentCycleText || '').startsWith('W')
                              ? 'bg-emerald-950/70 border-emerald-500/50 text-emerald-300 shadow-[0_0_8px_rgba(16,185,129,0.3)]'
                              : 'bg-white/5 border-white/10 text-gray-400'
                          }`}>
                            {stat.currentCycleText || 'N/A'}
                          </span>
                        </td>
                      </motion.tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

        </section>
      </div>

      <style dangerouslySetInnerHTML={{__html: `
        @keyframes scan {
          0% { transform: translateY(-50%); }
          100% { transform: translateY(0%); }
        }
      `}} />
    </main>
  );
}
