'use client';

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useSSE } from '@/contexts/SSEContext';
import { motion } from 'framer-motion';
import { CloudRain, Droplets, Waves, TrendingUp, Volume2, VolumeX, AlertOctagon } from 'lucide-react';
import { LiveHistoryCard } from '@/components/LiveHistoryCard';

// ─── Design tokens (Cyan / Rain Theme) ──────────────────────────────────
const CARD = 'bg-[#0f141e]/80 backdrop-blur-xl border border-[#00f0ff]/25 rounded-xl overflow-hidden shadow-[0_8px_32px_rgba(0,0,0,0.5)] flex flex-col relative transition-all duration-300';
const CARD_ACTIVE = 'bg-[#0f141e]/80 backdrop-blur-xl border border-[#00f0ff]/60 rounded-xl overflow-hidden shadow-[0_8px_32px_rgba(0,240,255,0.15)] flex flex-col relative transition-all duration-300';
const HEAD = 'px-5 py-3 bg-gradient-to-b from-[#00f0ff]/10 to-transparent border-b border-[#00f0ff]/20 flex justify-between items-center border-t-[3px] border-t-[#00f0ff] shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]';

export default function RadarChuvaPage() {
  // ─── Data State ────────────────────────────────────────────────────
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // ─── Config State ──────────────────────────────────────────────────
  const [rainMinWhites, setRainMinWhites] = useState(3);
  const [rainWindowSize, setRainWindowSize] = useState(20);
  const [periodHours, setPeriodHours] = useState(168); // 7 dias
  const [maxFetchedHours, setMaxFetchedHours] = useState(168);

  const [entryMin, setEntryMin] = useState(1);
  const [entryMax, setEntryMax] = useState(5);

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
      console.warn("Falha ao buscar dados (Radar Chuva):", err);
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

  // ─── Atraso Atual & Check de Chuva ─────────────────────────────────
  const { currentWhitesInWindow, isInRain, rainStreak } = useMemo(() => {
    if (data.length < rainWindowSize) return { currentWhitesInWindow: 0, isInRain: false, rainStreak: 0 };
    
    // Conta quantos brancos temos na janela atual (live)
    const windowStones = data.slice(-rainWindowSize);
    const whitesCount = windowStones.filter(isBranco).length;
    const inRain = whitesCount >= rainMinWhites;

    // Calcula há quantos brancos estamos "presos" nessa chuva contínua
    let streak = 0;
    if (inRain) {
       for (let i = data.length - 1; i >= rainWindowSize; i--) {
          const subWindow = data.slice(i - rainWindowSize + 1, i + 1);
          const wc = subWindow.filter(isBranco).length;
          if (wc >= rainMinWhites) {
             if (isBranco(data[i])) streak++;
          } else {
             break;
          }
       }
    }
    
    return { currentWhitesInWindow: whitesCount, isInRain: inRain, rainStreak: streak };
  }, [data, rainWindowSize, rainMinWhites]);

  // ─── Audio Alert ───────────────────────────────────────────────────
  const playAlert = useCallback(() => {
    if (!audioEnabled) return;
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const playTone = (time: number, freq: number, dur: number) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, time);
        gain.gain.setValueAtTime(0, time);
        gain.gain.linearRampToValueAtTime(0.3, time + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.001, time + dur);
        osc.connect(gain); gain.connect(ctx.destination);
        osc.start(time); osc.stop(time + dur);
      };
      const now = ctx.currentTime;
      // Um som mais fluído e ascendente para imitar água/surfe
      playTone(now, 440, 0.2);
      playTone(now + 0.15, 660, 0.2);
      playTone(now + 0.3, 880, 0.4);
    } catch(e) {}
  }, [audioEnabled]);

  // ─── Rain Calculation Engine ───────────────────────────────────────
  const rainStats = useMemo(() => {
    let totalRainTriggersGlobal = 0;
    if (data.length === 0 || !isInRain) return { activePatterns: [], allPatterns: [], numConfluences: 0, totalRainTriggers: 0 };

    // 1. Identificar histórico de chuvas (índices onde a janela pra trás continha chuva)
    const isRainAt = (idx: number) => {
       if (idx < rainWindowSize - 1) return false;
       let c = 0;
       for (let k = idx - rainWindowSize + 1; k <= idx; k++) {
          if (isBranco(data[k])) c++;
       }
       return c >= rainMinWhites;
    };

    // 2. Gerar Padrões Live (das últimas 10 pedras)
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

    // 3. Backtest dos padrões SÓ quando a mesa estava em Chuva
    const evaluatedPatterns = uniqueLivePatterns.map(pattern => {
      const hitsByDistance: Record<number, number> = {};
      const triggerDistances: number[] = [];
      let triggers = 0;
      
      for (let i = rainWindowSize; i < data.length - entryMax; i++) {
        if (isRainAt(i)) {
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
             totalRainTriggersGlobal++;
             
             let hitWhiteAt = -1;
             for (let w = 1; w <= entryMax; w++) {
                if (isBranco(data[i + w])) {
                   hitWhiteAt = w;
                   break;
                }
             }
             if (hitWhiteAt !== -1) {
                hitsByDistance[hitWhiteAt] = (hitsByDistance[hitWhiteAt] || 0) + 1;
             }
             // Store distance for SM calculation (Infinity if no hit)
             triggerDistances.push(hitWhiteAt === -1 ? Infinity : hitWhiteAt);
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
            if (tx >= bestTx) {
               bestTx = tx;
               optimalEntries = w;
               bestWins = wins;
               bestLosses = losses;
            }
         }
      }

      // SM and SA calculation
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
         triggers, 
         tx: bestTx.toFixed(1),
         optimalEntries,
         sm,
         sa
      };
    });

    const allPatterns = evaluatedPatterns.sort((a, b) => parseFloat(b.tx) - parseFloat(a.tx));
    const activePatterns = allPatterns.filter(p => p.wins > 0 && parseFloat(p.tx) >= 50);

    return { activePatterns, allPatterns, numConfluences: activePatterns.length, totalRainTriggers: totalRainTriggersGlobal };
  }, [data, isInRain, rainMinWhites, rainWindowSize, entryMin, entryMax]);

  // ─── Live Tracker for Confluences ──────────────────────────────────
  const [confluenceStats, setConfluenceStats] = useState<Record<number, { w: number; l: number }>>({});
  const confluenceStatsRef = useRef<Record<number, { w: number; l: number }>>({});
  const lastProcessedId = useRef<string | null>(null);
  const activeTrackersRef = useRef<{ size: number; startIdx: number; entriesLeft: number; distance: number }[]>([]);
  const lastDataLength = useRef<number>(0);

  useEffect(() => {
    if (data.length === 0) return;
    const currentLatest = data[data.length - 1];
    
    if (currentLatest.id !== lastProcessedId.current) {
      lastProcessedId.current = currentLatest.id ?? null;
      
      const isLatestWhite = isBranco(currentLatest);
      const nextTrackers: { size: number; startIdx: number; entriesLeft: number; distance: number }[] = [];
      const resolved: Record<number, { w: number; l: number }> = {};
      
      activeTrackersRef.current.forEach(t => {
        t.distance++;
        if (isLatestWhite) {
          if (t.distance <= entryMax) {
              resolved[t.size] = { w: (resolved[t.size]?.w || 0) + 1, l: (resolved[t.size]?.l || 0) };
          } else {
              resolved[t.size] = { w: (resolved[t.size]?.w || 0), l: (resolved[t.size]?.l || 0) + 1 };
          }
        } else {
          t.entriesLeft--;
          if (t.entriesLeft <= 0) {
            resolved[t.size] = { w: (resolved[t.size]?.w || 0), l: (resolved[t.size]?.l || 0) + 1 };
          } else {
            nextTrackers.push(t);
          }
        }
      });
      
      if (isInRain && rainStats.numConfluences > 0) {
        if (data.length > lastDataLength.current) {
            nextTrackers.push({ size: rainStats.numConfluences, startIdx: data.length - 1, entriesLeft: entryMax, distance: 0 });
            if (audioEnabled && rainStats.numConfluences >= audioMinConf) {
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
  }, [data, isInRain, rainStats.numConfluences, entryMin, entryMax, audioEnabled, audioMinConf, playAlert]);

  // ─── Repique Map (Spacing Calculation) ─────────────────────────────
  const spacingHeatmap = useMemo(() => {
    if (data.length < rainWindowSize) return { distribution: {}, exhaustionRisk: 0, avgStreak: 0 };
    
    const distribution: Record<number, number> = {};
    const streaks: number[] = [];
    let currentStreak = 0;
    let lastWhiteIdx = -1;

    for (let i = rainWindowSize; i < data.length; i++) {
       // Checa se estava em chuva na pedra anterior (para validar que o branco atual faz parte de uma chuva)
       let wasInRain = false;
       let wc = 0;
       for (let k = i - rainWindowSize; k < i; k++) {
          if (isBranco(data[k])) wc++;
       }
       if (wc >= rainMinWhites) wasInRain = true;

       if (isBranco(data[i])) {
          if (wasInRain) {
             currentStreak++;
             if (lastWhiteIdx !== -1) {
                const dist = i - lastWhiteIdx;
                // Group spacing: 1, 2, 3, 4, 5+
                const bucket = dist > 5 ? '6+' : dist.toString();
                distribution[bucket as any] = (distribution[bucket as any] || 0) + 1;
             }
          } else {
             if (currentStreak > 0) streaks.push(currentStreak);
             currentStreak = 1; // Started a new potential cluster
          }
          lastWhiteIdx = i;
       } else {
          if (!wasInRain && currentStreak > 0) {
             streaks.push(currentStreak);
             currentStreak = 0;
          }
       }
    }
    
    const totalStreaks = streaks.length;
    const avgStreak = totalStreaks > 0 ? streaks.reduce((a,b)=>a+b,0)/totalStreaks : 0;
    
    // Calcula o Risco de Exaustão (Quantas chuvas no passado passaram do número atual que estamos?)
    let exhaustionRisk = 0;
    if (rainStreak > 0 && totalStreaks > 0) {
       const survived = streaks.filter(s => s > rainStreak).length;
       const deathRate = 1 - (survived / totalStreaks);
       exhaustionRisk = Math.min(100, Math.max(0, deathRate * 100));
    }

    return { distribution, exhaustionRisk, avgStreak };
  }, [data, rainMinWhites, rainWindowSize, rainStreak]);

  // ─── AI Copilot Engine ─────────────────────────────────────────────
  const copilot = useMemo(() => {
    if (!isInRain) return { status: 'STANDBY', title: 'AGUARDANDO CHUVA', message: 'Neste momento a mesa não tem densidade de brancos suficiente. O motor de surfe despertará assim que as condições exigidas baterem.', color: 'gray', pulse: false };
    
    const active = rainStats.activePatterns;
    const numConf = active.length;
    const risk = spacingHeatmap.exhaustionRisk;
    
    // Distância do último branco
    let distanceSinceLastWhite = 0;
    for (let i = data.length - 1; i >= 0; i--) {
       if (isBranco(data[i])) break;
       distanceSinceLastWhite++;
    }

    if (risk > 75) {
       return { status: 'FREIO', title: 'FREIO DE MÃO', message: 'Risco de exaustão extremo. Historicamente, a chuva morre aqui. Não aposte.', color: 'red', pulse: true };
    }

    if (numConf === 0) {
       return { status: 'STANDBY', title: 'AGUARDANDO PADRÃO...', message: 'Mesa em chuva, mas nenhum padrão com força matemática no momento.', color: 'gray', pulse: false };
    }

    let maxProbDist = 1;
    let highestCount = 0;
    Object.entries(spacingHeatmap.distribution).forEach(([distStr, count]) => {
       if (distStr === '6+') return; 
       if (count > highestCount) {
          highestCount = count;
          maxProbDist = parseInt(distStr);
       }
    });

    if (maxProbDist > distanceSinceLastWhite + 1 && highestCount > 0) {
       const pular = maxProbDist - distanceSinceLastWhite - 1;
       return { status: 'PULAR', title: `PULE ${pular} CASA${pular > 1 ? 'S' : ''}`, message: `O histórico de repique aponta que a maioria dos brancos cai na casa ${maxProbDist}. Aguarde o momento exato.`, color: 'yellow', pulse: true };
    }

    let totalOptimal = 0;
    active.forEach(p => totalOptimal += p.optimalEntries);
    const avgEntries = Math.round(totalOptimal / numConf) || 1;

    if (risk > 50) {
       const cutEntries = Math.max(1, Math.floor(avgEntries / 2));
       return { status: 'MAO_LEVE', title: `MÃO LEVE: ${cutEntries} ENTRADA${cutEntries > 1 ? 'S' : ''}`, message: `Risco de exaustão alto (${risk.toFixed(0)}%). Corte seu limite de entradas para proteger o lucro.`, color: 'yellow', pulse: true };
    }

    return { status: 'ENTRAR', title: `APOSTE POR ${avgEntries} RODADA${avgEntries > 1 ? 'S' : ''}`, message: `${numConf} confluências apontam que a chuva continua forte. Vai pra cima!`, color: 'cyan', pulse: true };

  }, [isInRain, rainStats.activePatterns, spacingHeatmap, data]);

  return (
    <main className="min-h-screen bg-[#050507] text-gray-200 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="bg-[#0a0a0f] border-b border-white/5 h-[72px] px-6 flex items-center justify-between shadow-2xl shrink-0 z-50">
        <h1 className="text-xl font-black uppercase tracking-tighter text-white flex items-center gap-2">
          <CloudRain size={24} className="text-[#00f0ff]" />
          RADAR DE CHUVA
        </h1>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setAudioEnabled(!audioEnabled)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all font-black text-[10px] uppercase tracking-widest ${audioEnabled ? 'bg-[#00f0ff]/20 border border-[#00f0ff]/40 text-[#00f0ff]' : 'bg-white/5 border border-white/10 text-gray-500'}`}
          >
            {audioEnabled ? <Volume2 size={14} /> : <VolumeX size={14} />}
            {audioEnabled ? 'SOM ATIVO' : 'SOM MUDO'}
          </button>
        </div>
      </div>

      <div className="flex-1 flex flex-col overflow-y-auto custom-scrollbar p-6 gap-6 bg-gradient-to-br from-[#050507] via-[#080b12] to-[#050507]">
        {/* Live History */}
        <LiveHistoryCard data={data} maxItems={35} />

        {/* Status Bar: Rain Indicator */}
        <div className={`${isInRain ? CARD_ACTIVE : CARD} p-5`}>
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-4">
              <div className={`w-14 h-14 rounded-xl flex items-center justify-center text-xl font-black border ${isInRain ? 'bg-[#00f0ff]/20 border-[#00f0ff]/50 text-[#00f0ff] animate-pulse shadow-[0_0_30px_rgba(0,240,255,0.3)]' : 'bg-white/5 border-white/10 text-gray-400'}`}>
                {currentWhitesInWindow}
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] uppercase font-black tracking-widest text-gray-500">Clima Atual (Últ. {rainWindowSize})</span>
                <span className={`text-lg font-black ${isInRain ? 'text-[#00f0ff]' : 'text-white'}`}>
                  {isInRain ? `🌊 SURFANDO (${rainStreak} Brancos)` : 'Seca / Normal'}
                </span>
              </div>
            </div>

            <div className="flex flex-col items-end gap-2">
              <div className="flex items-center gap-2">
                 <span className="text-[10px] uppercase font-black tracking-widest text-gray-500">Exigir</span>
                 <select className="bg-[#12141c] text-white border border-white/10 rounded px-2 py-1 text-xs outline-none focus:border-[#00f0ff]" value={rainMinWhites} onChange={e => setRainMinWhites(+e.target.value)}>
                    {[2,3,4,5,6].map(v => <option key={v} value={v}>{v}+ Brancos</option>)}
                 </select>
                 <span className="text-[10px] uppercase font-black tracking-widest text-gray-500">em</span>
                 <select className="bg-[#12141c] text-white border border-white/10 rounded px-2 py-1 text-xs outline-none focus:border-[#00f0ff]" value={rainWindowSize} onChange={e => setRainWindowSize(+e.target.value)}>
                    {[10,15,20,30,40,50].map(v => <option key={v} value={v}>{v} Casas</option>)}
                 </select>
              </div>
            </div>
          </div>
        </div>

        {/* Filtros de Análise */}
        <div className={`${CARD} p-5`}>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-gray-400 uppercase font-bold tracking-wider">Período Histórico</label>
              <select className="bg-[#12141c] border border-white/10 text-[#00f0ff] font-bold px-3 py-1.5 rounded-md outline-none focus:border-[#00f0ff]" value={periodHours} onChange={e => setPeriodHours(+e.target.value)}>
                {[24, 48, 72, 120, 168, 336, 720].map(h => <option key={h} value={h}>{h < 24 ? `${h} Horas` : `${h/24} Dias`}</option>)}
              </select>
            </div>

            <div className="flex flex-col gap-1 lg:col-span-2">
              <label className="text-[10px] text-gray-400 uppercase font-bold tracking-wider">Mapeamento de Entradas (Min - Max)</label>
              <div className="flex items-center gap-4 bg-[#12141c] border border-white/10 rounded-md px-4 py-2">
                 <span className="text-xs font-black text-white">{entryMin}</span>
                 <input type="range" min={1} max={10} value={entryMin} onChange={e => { const v = +e.target.value; setEntryMin(Math.min(v, entryMax)); }} className="flex-1 accent-[#00f0ff]" />
                 <input type="range" min={1} max={10} value={entryMax} onChange={e => { const v = +e.target.value; setEntryMax(Math.max(v, entryMin)); }} className="flex-1 accent-[#00f0ff]" />
                 <span className="text-xs font-black text-white">{entryMax}</span>
              </div>
              <span className="text-[9px] text-gray-500 mt-1">A IA buscará a melhor taxa de acerto variando a quantidade de entradas dentro desse limite.</span>
            </div>
          </div>

          <div className="flex items-center gap-4 mt-4 pt-4 border-t border-white/5">
            <span className="text-[10px] text-gray-400 uppercase font-bold tracking-wider">Alerta Sonoro a partir de</span>
            <select className="bg-[#12141c] border border-white/10 text-white px-3 py-1.5 rounded-md outline-none focus:border-[#00f0ff] text-xs" value={audioMinConf} onChange={e => setAudioMinConf(+e.target.value)}>
              {[3, 4, 5, 6, 7, 8, 9, 10].map(v => <option key={v} value={v}>{v}+ confluências</option>)}
            </select>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-2 border-[#00f0ff] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              {/* CARD 1: COPILOTO DE SURFE */}
              <div className={`${copilot.status !== 'STANDBY' ? CARD_ACTIVE : CARD} p-6 lg:col-span-1 flex flex-col items-center justify-center min-h-[300px] text-center relative overflow-hidden`}>
                 {copilot.pulse && <div className={`absolute inset-0 opacity-10 animate-pulse ${copilot.color === 'red' ? 'bg-[#f12c4c]' : copilot.color === 'yellow' ? 'bg-[#eab308]' : 'bg-[#00f0ff]'}`} />}
                 
                 <div className="flex flex-col items-center justify-center w-full relative z-10">
                    {copilot.status === 'STANDBY' && <Droplets size={48} className="mb-4 text-gray-500" />}
                    {copilot.status === 'FREIO' && <AlertOctagon size={48} className="mb-4 text-[#f12c4c] animate-pulse" />}
                    {copilot.status === 'PULAR' && <Waves size={48} className="mb-4 text-[#eab308] animate-bounce" />}
                    {copilot.status === 'MAO_LEVE' && <TrendingUp size={48} className="mb-4 text-[#eab308]" />}
                    {copilot.status === 'ENTRAR' && <Waves size={48} className="mb-4 text-[#00f0ff] animate-pulse" />}

                    <h3 className={`text-2xl font-black uppercase tracking-tighter ${
                       copilot.color === 'gray' ? 'text-gray-400' :
                       copilot.color === 'red' ? 'text-[#f12c4c]' :
                       copilot.color === 'yellow' ? 'text-[#eab308]' :
                       'text-[#00f0ff]'
                    }`}>
                       {copilot.title}
                    </h3>

                    {copilot.status !== 'STANDBY' && copilot.status !== 'FREIO' && (
                       <div className={`my-4 px-6 py-2 rounded-full border shadow-lg ${
                          copilot.color === 'yellow' ? 'bg-[#eab308]/20 border-[#eab308]/50 text-[#eab308]' :
                          'bg-[#00f0ff]/20 border-[#00f0ff]/50 text-[#00f0ff]'
                       }`}>
                          <span className="font-black text-lg">{rainStats.numConfluences} CONFLUÊNCIAS</span>
                       </div>
                    )}

                    <p className="text-xs text-gray-400 mt-2 px-4 max-w-[280px] leading-relaxed font-medium">
                       {copilot.message}
                    </p>

                    {rainStats.numConfluences > 0 && copilot.status !== 'FREIO' && (
                       <div className="w-full mt-5 max-h-[120px] overflow-y-auto custom-scrollbar flex flex-col gap-2 pr-2 opacity-80 hover:opacity-100 transition-opacity">
                         {rainStats.activePatterns.slice(0, 3).map((p, idx) => (
                            <div key={idx} className="flex justify-between items-center bg-black/40 p-2 rounded border border-white/5">
                               <div className="flex gap-1">
                                 {p.patternArray.map((v: string, vIdx: number) => {
                                   const n = parseInt(v); let bg = 'bg-[#262831]'; let text = 'text-white';
                                   const isColor = v === 'V' || v === 'P' || v === 'B';
                                   if (isColor) { if (v === 'V') bg = 'bg-[#f12c4c]'; if (v === 'B') { bg = 'bg-white'; text = 'text-black'; } }
                                   else { if (n === 0) { bg = 'bg-white'; text = 'text-black'; } else if (n >= 1 && n <= 7) bg = 'bg-[#f12c4c]'; }
                                   return <div key={vIdx} className={`w-3 h-3 rounded-[2px] flex items-center justify-center text-[7px] font-black ${bg} ${text}`}>{isColor ? '' : v}</div>;
                                 })}
                               </div>
                               <div className="flex flex-col items-end">
                                  <span className={`text-[10px] font-bold ${copilot.color === 'yellow' ? 'text-[#eab308]' : 'text-[#00f0ff]'}`}>{p.tx}%</span>
                                  <span className="text-[8px] text-gray-500">Gale {p.optimalEntries}</span>
                               </div>
                            </div>
                         ))}
                       </div>
                    )}
                 </div>
              </div>

              {/* CARD 2: PERFORMANCE & EXAUSTÃO */}
              <div className={`${CARD} p-0 lg:col-span-1 min-h-[300px] flex flex-col`}>
                 <div className={HEAD}>
                    <h3 className="text-xs font-black uppercase text-white tracking-widest">Placar & Risco</h3>
                 </div>
                 
                 {/* Termômetro de Exaustão */}
                 <div className="p-4 border-b border-white/5 bg-black/20">
                    <div className="flex justify-between items-end mb-2">
                       <div className="flex flex-col">
                          <span className="text-[10px] font-black uppercase text-gray-500 flex items-center gap-1">
                             <AlertOctagon size={12} className={spacingHeatmap.exhaustionRisk > 75 ? 'text-[#f12c4c]' : 'text-gray-500'} /> 
                             Risco de Fim da Chuva
                          </span>
                          <span className="text-xs font-medium text-gray-400 mt-1">Historicamente, a chuva atual morre aqui?</span>
                       </div>
                       <span className={`text-xl font-black ${spacingHeatmap.exhaustionRisk > 75 ? 'text-[#f12c4c]' : spacingHeatmap.exhaustionRisk > 40 ? 'text-[#eab308]' : 'text-[#4ade80]'}`}>
                          {spacingHeatmap.exhaustionRisk.toFixed(0)}%
                       </span>
                    </div>
                    <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                       <motion.div 
                          initial={{ width: 0 }} animate={{ width: `${spacingHeatmap.exhaustionRisk}%` }} 
                          className={`h-full ${spacingHeatmap.exhaustionRisk > 75 ? 'bg-[#f12c4c]' : spacingHeatmap.exhaustionRisk > 40 ? 'bg-[#eab308]' : 'bg-[#4ade80]'}`}
                       />
                    </div>
                 </div>

                 {/* Placar */}
                 <div className="p-4 flex-1 overflow-y-auto custom-scrollbar">
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
                          {Object.entries(confluenceStats).sort((a, b) => parseInt(b[0]) - parseInt(a[0])).map(([size, stats]) => {
                             const total = stats.w + stats.l;
                             const tx = total > 0 ? ((stats.w / total) * 100).toFixed(0) : '0';
                             return (
                                <tr key={size} className="border-b border-white/5 hover:bg-white/5">
                                   <td className="py-3 font-bold text-white">{size} Estrat.</td>
                                   <td className="py-3 font-bold text-[#4ade80] text-center">{stats.w}</td>
                                   <td className="py-3 font-bold text-[#f12c4c] text-center">{stats.l}</td>
                                   <td className="py-3 font-bold text-white text-right">{tx}%</td>
                                </tr>
                             );
                          })}
                          {Object.keys(confluenceStats).length === 0 && (
                             <tr><td colSpan={4} className="py-8 text-center text-xs text-gray-500">Nenhuma entrada registrada nesta sessão.</td></tr>
                          )}
                       </tbody>
                    </table>
                 </div>
              </div>

              {/* CARD 3: MAPA DE REPIQUE (ESPAÇAMENTO) */}
              <div className={`${CARD} p-0 lg:col-span-1 min-h-[300px]`}>
                 <div className={HEAD}>
                    <h3 className="text-xs font-black uppercase text-white tracking-widest">Espaçamento na Chuva</h3>
                    <span className="text-[10px] bg-black/30 px-2 py-1 rounded text-[#00f0ff]">Onde repica?</span>
                 </div>
                 <div className="p-5 flex flex-col gap-1">
                    <p className="text-[10px] text-gray-400 mb-2 leading-relaxed">
                       Em períodos de chuva, qual a distância (em casas) entre um branco e o próximo?
                    </p>
                    
                    {Object.entries(spacingHeatmap.distribution).length > 0 ? (
                       <div className="flex flex-col gap-3 mt-2">
                          {['1', '2', '3', '4', '5', '6+'].map(distKey => {
                             const count = spacingHeatmap.distribution[distKey as any] || 0;
                             const totalRepiques = Object.values(spacingHeatmap.distribution).reduce((a,b)=>a+b, 0);
                             const pct = totalRepiques > 0 ? ((count / totalRepiques) * 100).toFixed(1) : '0';
                             return (
                                <div key={distKey} className="flex flex-col gap-1">
                                   <div className="flex justify-between text-[10px] font-bold uppercase">
                                      <span className="text-gray-400">Distância: {distKey} {distKey === '1' ? 'Casa (Colado)' : 'Casas'}</span>
                                      <span className="text-white">{pct}% ({count})</span>
                                   </div>
                                   <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden">
                                      <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }} className="h-full bg-[#00f0ff]" />
                                   </div>
                                </div>
                             );
                          })}
                       </div>
                    ) : (
                       <div className="py-10 text-center text-xs text-gray-500">
                          Histórico insuficiente para cálculo de espaçamento.
                       </div>
                    )}
                 </div>
              </div>

            </div>

            {/* BIG TABLE: TODAS AS ESTRATÉGIAS NA CHUVA */}
            <div className={`${CARD} p-0 w-full`}>
               <div className={HEAD}>
                  <h3 className="text-sm font-black uppercase text-white tracking-widest">Análise de Todas as Estratégias (Durante as Chuvas Históricas)</h3>
                  <span className="text-[10px] bg-black/30 px-2 py-1 rounded text-gray-400">{rainStats.allPatterns.length} Encontradas</span>
               </div>
               <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                     <thead>
                        <tr className="border-b border-white/10 text-[10px] uppercase text-gray-500 bg-black/20">
                           <th className="p-4 font-black">Padrão Identificado</th>
                           <th className="p-4 font-black">Tipo</th>
                           <th className="p-4 font-black text-center">Gale Ideal</th>
                           <th className="p-4 font-black text-center">Total (Em Chuva)</th>
                           <th className="p-4 font-black text-center">Wins</th>
                           <th className="p-4 font-black text-center">Losses</th>
                           <th className="p-4 font-black text-center" title="Streak Atual (Perdas Seguidas)">SA</th>
                           <th className="p-4 font-black text-center" title="Streak Máxima de Perdas">SM</th>
                           <th className="p-4 font-black text-right text-white">Assertividade</th>
                        </tr>
                     </thead>
                     <tbody className="divide-y divide-white/5">
                        {rainStats.allPatterns.map((p, idx) => (
                           <tr key={idx} className={`hover:bg-white/5 transition-colors ${idx < rainStats.numConfluences && isInRain ? 'bg-[#00f0ff]/10' : ''}`}>
                              <td className="p-4">
                                 <div className="flex gap-1">
                                    {p.patternArray.map((v: string, vIdx: number) => {
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
                              <td className="p-4 text-center text-gray-400 font-bold">{p.triggers}</td>
                              <td className="p-4 text-center text-[#4ade80] font-black">{p.wins}</td>
                              <td className="p-4 text-center text-[#f12c4c] font-black">{p.losses}</td>
                              <td className="p-4 text-center">
                                 <span className={`font-black ${p.sa > 0 ? 'text-[#eab308]' : 'text-gray-500'}`}>{p.sa}</span>
                              </td>
                              <td className="p-4 text-center">
                                 <span className={`font-black ${p.sm > 3 ? 'text-[#f12c4c]' : 'text-gray-400'}`}>{p.sm}</span>
                              </td>
                              <td className="p-4 text-right">
                                 <span className={`text-sm font-black ${parseFloat(p.tx) >= 80 ? 'text-[#00f0ff]' : parseFloat(p.tx) >= 60 ? 'text-gray-300' : 'text-[#f12c4c]'}`}>
                                    {p.tx}%
                                 </span>
                              </td>
                           </tr>
                        ))}
                        {rainStats.allPatterns.length === 0 && (
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
