'use client';

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useSSE } from '@/contexts/SSEContext';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import { GlobalStoneIcon } from '@/components/GlobalStoneIcon';
import { LiveHistoryCard } from '@/components/LiveHistoryCard';
import { Radio } from 'lucide-react';

// ─── Design tokens (Apex Green) ──────────────────────────────────────
const CARD = 'bg-[#0f141e]/80 backdrop-blur-xl border border-[#00c83a]/25 rounded-xl overflow-hidden shadow-[0_8px_32px_rgba(0,0,0,0.5)] flex flex-col relative transition-all duration-300';
const HEAD = 'px-5 py-4 bg-gradient-to-b from-[#00c83a]/10 to-transparent border-b border-[#00c83a]/20 flex justify-between items-center border-t-[3px] border-t-[#00c83a] shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]';
const SEL = 'bg-[#0b0e14] border border-white/10 text-white text-[10px] px-3 py-1.5 rounded-lg outline-none focus:border-[#00c83a] uppercase font-black tracking-widest hover:border-white/20 transition-colors cursor-pointer';

// --- Types ---
interface PatternStat {
  id: string;
  type: 'color' | 'number' | 'mixed';
  patternArray: string[];
  winRate: string;
  win: number;
  loss: number;
  sm: number;
  sa: number;
  pnl: number;
  pnlGuerra: number;
  casas: number[];
}

interface ConfluenceData {
  id: string;
  patternIds: string[];
  count: number;
  triggers: number;
  sa: number;
  sm: number;
  winRate: string;
  approved?: boolean;
}

interface GroupStats {
  wins: number;
  losses: number;
  sm: number; // Session Max Loss Streak
  sa: number; // Session Current Loss Streak
}

interface ActiveCycle {
  id: string;
  size: number;
  entriesLeft: number;
  maxEntries: number;
  winRate: string;
  sm: number;
  sa: number;
  currentValue: number;
  totalInvested: number;
}

const GroupCardMemo = React.memo(({ 
  size, 
  stats, 
  cycles, 
  audioEnabled, 
  onToggleAudio 
}: {
  size: number;
  stats: any;
  cycles: any[];
  audioEnabled: boolean;
  onToggleAudio: (size: number) => void;
}) => {
  const s = stats;
  const total = s.wins + s.losses;
  const tx = total > 0 ? ((s.wins / total) * 100).toFixed(0) : '0';
  const currentActive = cycles.length;
  const highlight = s.sa >= s.sm - 1 && s.sa > 0;

  return (
    <motion.div whileHover={{ y: -5 }} className="bg-[#0f141e]/80 backdrop-blur-xl border border-white/5 rounded-lg shadow-[0_8px_32px_rgba(0,0,0,0.5)] flex flex-col relative transition-all duration-300 [&>*:first-child]:rounded-t-lg [&>*:last-child]:rounded-b-lg p-5 gap-4 group">
      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-[#00c83a]/40 to-transparent"></div>
      <div className="flex justify-between items-start">
        <div className="flex flex-col"><span className="text-[10px] text-gray-500 font-black uppercase tracking-tighter">Confluência</span><h3 className="text-xl font-black text-white">{size}{size === 14 ? '+' : ''} Estrat.</h3></div>
        <div className={`p-2 rounded-xl border ${currentActive > 0 ? 'bg-red-500/10 border-red-500/30' : 'bg-white/5 border-white/10'}`}><span className={`text-[9px] font-black ${currentActive > 0 ? 'text-red-500 animate-pulse' : 'text-gray-500'}`}>{currentActive > 0 ? `${currentActive} ATIVOS` : 'EM ESPERA'}</span></div>
      </div>
      <div className="flex flex-col gap-2">
        <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest"><span className="text-gray-400">Assertividade</span><span className={parseInt(tx) >= 75 ? 'text-[#4ade80]' : 'text-white'}>{tx}% TX</span></div>
        <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden"><motion.div initial={{ width: 0 }} animate={{ width: `${tx}%` }} className={`h-full ${parseInt(tx) >= 80 ? 'bg-[#4ade80]' : 'bg-[#eab308]'}`}></motion.div></div>
      </div>
      <div className="grid grid-cols-4 gap-2 pt-2">
        <div className="bg-white/5 rounded-xl p-2 flex flex-col items-center"><span className="text-[7px] text-gray-500 font-black uppercase">Wins</span><span className="text-xs font-black text-[#4ade80]">{s.wins}</span></div>
        <div className="bg-white/5 rounded-xl p-2 flex flex-col items-center"><span className="text-[7px] text-gray-500 font-black uppercase">Losses</span><span className="text-xs font-black text-[#f12c4c]">{s.losses}</span></div>
        <div className={`rounded-xl p-2 flex flex-col items-center transition-colors ${highlight ? 'bg-[#8b008b]' : 'bg-white/5'}`}><span className="text-[7px] text-gray-500 font-black uppercase">SM</span><span className="text-xs font-black text-white">{s.sm}</span></div>
        <div className={`rounded-xl p-2 flex flex-col items-center transition-colors ${highlight ? 'bg-[#8b008b]' : 'bg-white/5'}`}><span className="text-[7px] text-gray-500 font-black uppercase">SA</span><span className="text-xs font-black text-white">{s.sa}</span></div>
      </div>
      {cycles.map((c, idx) => (
        <div key={c.id} className="mt-2 flex items-center justify-between gap-1 bg-[#12141c] border border-white/10 px-3 py-2 rounded-xl text-[10px] font-black text-white shadow-xl relative overflow-hidden group">
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full group-hover:translate-x-full duration-1000"></div>
          <div className="absolute top-0 left-0 w-1 h-full bg-[#eab308] shadow-[0_0_10px_rgba(234,179,8,0.5)]"></div>
          <span className="flex items-center gap-1.5 text-gray-400 pl-2">#{idx+1}</span>
          <span className="text-[#4ade80] font-bold text-xs">{c.winRate}%</span>
          <span className="text-gray-500 flex items-center gap-1">SM <b className="text-white">{c.sm}</b></span>
          <span className={`flex items-center gap-1 ${c.sa > 0 ? 'text-[#f12c4c]' : 'text-gray-500'}`}>SA <b className="text-white">{c.sa}</b></span>
          <span className="bg-white/5 px-2 py-0.5 rounded border border-white/10 text-gray-300 font-mono text-[9px]">{c.entriesLeft}/{c.maxEntries}</span>
          <span className="text-[#eab308] tracking-widest bg-[#eab308]/10 px-2 py-1 rounded-lg border border-[#eab308]/20 whitespace-nowrap">R$ {c.currentValue.toFixed(2)}</span>
        </div>
      ))}
      
      <button 
        onClick={() => onToggleAudio(size)}
        className={`absolute top-4 right-4 p-2 rounded-full transition-all ${audioEnabled ? 'bg-[#eab308] text-black shadow-[0_0_15px_rgba(234,179,8,0.4)]' : 'bg-white/5 text-gray-500 hover:bg-white/10 hover:text-white'}`}
        title="Ativar Sino para este Card"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill={audioEnabled ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg>
      </button>
    </motion.div>
  );
}, (prev, next) => {
  return prev.size === next.size && 
         prev.stats === next.stats && 
         prev.audioEnabled === next.audioEnabled &&
         JSON.stringify(prev.cycles) === JSON.stringify(next.cycles);
});

export default function RadarPage() {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [casasLimit, setCasasLimit] = useState(7);
  const [minWin, setMinWin] = useState(0);
  
  // Separate periods as requested
  const [periodHoursOportunidades, setPeriodHoursOportunidades] = useState(10);
  const [periodHoursConfluencias, setPeriodHoursConfluencias] = useState(24);
  const [maxFetchedHours, setMaxFetchedHours] = useState(60);
  
  const [warRoomPeriodHours, setWarRoomPeriodHours] = useState(2);
  const [sortColumn, setSortColumn] = useState<'TX' | 'SA' | 'PNL' | 'SM'>('PNL');
  const [sortDirection, setSortDirection] = useState<'desc' | 'asc'>('desc');
  const [showSidebar, setShowSidebar] = useState(true);

  const [confMinOcorrencias, setConfMinOcorrencias] = useState(1);
  const [confMinWinRate, setConfMinWinRate] = useState(0);
  const [confMaxWinRate, setConfMaxWinRate] = useState(100);
  const [confMinSa, setConfMinSa] = useState(0);
  const [confSortMode, setConfSortMode] = useState<'TX' | 'SA'>('TX');

  const [liveOpportunities, setLiveOpportunities] = useState<PatternStat[]>([]);
  const [confluences, setConfluences] = useState<ConfluenceData[]>([]);

  const [initialStake, setInitialStake] = useState<number>(1.00);
  const [audioEnabledFor, setAudioEnabledFor] = useState<number[]>([]);
  
  const toggleAudio = useCallback((size: number) => {
    setAudioEnabledFor(prev => prev.includes(size) ? prev.filter(p => p !== size) : [...prev, size]);
  }, []);
  
  const playAlert = useCallback(() => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(880, audioCtx.currentTime); 
      oscillator.frequency.exponentialRampToValueAtTime(440, audioCtx.currentTime + 2.0); 
      gainNode.gain.setValueAtTime(1, audioCtx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 2.0);
      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      oscillator.start();
      oscillator.stop(audioCtx.currentTime + 2.0);
    } catch(e) {}
  }, []);

  const initialGroupStats = {
    6: { wins: 0, losses: 0, sm: 0, sa: 0 },
    7: { wins: 0, losses: 0, sm: 0, sa: 0 },
    8: { wins: 0, losses: 0, sm: 0, sa: 0 },
    9: { wins: 0, losses: 0, sm: 0, sa: 0 },
    10: { wins: 0, losses: 0, sm: 0, sa: 0 },
    11: { wins: 0, losses: 0, sm: 0, sa: 0 },
    12: { wins: 0, losses: 0, sm: 0, sa: 0 },
    13: { wins: 0, losses: 0, sm: 0, sa: 0 },
    14: { wins: 0, losses: 0, sm: 0, sa: 0 }
  };
  const [groupStats, setGroupStats] = useState<Record<number, GroupStats>>(initialGroupStats);
  const groupStatsRef = useRef<Record<number, GroupStats>>(initialGroupStats);
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
    const freshGroup = {
      6: { wins: 0, losses: 0, sm: 0, sa: 0 },
      7: { wins: 0, losses: 0, sm: 0, sa: 0 },
      8: { wins: 0, losses: 0, sm: 0, sa: 0 },
      9: { wins: 0, losses: 0, sm: 0, sa: 0 },
      10: { wins: 0, losses: 0, sm: 0, sa: 0 },
      11: { wins: 0, losses: 0, sm: 0, sa: 0 },
      12: { wins: 0, losses: 0, sm: 0, sa: 0 },
      13: { wins: 0, losses: 0, sm: 0, sa: 0 },
      14: { wins: 0, losses: 0, sm: 0, sa: 0 }
    };
    setGroupStats(freshGroup);
    groupStatsRef.current = freshGroup;
    setActiveCycles([]);
    activeCyclesRef.current = [];
    const freshGlobal = { wins: 0, losses: 0, consecutiveLosses: 0, maxConsecutiveLosses: 0, totalPnl: 0 };
    setGlobalStats(freshGlobal);
    globalStatsRef.current = freshGlobal;
    lastProcessedId.current = null;
  };

  // O monitor agora só reinicia manualmente via botão, permitindo trocar o Gale sem perder o histórico atual.


  const isInitialFetch = useRef(true);

  const fetchData = async (targetHours = 60) => {
    try {
      setLoading(true);
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || '';
      const cleanUrl = apiUrl.endsWith('/') ? apiUrl.slice(0, -1) : apiUrl;
      
      let url = `/api/results/period?hours=${targetHours}`;
      // Se já carregou o inicial e não tá pedindo mais horas, puxa apenas as últimas 20 pedras
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
            // A API de /results/period já vem em ASC, mas garantimos aqui
            return formatted.sort((a: any, b: any) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
          }

          // Se já tem dados, achamos apenas as pedras que ainda não temos
          const newItems = formatted.filter((f: any) => !prev.some(p => p.id === f.id));
          // Sem pedras novas = Sem Re-render pesado do React!
          if (newItems.length === 0) return prev; 

          // Junta, ordena cronologicamente e mantém flexível
          const merged = [...prev, ...newItems].sort((a: any, b: any) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
          const maxElements = Math.max(60, targetHours) * 120 + 2000;
          return merged.slice(-maxElements);
        });
      }
    } catch (err) { 
      console.warn("Falha ao buscar dados (Radar):", err); 
    } finally { 
      setLoading(false); 
    }
  };

  const { subscribe } = useSSE();

  useEffect(() => { fetchData(maxFetchedHours); }, []);

  useEffect(() => {
    const requiredHours = Math.max(periodHoursOportunidades, periodHoursConfluencias, warRoomPeriodHours);
    if (requiredHours > maxFetchedHours) {
      setMaxFetchedHours(requiredHours);
      fetchData(requiredHours);
    }
  }, [periodHoursOportunidades, periodHoursConfluencias, warRoomPeriodHours]);

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
    const maxPeriod = Math.max(periodHoursOportunidades, periodHoursConfluencias, warRoomPeriodHours, 60);
    const history = data.slice(-maxPeriod * 120);
    const last10 = history.slice(-10);
    const isLatestWhite = last10[last10.length-1].roll === '0' || last10[last10.length-1].color.includes('Branco');

    // 1. Process Patterns (Estratégias)
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
      // Pula se houver 0, pois o Branco (B) já cobre isso nas estratégias de cor/mistas
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
         // Se a máscara escolheu tratar um 0 como número, ignoramos esse combo 
         // para forçar o uso do símbolo 'B' (que é capturado pelas outras máscaras ou tipo 'color')
         if (!hasZero) {
            discovered.push({ type: 'mixed', valArray });
         }
      }
    }

    const stats: PatternStat[] = Array.from(new Map(discovered.map(trigger => {
      let win = 0; let loss = 0; let curL = 0; let maxL = 0; let casasW = Array(casasLimit).fill(0);
      let pnlV = 0; let active: any[] = [];
      const sub = history.slice(-(periodHoursOportunidades * 120));
      for (let i = 0; i < sub.length - 1; i++) {
        const hR = sub[i]; const isW = hR.color.includes('Branco') || hR.roll === '0';
        if (active.length > 0) {
          if (isW) { active.forEach(t => { win++; pnlV += (t.currentBet * 14) - t.invested; casasW[t.step]++; }); active = []; curL = 0; }
          else {
            for (let t = active.length - 1; t >= 0; t--) {
              active[t].entriesLeft--; active[t].step++;
              if (active[t].entriesLeft === 0) { pnlV -= active[t].invested; loss++; curL++; if (curL > maxL) maxL = curL; active.splice(t, 1); }
              else { const nxt = active[t].currentBet * 1.078; active[t].currentBet = nxt; active[t].invested += nxt; }
            }
          }
        }
        if (i >= trigger.valArray.length - 1) {
          let m = true;
          for (let p = 0; p < trigger.valArray.length; p++) {
            const r = sub[i - (trigger.valArray.length - 1) + p]; if (!r) { m = false; break; }
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
      const patternId = trigger.valArray.join(',');
      return [patternId, {
        id: patternId, type: trigger.type, patternArray: trigger.valArray,
        winRate: ((win / (win + loss || 1)) * 100).toFixed(1),
        win, loss, sm: maxL, sa: curL, pnl: pnlV,
        pnlGuerra: calculatePnl(history, trigger.type, trigger.valArray, warRoomPeriodHours, casasLimit),
        casas: casasW
      }];
    })).values());

    setLiveOpportunities(stats.filter(s => s.win >= minWin).sort((a, b) => {
      if (sortColumn === 'PNL') return sortDirection === 'desc' ? b.pnl - a.pnl : a.pnl - b.pnl;
      if (sortColumn === 'SA') return sortDirection === 'desc' ? b.sa - a.sa : a.sa - b.sa;
      if (sortColumn === 'SM') return sortDirection === 'desc' ? b.sm - a.sm : a.sm - b.sm;
      return sortDirection === 'desc' ? parseFloat(b.winRate) - parseFloat(a.winRate) : parseFloat(a.winRate) - parseFloat(b.winRate);
    }));

    // 2. Process Confluences (Sidebar - Separate Period)
    const subHistConf = history.slice(-(periodHoursConfluencias * 120));
    const confMap: Record<string, { wins: number, triggers: number, ids: string[], sa: number, sm: number }> = {};
    for (let i = 0; i < subHistConf.length - casasLimit; i++) {
      const matched: string[] = [];
      stats.forEach(s => {
        let m = true;
        for (let p = 0; p < s.patternArray.length; p++) {
          const r = subHistConf[i - (s.patternArray.length - 1) + p]; if (!r) { m = false; break; }
          const rN = parseInt(r.roll as string);
          const valP = s.patternArray[p];
          if (s.type === 'color' || valP === 'V' || valP === 'P' || valP === 'B') {
            let rC = 'B'; if (r.color.includes('Vermelho') || (rN >= 1 && rN <= 7)) rC = 'V';
            if (r.color.includes('Preto') || (rN >= 8 && rN <= 14)) rC = 'P';
            if (rC !== valP) { m = false; break; }
          } else { if (r.roll !== valP) { m = false; break; } }
        }
        if (m) matched.push(s.id);
      });
      if (matched.length > 1) {
        const key = matched.sort().join(' + ');
        if (!confMap[key]) confMap[key] = { wins: 0, triggers: 0, ids: matched, sa: 0, sm: 0 };
        confMap[key].triggers++;
        let hit = false;
        for (let w = 1; w <= casasLimit; w++) {
          const nextR = subHistConf[i + w];
          if (nextR && (nextR.roll === '0' || nextR.color.includes('Branco'))) { confMap[key].wins++; confMap[key].sa = 0; hit = true; break; }
        }
        if (!hit) {
          confMap[key].sa++;
          if (confMap[key].sa > confMap[key].sm) confMap[key].sm = confMap[key].sa;
        }
      }
    }
    const sidebarConfs = Object.entries(confMap).map(([k, v]) => {
      const winRateStr = ((v.wins / (v.triggers || 1)) * 100).toFixed(1);
      const approved = v.triggers >= confMinOcorrencias && parseFloat(winRateStr) >= confMinWinRate && parseFloat(winRateStr) <= confMaxWinRate && v.sa >= confMinSa;
      return {
        id: k, patternIds: v.ids, count: v.wins, triggers: v.triggers, sa: v.sa, sm: v.sm,
        winRate: winRateStr, approved
      };
    }).sort((a, b) => {
      if (confSortMode === 'SA') return b.sa - a.sa;
      return parseFloat(b.winRate) - parseFloat(a.winRate);
    }).slice(0, 100);
    setConfluences(sidebarConfs);

    // 3. Monitor Groups (ONLY ON NEW STONE)
    if (currentLatest.id !== lastProcessedId.current) {
      lastProcessedId.current = currentLatest.id ?? null;

      const prevCycles = activeCyclesRef.current;
      const nextCycles: ActiveCycle[] = [];
      const resolvedThisStone: Record<number, { w: number, l: number }> = {};
      
      let stonePnl = 0;
      let stoneW = 0;
      let stoneL = 0;

      prevCycles.forEach(cycle => {
        if (isLatestWhite) {
          const pnl = (cycle.currentValue * 14) - cycle.totalInvested;
          stonePnl += pnl;
          stoneW++;
          resolvedThisStone[cycle.size] = { w: (resolvedThisStone[cycle.size]?.w || 0) + 1, l: (resolvedThisStone[cycle.size]?.l || 0) };
        } else {
          const left = cycle.entriesLeft - 1;
          if (left === 0) {
            const pnl = -cycle.totalInvested;
            stonePnl += pnl;
            stoneL++;
            resolvedThisStone[cycle.size] = { w: (resolvedThisStone[cycle.size]?.w || 0), l: (resolvedThisStone[cycle.size]?.l || 0) + 1 };
          } else {
            const nextVal = cycle.currentValue * 1.078;
            nextCycles.push({ ...cycle, entriesLeft: left, currentValue: nextVal, totalInvested: cycle.totalInvested + nextVal });
          }
        }
      });

      sidebarConfs.filter(c => c.approved).forEach(conf => {
        if (conf.patternIds.length < 3) return;
        let comboMatch = true;
        conf.patternIds.forEach(pid => {
          const pattern = stats.find(s => s.id === pid);
          if (!pattern) { comboMatch = false; return; }
          let pMatch = true;
          for (let p = 0; p < pattern.patternArray.length; p++) {
            const r = last10[last10.length - 1 - (pattern.patternArray.length - 1) + p];
            if (!r) { pMatch = false; break; }
            const rN = parseInt(r.roll as string);
            const valP = pattern.patternArray[p];
            if (pattern.type === 'color' || valP === 'V' || valP === 'P' || valP === 'B') {
              let rC = 'B'; if (r.color.includes('Vermelho') || (rN >= 1 && rN <= 7)) rC = 'V';
              if (r.color.includes('Preto') || (rN >= 8 && rN <= 14)) rC = 'P';
              if (rC !== valP) { pMatch = false; break; }
            } else { if (r.roll !== valP) { pMatch = false; break; } }
          }
          if (!pMatch) comboMatch = false;
        });
        if (comboMatch) {
          let size = Math.min(conf.patternIds.length, 14);
          if (size >= 6) {
            nextCycles.push({ id: Math.random().toString(), size, entriesLeft: casasLimit, maxEntries: casasLimit, winRate: conf.winRate, sm: conf.sm, sa: conf.sa, currentValue: initialStake, totalInvested: initialStake });
            
            // Verifica se deve tocar o alerta
            if (audioEnabledFor.includes(size)) {
               playAlert();
            }
          }
        }
      });

      activeCyclesRef.current = nextCycles;
      setActiveCycles(nextCycles);

      if (Object.keys(resolvedThisStone).length > 0) {
        const nextGroupStats = { ...groupStatsRef.current };
        Object.entries(resolvedThisStone).forEach(([size, s]) => {
          const sz = parseInt(size);
          if (nextGroupStats[sz]) {
            nextGroupStats[sz] = { ...nextGroupStats[sz] };
            nextGroupStats[sz].wins += s.w;
            nextGroupStats[sz].losses += s.l;
            if (s.w > 0) {
              nextGroupStats[sz].sa = 0;
            } else if (s.l > 0) {
              nextGroupStats[sz].sa += s.l;
              if (nextGroupStats[sz].sa > nextGroupStats[sz].sm) nextGroupStats[sz].sm = nextGroupStats[sz].sa;
            }
          }
        });
        groupStatsRef.current = nextGroupStats;
        setGroupStats(nextGroupStats);
      }
      
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
  }, [data.length, casasLimit, minWin, periodHoursOportunidades, periodHoursConfluencias, warRoomPeriodHours, sortColumn, sortDirection, confMinOcorrencias, confMinWinRate, confMaxWinRate, confMinSa, confSortMode, audioEnabledFor, initialStake, playAlert]);

  const handleSort = (col: 'TX' | 'SA' | 'PNL' | 'SM') => {
    if (sortColumn === col) setSortDirection(d => d === 'desc' ? 'asc' : 'desc');
    else { setSortColumn(col); setSortDirection('desc'); }
  };



  const last35 = useMemo(() => data.slice(-35), [data]);


  return (
    <main className="min-h-screen bg-[#050507] text-gray-200 flex flex-col overflow-hidden">
      <div className="bg-[#0a0a0f] border-b border-white/5 h-[72px] px-6 flex items-center justify-between shadow-2xl shrink-0 z-50">
        <h1 className="text-xl font-black uppercase tracking-tighter text-white flex items-center gap-2">
          <Radio size={24} className="text-[#00c83a]" />
          RADAR AVANÇADO
        </h1>
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setShowSidebar(!showSidebar)} 
            className="flex items-center gap-2 bg-blue-600/10 hover:bg-blue-600/20 border border-blue-500/20 px-4 py-2 rounded-lg transition-all text-blue-400 font-black text-[10px] uppercase tracking-widest shadow-[0_0_15px_rgba(37,99,235,0.1)]"
          >
            {showSidebar ? 'ESCONDER CONFLUÊNCIAS' : 'MOSTRAR CONFLUÊNCIAS'}
          </button>
          <button onClick={resetMonitor} className="flex items-center gap-2 bg-[#f12c4c]/10 hover:bg-[#f12c4c]/20 border border-[#f12c4c]/20 px-4 py-2 rounded-lg transition-all text-[#f12c4c] font-black text-[10px] uppercase tracking-widest shadow-[0_0_15px_rgba(241,44,76,0.1)]">
            REINICIAR MONITOR
          </button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        <section className="flex-1 flex flex-col overflow-y-auto custom-scrollbar p-6 gap-6 bg-gradient-to-br from-[#050507] via-[#08080c] to-[#050507]">
          
          <LiveHistoryCard data={data} maxItems={35} />

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-[#0f141e]/80 backdrop-blur-xl border border-[#00c83a]/25 p-4 rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.5)]">
            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-gray-400 uppercase font-bold tracking-wider">Quantidade de entradas</label>
              <select className="bg-[#12141c] border border-white/10 text-white px-3 py-1.5 rounded-md outline-none focus:border-[#e51e3e]" value={casasLimit} onChange={(e) => setCasasLimit(Number(e.target.value))}>
                {[1,2,3,4,5,6,7,8,9,10,11,12].map(num => <option key={num} value={num}>{num} {num === 1 ? 'Entrada' : 'Entradas'}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-gray-400 uppercase font-bold tracking-wider">Período das Estratégias</label>
              <select className="bg-[#12141c] border border-white/10 text-white px-3 py-1.5 rounded-md outline-none focus:border-[#e51e3e]" value={periodHoursOportunidades} onChange={(e) => setPeriodHoursOportunidades(Number(e.target.value))}>
                {[1,2,3,4,6,12,24,48,72,120,168].map(h => <option key={h} value={h}>{h < 24 ? `${h} Horas` : `${h/24} Dias`}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-gray-400 uppercase font-bold tracking-wider">Período Confluências</label>
              <select className="bg-[#12141c] border border-white/10 text-white px-3 py-1.5 rounded-md outline-none focus:border-[#e51e3e]" value={periodHoursConfluencias} onChange={(e) => setPeriodHoursConfluencias(Number(e.target.value))}>
                {[1,2,3,4,6,12,24,48,72,120,168,216,336].map(h => <option key={h} value={h}>{h < 24 ? `${h} Horas` : `${h/24} Dias`}</option>)}
              </select>
            </div>
          </div>

          {/* SOMATÓRIO DAS APOSTAS & PLACAR GERAL (MOVIDO PARA CIMA) */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
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
                  <span className="text-[9px] font-black text-gray-500 uppercase tracking-widest">Perca Atual (Na Mesa)</span>
                  <span className="text-base font-black text-[#f12c4c]">R$ {activeCycles.reduce((sum, c) => sum + c.currentValue, 0).toFixed(2)}</span>
                </div>
                <div className="flex flex-col items-end">
                  <span className="text-[9px] font-black text-[#eab308] uppercase tracking-widest drop-shadow-[0_0_5px_rgba(234,179,8,0.8)] mb-0.5">Aposta na Rodada</span>
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={(e) => {
                        const val = activeCycles.reduce((sum, c) => sum + c.currentValue, 0).toFixed(2);
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
                      R$ {activeCycles.reduce((sum, c) => sum + c.currentValue, 0).toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <h2 className="text-sm font-black uppercase text-white tracking-widest">ESTRATÉGIAS AO VIVO</h2>
            <div className={`${CARD}`}>
              <div className="overflow-auto max-h-[500px] custom-scrollbar w-full">
                <table className="w-full text-left border-collapse min-w-max">
                  <thead className="sticky top-0 z-20 shadow-xl">
                    <tr className="bg-gradient-to-b from-[#00c83a]/20 to-transparent border-b border-[#00c83a]/30 text-white">
                      <th className="p-3 border-r border-white/20 text-center font-medium">PADRÃO</th>
                      <th className="p-3 border-r border-white/20 text-center font-medium cursor-pointer" onClick={() => handleSort('TX')}>TX % {sortColumn === 'TX' ? (sortDirection === 'desc' ? '↓' : '↑') : ''}</th>
                      <th className="p-3 border-r border-white/20 text-center font-medium">WIN</th>
                      <th className="p-3 border-r border-white/20 text-center font-medium">LOSS</th>
                      <th className="p-3 border-r border-white/20 text-center font-medium cursor-pointer" onClick={() => handleSort('PNL')}>PNL {sortColumn === 'PNL' ? (sortDirection === 'desc' ? '↓' : '↑') : ''}</th>
                      <th className="p-3 border-r border-white/20 text-center font-medium cursor-pointer" onClick={() => handleSort('SM')}>SM {sortColumn === 'SM' ? (sortDirection === 'desc' ? '↓' : '↑') : ''}</th>
                      <th className="p-3 border-r border-white/20 text-center font-medium cursor-pointer" onClick={() => handleSort('SA')}>SA {sortColumn === 'SA' ? (sortDirection === 'desc' ? '↓' : '↑') : ''}</th>
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
                        <td className="p-3 border-r border-white/5 text-center text-[#4ade80] font-bold">{stat.winRate}%</td>
                        <td className="p-3 border-r border-white/5 text-center text-gray-300 font-semibold">{stat.win}</td>
                        <td className="p-3 border-r border-white/5 text-center text-gray-300 font-semibold">{stat.loss}</td>
                        <td className={`p-3 border-r border-white/5 text-center font-bold ${stat.pnl >= 0 ? 'text-[#4ade80]' : 'text-[#f12c4c]'}`}>R$ {stat.pnl.toFixed(0)}</td>
                        <td className={`p-3 border-r border-white/5 text-center text-white font-bold ${stat.sa >= stat.sm - 1 && stat.sa > 0 ? 'bg-[#8b008b]' : ''}`}>{stat.sm}</td>
                        <td className={`p-3 border-r border-white/5 text-center text-white font-bold ${stat.sa >= stat.sm - 1 && stat.sa > 0 ? 'bg-[#8b008b]' : ''}`}>{stat.sa}</td>
                      </motion.tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Monitor de Grupos */}
          <div className="flex flex-col gap-4 mt-6">
            <div className="flex items-center justify-between border-b border-white/5 pb-2">
              <div className="flex flex-col gap-1">
                <h2 className="text-sm font-black uppercase text-white tracking-widest">Monitor de Grupos (6 a 14+)</h2>
                <span className="text-[10px] text-gray-500 font-normal italic">Mostrando histórico ou sessão atual</span>
              </div>
              <div className="flex items-center gap-6 flex-wrap justify-end">
                <div className="flex gap-4">
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] text-gray-500 uppercase font-black tracking-widest text-right">Stake Inicial (R$)</label>
                    <input 
                      type="number" min="0.1" step="0.1"
                      value={initialStake} 
                      onChange={(e) => setInitialStake(Number(e.target.value) || 1)}
                      className="bg-[#12141c] border border-white/10 text-white text-xs px-3 py-1.5 rounded-lg outline-none focus:border-[#eab308] w-24 text-right"
                    />
                  </div>
                </div>
                
                <button onClick={resetMonitor} className="bg-white/5 hover:bg-white/10 border border-white/10 px-4 py-2 rounded-lg text-xs font-black text-gray-300 transition-all uppercase mt-4">Limpar Monitor</button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[6, 7, 8, 9, 10, 11, 12, 13, 14].map(size => (
                <GroupCardMemo 
                  key={size}
                  size={size}
                  stats={groupStats[size]}
                  cycles={activeCycles.filter(c => c.size === size)}
                  audioEnabled={audioEnabledFor.includes(size)}
                  onToggleAudio={toggleAudio}
                />
              ))}
            </div>

          </div>
        </section>

        {showSidebar && (
        <aside className="w-96 bg-[#0f141e]/95 backdrop-blur-xl border-l border-[#00c83a]/30 flex flex-col shadow-[-8px_0_32px_rgba(0,0,0,0.5)] overflow-hidden">
          <div className="px-5 py-4 border-b border-[#00c83a]/20 bg-gradient-to-b from-[#00c83a]/10 to-transparent flex flex-col gap-4 shrink-0">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-black uppercase text-white tracking-widest">Confluências Reais ({periodHoursConfluencias}H)</h2>
              <span className="text-[10px] text-gray-500">{confluences.length} Combos</span>
            </div>
            
            {/* Filtros das Confluências Reais */}
            <div className="grid grid-cols-4 gap-2">
              <div className="flex flex-col gap-1">
                <label className="text-[8px] text-gray-500 uppercase font-black tracking-widest" title="Mínimo de Sinais (Triggers)">Min Sinais</label>
                <input 
                  type="number" min="1" 
                  value={confMinOcorrencias} 
                  onChange={(e) => setConfMinOcorrencias(Number(e.target.value) || 1)}
                  className="bg-[#12141c] border border-white/10 text-white text-[10px] px-2 py-1.5 rounded-md outline-none focus:border-[#eab308]"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[8px] text-gray-500 uppercase font-black tracking-widest">TX Mín (%)</label>
                <input 
                  type="number" min="0" max="100" 
                  value={confMinWinRate} 
                  onChange={(e) => setConfMinWinRate(Number(e.target.value) || 0)}
                  className="bg-[#12141c] border border-white/10 text-white text-[10px] px-2 py-1.5 rounded-md outline-none focus:border-[#eab308]"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[8px] text-gray-500 uppercase font-black tracking-widest">TX Máx (%)</label>
                <input 
                  type="number" min="0" max="100" 
                  value={confMaxWinRate} 
                  onChange={(e) => setConfMaxWinRate(Number(e.target.value) || 0)}
                  className="bg-[#12141c] border border-white/10 text-white text-[10px] px-2 py-1.5 rounded-md outline-none focus:border-[#eab308]"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[8px] text-gray-500 uppercase font-black tracking-widest">SA Mín</label>
                <input 
                  type="number" min="0" 
                  value={confMinSa} 
                  onChange={(e) => setConfMinSa(Number(e.target.value) || 0)}
                  className="bg-[#12141c] border border-white/10 text-white text-[10px] px-2 py-1.5 rounded-md outline-none focus:border-[#eab308]"
                />
              </div>
            </div>
            
            <div className="flex gap-2 mt-2">
              <button 
                onClick={() => setConfSortMode('TX')}
                className={`flex-1 py-1.5 text-[9px] font-black uppercase rounded-md border transition-all ${confSortMode === 'TX' ? 'bg-[#eab308]/20 border-[#eab308] text-[#eab308]' : 'bg-transparent border-white/10 text-gray-500 hover:text-white'}`}
              >
                % Assertividade
              </button>
              <button 
                onClick={() => setConfSortMode('SA')}
                className={`flex-1 py-1.5 text-[9px] font-black uppercase rounded-md border transition-all ${confSortMode === 'SA' ? 'bg-[#8b008b]/40 border-[#8b008b] text-purple-300' : 'bg-transparent border-white/10 text-gray-500 hover:text-white'}`}
              >
                Maior SA
              </button>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto custom-scrollbar p-6 flex flex-col gap-4">
            
            {/* Approved Confluences */}
            {confluences.filter(c => c.approved).map((conf, i) => (
              <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} key={`app-${i}`} className="bg-[#12141c] border border-[#eab308]/50 rounded-2xl p-4 flex flex-col gap-3 relative overflow-hidden group hover:border-[#eab308]/80 transition-all">
                <div className="absolute top-0 right-0 w-24 h-24 bg-[#eab308]/10 rounded-bl-full flex flex-col items-center justify-center pl-4 pt-2">
                  <span className="text-[#eab308] text-[10px] font-black">{conf.winRate}%</span>
                  <div className={`mt-0.5 text-[8px] font-black px-1.5 py-0.5 rounded ${conf.sm > 0 ? 'bg-purple-900 text-white' : 'text-gray-500'}`}>SM {conf.sm}</div>
                  <div className={`mt-0.5 text-[8px] font-black px-1.5 py-0.5 rounded ${conf.sa > 0 ? 'bg-[#8b008b] text-white' : 'text-gray-500'}`}>SA {conf.sa}</div>
                </div>
                <div className="flex flex-col gap-3">
                  {conf.patternIds.map((pid, idx) => {
                    const parts = pid.split(',');
                    return (
                      <div key={idx} className="flex flex-col gap-1">
                        <span className="text-[7px] text-gray-500 uppercase font-black">Padrão {idx + 1}</span>
                        <div className="flex gap-1">
                          {parts.map((v: string, vIdx: number) => {
                             const n = parseInt(v); let bg = 'bg-[#262831]'; let text = 'text-white';
                             const isColorElement = v === 'V' || v === 'P' || v === 'B';
                             if (isColorElement) { if (v === 'V') bg = 'bg-[#f12c4c]'; if (v === 'B') { bg = 'bg-white'; text = 'text-black'; } }
                             else { if (n === 0) { bg = 'bg-white'; text = 'text-black'; } else if (n >= 1 && n <= 7) bg = 'bg-[#f12c4c]'; }
                             return <div key={vIdx} className={`w-4 h-4 rounded-sm border border-black/30 flex items-center justify-center text-[7px] font-black ${bg} ${text}`}>{isColorElement ? '' : v}</div>;
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="flex justify-between items-center mt-2 pt-3 border-t border-white/5">
                   <div className="flex flex-col"><span className="text-[8px] text-gray-500 uppercase font-black">Wins / Sinal</span><span className="text-xs font-black text-white">{conf.count} / {conf.triggers}</span></div>
                   <div className="flex flex-col items-end"><span className="text-[8px] text-gray-500 uppercase font-black">Performance</span><span className="text-[10px] font-black text-[#4ade80]">Est. +R$ {(conf.count * 13).toFixed(0)}</span></div>
                </div>
              </motion.div>
            ))}

            {/* Separador UI */}
            {confluences.filter(c => !c.approved).length > 0 && confluences.filter(c => c.approved).length > 0 && (
              <div className="w-full flex items-center justify-center my-2 opacity-50">
                <hr className="w-full border-gray-600" />
              </div>
            )}

            {/* Rejected Confluences */}
            {confluences.filter(c => !c.approved).map((conf, i) => (
              <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} key={`rej-${i}`} className="bg-[#12141c] border border-white/5 rounded-2xl p-4 flex flex-col gap-3 relative overflow-hidden group hover:border-white/10 transition-all opacity-50 grayscale hover:grayscale-0">
                <div className="absolute top-0 right-0 w-24 h-24 bg-white/5 rounded-bl-full flex flex-col items-center justify-center pl-4 pt-2">
                  <span className="text-gray-400 text-[10px] font-black">{conf.winRate}%</span>
                  <div className={`mt-0.5 text-[8px] font-black px-1.5 py-0.5 rounded ${conf.sm > 0 ? 'bg-purple-900 text-white' : 'text-gray-500'}`}>SM {conf.sm}</div>
                  <div className={`mt-0.5 text-[8px] font-black px-1.5 py-0.5 rounded ${conf.sa > 0 ? 'bg-[#8b008b] text-white' : 'text-gray-500'}`}>SA {conf.sa}</div>
                </div>
                <div className="flex flex-col gap-3">
                  {conf.patternIds.map((pid, idx) => {
                    const parts = pid.split(',');
                    return (
                      <div key={idx} className="flex flex-col gap-1">
                        <span className="text-[7px] text-gray-500 uppercase font-black">Padrão {idx + 1}</span>
                        <div className="flex gap-1">
                          {parts.map((v: string, vIdx: number) => {
                             const n = parseInt(v); let bg = 'bg-[#262831]'; let text = 'text-white';
                             const isColor = v === 'V' || v === 'P' || v === 'B';
                             if (isColor) { if (v === 'V') bg = 'bg-[#f12c4c]'; if (v === 'B') { bg = 'bg-white'; text = 'text-black'; } }
                             else { if (n === 0) { bg = 'bg-white'; text = 'text-black'; } else if (n >= 1 && n <= 7) bg = 'bg-[#f12c4c]'; }
                             return <div key={vIdx} className={`w-4 h-4 rounded-sm border border-black/30 flex items-center justify-center text-[7px] font-black ${bg} ${text}`}>{isColor ? '' : v}</div>;
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="flex justify-between items-center mt-2 pt-3 border-t border-white/5">
                   <div className="flex flex-col"><span className="text-[8px] text-gray-500 uppercase font-black">Wins / Sinal</span><span className="text-xs font-black text-gray-400">{conf.count} / {conf.triggers}</span></div>
                   <div className="flex flex-col items-end"><span className="text-[8px] text-gray-500 uppercase font-black">Performance</span><span className="text-[10px] font-black text-gray-400">Est. +R$ {(conf.count * 13).toFixed(0)}</span></div>
                </div>
              </motion.div>
            ))}

          </div>
        </aside>
        )}
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
